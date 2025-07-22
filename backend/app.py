import os
import traceback
from collections import defaultdict
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory, render_template
import sqlite3
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import openai
from dotenv import load_dotenv
import requests
import json
from bs4 import BeautifulSoup
import difflib
from datetime import datetime
from models import (
    Base,
    engine,
    SessionLocal,
    init_db as init_sqlalchemy_db,
    Merchant,
    Product,
    ErrorLog,
)
import uuid

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "deepseek/deepseek-chat-v3-0324:free"

app = Flask(__name__)
# Secret key for session cookies
app.secret_key = os.getenv("SECRET_KEY", "secret-key")
# Allow embedding from any domain
CORS(app, resources={r"/*": {"origins": "*"}})

# Setup Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)

@app.route("/")
def index():
    """Simple health check for the API."""
    return "<h1>SEEP Global API is Live</h1>"

DB_PATH = os.path.join(os.path.dirname(__file__), 'bots.db')


def init_sqlite_tables():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bots (name TEXT PRIMARY KEY, welcome_message TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT UNIQUE, answer TEXT)"
    )
    conn.commit()
    conn.close()


init_sqlite_tables()
init_sqlalchemy_db()


@login_manager.user_loader
def load_user(user_id):
    with SessionLocal() as db:
        return db.query(Merchant).get(user_id)


def ensure_default_merchant():
    with SessionLocal() as db:
        if not db.query(Merchant).filter_by(id="test-merchant").first():
            m = Merchant(
                id="test-merchant",
                email="test@example.com",
                password_hash=generate_password_hash("password"),
                api_key=str(uuid.uuid4()),
                api_secret=str(uuid.uuid4()),
                greeting="Welcome to Seep!",
                cart_url="https://store.com/cart",
                checkout_url="https://store.com/checkout",
                contact_url="mailto:support@store.com",
                product_method="html",
                store_url="store.com",
                shopify_domain=None,
                shopify_token=None,
                suggest_products=1,
            )
            db.add(m)
            db.commit()


ensure_default_merchant()

def get_welcome(bot_name: str) -> str:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT welcome_message FROM bots WHERE name=?",
        (bot_name,),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else ""


def save_welcome(bot_name: str, message: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO bots (name, welcome_message) VALUES (?, ?)"
        " ON CONFLICT(name) DO UPDATE SET welcome_message=excluded.welcome_message",
        (bot_name, message),
    )
    conn.commit()
    conn.close()


def get_faqs():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT id, question, answer FROM faqs")
    rows = cur.fetchall()
    conn.close()
    return [
        {"id": r[0], "question": r[1], "answer": r[2]}
        for r in rows
    ]


def add_faq(question: str, answer: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO faqs (question, answer) VALUES (?, ?)",
        (question, answer),
    )
    conn.commit()
    conn.close()



# Track session level stats
# Track session level stats
session_usage = defaultdict(lambda: {"requests": 0, "tokens": 0})
# Track sessions that mentioned the cart but didn't checkout
abandoned_cart_flags = defaultdict(bool)
# Per merchant monthly usage
def current_month():
    return datetime.utcnow().strftime("%Y-%m")

# Track usage per merchant
merchant_usage = defaultdict(
    lambda: {"tokens": 0, "plan": "free", "month": current_month(), "requests": 0}
)
# Store chat logs per merchant
merchant_logs = defaultdict(list)
# In-memory store for configuration and extended stats
config = {
    "welcome_message": "",
    "tone": "Friendly",
    "business_name": "",
    "store_type": None,
    "store_domain": None,
    "store_api_key": None,
    "product_endpoint": None,
}
# Basic per-merchant links used by the embeddable widget. In a real
# deployment these would likely come from a database, but for this demo
# we simply provide defaults for the "test-merchant" ID.
merchant_configs = {
    "test-merchant": {
        "trackLink": "https://store.com/track",
        "returnsLink": "https://store.com/returns",
        "supportLink": "https://store.com/support",
        "cartUrl": "https://store.com/cart",
        "checkoutUrl": "https://store.com/checkout",
        "contactUrl": "mailto:support@store.com",
    }
}

# In-memory analytics store
analytics_events = defaultdict(list)
templates = {"welcome": "", "abandoned_cart": "", "faq": ""}
SHOPIFY_STOREFRONT_TOKEN = os.getenv("SHOPIFY_STOREFRONT_TOKEN")
SHOPIFY_STORE_DOMAIN = os.getenv("SHOPIFY_STORE_DOMAIN")
stats = {
    "unique_visitors": set(),
    "success": 0,
    "failure": 0,
    "conversions": 0,
}


def sync_custom_html_products(merchant_id: str):
    """Fetch product data from a custom HTML store."""
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        if not m or not (m.store_domain or m.store_url or m.cart_url):
            return
        m.product_sync_status = "syncing"
        db.commit()
        products = []
        base = m.store_url or m.cart_url
        if not base and m.store_domain:
            base = f"https://{m.store_domain}"
        try:
            resp = requests.get(base, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            products.extend(_extract_products(soup, base))

            links = [a["href"] for a in soup.find_all("a", href=True) if "product" in a["href"]]
            for link in links[:3]:
                url = link if link.startswith("http") else base.rstrip("/") + "/" + link.lstrip("/")
                try:
                    r = requests.get(url, timeout=10)
                    soup2 = BeautifulSoup(r.text, "html.parser")
                    products.extend(_extract_products(soup2, url))
                except Exception:
                    pass

            db.query(Product).filter_by(merchant_id=merchant_id).delete()
            for p in products:
                db.add(
                    Product(
                        merchant_id=merchant_id,
                        title=p.get("title"),
                        description=p.get("description"),
                        price=p.get("price"),
                        image_url=p.get("image"),
                        url=p.get("url"),
                    )
                )
            m.product_sync_status = "success"
            m.product_last_synced = datetime.utcnow()
        except Exception:
            m.product_sync_status = "error"
        finally:
            db.commit()


def sync_api_products(merchant_id: str):
    """Fetch product data from WooCommerce or legacy APIs."""
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        if not m or not m.store_url or not m.api_key:
            return
        m.product_sync_status = "syncing"
        db.commit()
        products = []
        try:
            if m.api_type == "woocommerce":
                params = {}
                if m.api_secret:
                    params = {"consumer_key": m.api_key, "consumer_secret": m.api_secret}
                    resp = requests.get(
                        f"https://{m.store_url}/wp-json/wc/v3/products",
                        params=params,
                        timeout=10,
                    )
                else:
                    resp = requests.get(
                        f"https://{m.store_url}/wp-json/wc/v3/products",
                        headers={"Authorization": f"Bearer {m.api_key}"},
                        timeout=10,
                    )
                for p in resp.json()[:10]:
                    img = p.get("images")
                    products.append(
                        {
                            "title": p.get("name"),
                            "description": p.get("description"),
                            "price": p.get("price"),
                            "link": p.get("permalink"),
                            "image_url": img[0].get("src") if img else None,
                        }
                    )

            db.query(Product).filter_by(merchant_id=merchant_id).delete()
            for p in products:
                db.add(
                    Product(
                        merchant_id=merchant_id,
                        title=p.get("title"),
                        description=p.get("description"),
                        price=p.get("price"),
                        image_url=p.get("image_url"),
                        url=p.get("link"),
                    )
                )
            m.product_sync_status = "success"
            m.product_last_synced = datetime.utcnow()
        except Exception:
            m.product_sync_status = "error"
        finally:
            db.commit()


def sync_products_for_merchant(merchant_id: str):
    """Synchronize products according to merchant settings."""
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        method = m.product_method if m else None
        api_type = m.api_type if m else None
    if method == "html":
        sync_custom_html_products(merchant_id)
    elif method == "api":
        if api_type == "shopify":
            sync_shopify_products(merchant_id)
        else:
            sync_api_products(merchant_id)

def sync_products_by_type(merchant_id: str):
    """Synchronize products based on store_type field."""
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)

    if not m:
        return

    if m.store_type == "Shopify":
        domain = m.store_domain or m.shopify_domain
        token = m.store_api_key or m.shopify_token
        if not (domain and token):
            return
        m.product_sync_status = "syncing"
        with SessionLocal() as db:
            db.merge(m)
            db.commit()
        products = []
        query = """
        { products(first:10) { edges { node { title description onlineStoreUrl images(first:1){edges{node{url}}} variants(first:1){edges{node{price{amount}}}} } } } }
        """
        try:
            resp = requests.post(
                f"https://{domain}/api/2023-10/graphql.json",
                json={"query": query},
                headers={
                    "X-Shopify-Storefront-Access-Token": token,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            data = resp.json()
            for edge in data.get("data", {}).get("products", {}).get("edges", []):
                node = edge.get("node", {})
                price = None
                var = node.get("variants", {}).get("edges", [])
                if var:
                    price = var[0].get("node", {}).get("price", {}).get("amount")
                img = node.get("images", {}).get("edges", [])
                img_url = img[0].get("node", {}).get("url") if img else None
                products.append(
                    {
                        "title": node.get("title"),
                        "description": node.get("description"),
                        "price": price,
                        "link": node.get("onlineStoreUrl"),
                        "image_url": img_url,
                    }
                )
        except Exception:
            with SessionLocal() as db:
                m = db.query(Merchant).get(merchant_id)
                m.product_sync_status = "error"
                db.commit()
            return
    elif m.store_type == "WooCommerce":
        if not m.store_domain:
            return
        m.product_sync_status = "syncing"
        with SessionLocal() as db:
            db.merge(m)
            db.commit()
        products = []
        try:
            headers = {}
            if m.store_api_key:
                headers = {"Authorization": f"Bearer {m.store_api_key}"}
            resp = requests.get(
                f"https://{m.store_domain}/wp-json/wc/v3/products",
                headers=headers,
                timeout=10,
            )
            for p in resp.json()[:10]:
                img = p.get("images")
                products.append(
                    {
                        "title": p.get("name"),
                        "description": p.get("description"),
                        "price": p.get("price"),
                        "link": p.get("permalink"),
                        "image_url": img[0].get("src") if img else None,
                    }
                )
        except Exception:
            with SessionLocal() as db:
                m = db.query(Merchant).get(merchant_id)
                m.product_sync_status = "error"
                db.commit()
            return
    else:
        # Custom store HTML scraping
        base = m.store_domain or m.store_url
        if not base:
            return
        if not base.startswith("http"):
            base = f"https://{base}"
        with SessionLocal() as db:
            m.product_sync_status = "syncing"
            db.merge(m)
            db.commit()
        products = []
        try:
            resp = requests.get(base, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            products.extend(_extract_products(soup, base))
        except Exception:
            with SessionLocal() as db:
                m = db.query(Merchant).get(merchant_id)
                m.product_sync_status = "error"
                db.commit()
            return

    with SessionLocal() as db:
        db.query(Product).filter_by(merchant_id=merchant_id).delete()
        for p in products:
            db.add(
                Product(
                    merchant_id=merchant_id,
                    title=p.get("title"),
                    description=p.get("description"),
                    price=p.get("price"),
                    image_url=p.get("image_url") or p.get("image"),
                    url=p.get("link") or p.get("url"),
                )
            )
        m = db.query(Merchant).get(merchant_id)
        m.product_sync_status = "success"
        m.product_last_synced = datetime.utcnow()
        db.commit()

def _extract_products(soup: BeautifulSoup, base_url: str):
    items = []
    for script in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(script.string)
        except Exception:
            continue
        entries = data if isinstance(data, list) else [data]
        for d in entries:
            if isinstance(d, dict) and d.get("@type") == "Product":
                items.append(
                    {
                        "title": d.get("name"),
                        "description": d.get("description"),
                        "price": (d.get("offers") or {}).get("price"),
                        "url": d.get("url") or base_url,
                        "image": d.get("image", ""),
                    }
                )
    if not items:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            items.append(
                {
                    "title": og_title.get("content"),
                    "description": (soup.find("meta", property="og:description") or {}).get("content"),
                    "price": (soup.find("meta", property="product:price:amount") or {}).get("content"),
                    "url": base_url,
                    "image": (soup.find("meta", property="og:image") or {}).get("content"),
                }
            )
    return items


def merchant_config_data(merchant_id: str):
    links = merchant_configs.get(merchant_id, merchant_configs.get("test-merchant", {}))
    cfg = {"welcomeMessage": get_welcome(merchant_id)}
    cfg.update(links)
    with SessionLocal() as db:
        m = db.query(Merchant).filter_by(id=merchant_id).first()
        if m:
            cfg.update(
                {
                    "greeting": m.greeting,
                    "color": m.color,
                    "storeType": m.store_type,
                    "storeDomain": m.store_domain,
                    "storeApiKey": m.store_api_key,
                    "productEndpoint": m.product_endpoint,
                    "productSyncStatus": m.product_sync_status,
                    "productLastSynced": m.product_last_synced.isoformat()
                    if m.product_last_synced
                    else None,
                    "productMethod": m.product_method,
                    "apiType": m.api_type,
                    "storeUrl": m.store_url,
                    "shopifyDomain": m.shopify_domain,
                    "shopifyToken": m.shopify_token,
                    "suggestProducts": bool(m.suggest_products),
                }
            )
    return cfg


@app.route("/auth/register", methods=["POST"])
@app.route("/signup", methods=["POST"])
def register():
    data = request.get_json(force=True) or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    with SessionLocal() as db:
        if db.query(Merchant).filter_by(email=email).first():
            return jsonify({"error": "exists"}), 400
        m = Merchant(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=generate_password_hash(password),
            greeting=data.get("greeting"),
            color=data.get("color"),
            cart_url=data.get("cartUrl"),
            checkout_url=data.get("checkoutUrl"),
            contact_url=data.get("contactUrl"),
            api_key=data.get("apiKey"),
            product_method=data.get("productMethod"),
            api_type=data.get("apiType"),
            store_url=data.get("storeUrl"),
            shopify_domain=data.get("shopifyDomain"),
            shopify_token=data.get("shopifyToken"),
            suggest_products=data.get("suggestProducts", 1),
        )
        db.add(m)
        db.commit()
        merchant_configs[m.id] = {
            "cartUrl": m.cart_url,
            "checkoutUrl": m.checkout_url,
            "contactUrl": m.contact_url,
        }
        if m.greeting:
            save_welcome(m.id, m.greeting)
        login_user(m)
        return jsonify({"merchantId": m.id, "config": merchant_config_data(m.id), "usage": merchant_usage[m.id]})


@app.route("/auth/login", methods=["POST"])
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True) or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    with SessionLocal() as db:
        m = db.query(Merchant).filter_by(email=email).first()
        if not m or not m.password_hash or not check_password_hash(m.password_hash, password):
            return jsonify({"error": "invalid"}), 401
        login_user(m)
    return jsonify({"merchantId": m.id, "config": merchant_config_data(m.id), "usage": merchant_usage[m.id]})


@app.route("/logout", methods=["POST"])
def logout():
    logout_user()
    return jsonify({"status": "ok"})


def get_client():
    return openai.OpenAI(api_key=API_KEY, base_url="https://openrouter.ai/api/v1")


@app.route("/chat", methods=["POST"])
def chat():
    merchant_id = None
    if current_user.is_authenticated:
        merchant_id = current_user.id
    else:
        merchant_id = request.headers.get("x-merchant-id")
    if not merchant_id:
        return jsonify({"error": "merchant_id", "message": "Authentication required"}), 400

    usage = merchant_usage[merchant_id]
    if usage["month"] != current_month():
        usage["tokens"] = 0
        usage["month"] = current_month()

    plan = usage.get("plan", "free").lower()
    limits = {"free": 2000, "starter": 8000, "pro": float("inf")}
    limit = limits.get(plan, float("inf"))
    if usage["tokens"] >= limit:
        stats["failure"] += 1
        return jsonify({"error": "limit", "message": "Token limit exceeded"}), 402

    session_id = request.remote_addr
    sess = session_usage[session_id]
    stats["unique_visitors"].add(session_id)

    if not API_KEY:
        stats["failure"] += 1
        return jsonify({"error": "server_config", "message": "OpenRouter API key missing"}), 500

    data = request.get_json(force=True) or {}
    user_message = data.get("message", "")
    sess["requests"] += 1

    with SessionLocal() as db:
        m = db.query(Merchant).filter_by(id=merchant_id).first()
        prods = db.query(Product).filter_by(merchant_id=merchant_id).all()

    product_info = ""
    outdated = not prods or (
        m and m.product_last_synced and (datetime.utcnow() - m.product_last_synced).days > 7
    )

    # If the user mentions cart/checkout keywords, flag session
    lower = user_message.lower()
    keywords = ["cart", "checkout", "left item", "left in cart", "forgot"]
    if any(k in lower for k in keywords):
        abandoned_cart_flags[session_id] = True

    if ("product" in lower or "price" in lower or "item" in lower) and not prods:
        return Response("Sorry, I couldn't detect any products yet.", mimetype="text/plain")

    top_matches = []
    if m and m.suggest_products and prods:
        scored = [
            (
                difflib.SequenceMatcher(None, lower, f"{p.title} {p.description}").ratio(),
                p,
            )
            for p in prods
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        top_matches = [p for score, p in scored[:3] if score > 0.2]

    preview_text = ""
    if top_matches:
        product_info = "\n".join(
            f"- {p.title} ({p.price}): {p.url}" for p in top_matches if p.title
        )
        preview_text = "\n\nSuggested products:\n" + "\n".join(
            f"- {p.title} ({p.price}) {p.url}" for p in top_matches if p.title
        )
    else:
        product_info = "\n".join(
            f"- {p.title} ({p.price}): {p.url}" for p in prods[:5] if p.title
        )

    # Quick product responses
    if "bestseller" in lower and prods:
        titles = ", ".join(p.title for p in prods[:3])
        return Response(f"Our popular products include: {titles}", mimetype="text/plain")
    if "price of" in lower:
        for p in prods:
            if p.title and p.title.lower() in lower:
                return Response(f"The price of {p.title} is {p.price}", mimetype="text/plain")

    # Check stored FAQs before calling the LLM
    for faq in get_faqs():
        ratio = difflib.SequenceMatcher(None, lower, faq["question"].lower()).ratio()
        if ratio > 0.6:
            token_count = len(faq["answer"].split())
            sess["tokens"] += token_count
            merchant_usage[merchant_id]["tokens"] += token_count
            merchant_usage[merchant_id]["requests"] += 1
            stats["success"] += 1
            merchant_logs[merchant_id].append(
                {
                    "session": session_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "user": user_message,
                    "assistant": faq["answer"],
                }
            )
            return Response(faq["answer"], mimetype="text/plain")

    def generate():
        success = True
        full = ""
        try:
            client = get_client()
            context = ""
            if product_info:
                context = "Available products:\n" + product_info
            elif outdated:
                context = "Product data is missing or outdated. Suggest updating store configuration when asked."
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are Seep, a smart and helpful assistant."},
                    {"role": "system", "content": context},
                    {"role": "user", "content": user_message},
                ],
                stream=True,
            )
            for chunk in response:
                token = chunk.choices[0].delta.content or ""
                token = token.replace("*", "")
                full += token
                yield token
            if preview_text:
                clean_preview = preview_text.replace("*", "")
                yield clean_preview
                full += clean_preview
            token_count = len(full.split())
            sess["tokens"] += token_count
            merchant_usage[merchant_id]["tokens"] += token_count
        except openai.AuthenticationError:
            success = False
            yield "[Invalid API key]"
        except openai.RateLimitError:
            success = False
            yield "[Rate limit exceeded]"
        except Exception:
            success = False
            traceback.print_exc()
            yield "[Error fetching response]"
        finally:
            merchant_usage[merchant_id]["requests"] += 1
            merchant_logs[merchant_id].append(
                {
                    "session": session_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "user": user_message,
                    "assistant": full,
                }
            )
            if success:
                stats["success"] += 1
            else:
                stats["failure"] += 1

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route("/usage")
def usage_stats():
    usage_values = session_usage.values()
    total_chats = sum(u["requests"] for u in usage_values)
    monthly_messages = sum(u["tokens"] for u in usage_values)
    avg_messages = monthly_messages / max(total_chats, 1)
    success_rate = stats["success"] / max(stats["success"] + stats["failure"], 1)

    limits = {"free": 2000, "starter": 8000, "pro": float("inf")}
    merchants = {}
    for mid, data in merchant_usage.items():
        limit = limits.get(data["plan"].lower(), float("inf"))
        merchants[mid] = {
            "plan": data["plan"],
            "tokensUsed": data["tokens"],
            "tokenLimit": None if limit == float("inf") else limit,
            "month": data["month"],
        }

    return jsonify({
        "totalChats": total_chats,
        "monthlyMessages": monthly_messages,
        "avgMessages": avg_messages,
        "uniqueVisitors": len(stats["unique_visitors"]),
        "successRate": success_rate,
        "conversions": stats["conversions"],
        "merchants": merchants,
    })


@app.route("/config", methods=["GET", "POST"])
def config_route():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        config["welcome_message"] = data.get("welcomeMessage", config["welcome_message"])
        config["tone"] = data.get("tone", config["tone"])
        config["business_name"] = data.get("businessName", config["business_name"])
        config["store_type"] = data.get("storeType", config.get("store_type"))
        config["store_domain"] = data.get("storeDomain", config.get("store_domain"))
        config["store_api_key"] = data.get("storeApiKey", config.get("store_api_key"))
        config["product_endpoint"] = data.get("productEndpoint", config.get("product_endpoint"))
        return jsonify({"status": "ok"})
    return jsonify(config)


@app.route("/bot/<bot_name>", methods=["GET", "POST"])
def bot_route(bot_name):
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        welcome = data.get("welcomeMessage", "")
        save_welcome(bot_name, welcome)
        return jsonify({"status": "ok"})
    session_id = request.remote_addr
    sync_products_for_merchant(bot_name)
    suggestion = None
    if abandoned_cart_flags.get(session_id):
        suggestion = templates["abandoned_cart"] or "Did you forget something in your cart?"
        abandoned_cart_flags.pop(session_id)
    return jsonify({"welcomeMessage": get_welcome(bot_name), "suggestion": suggestion})


@app.route("/templates", methods=["GET", "POST"])
def templates_route():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        templates["welcome"] = data.get("welcome", templates["welcome"])
        templates["abandoned_cart"] = data.get("abandonedCart", templates["abandoned_cart"])
        templates["faq"] = data.get("faq", templates["faq"])
        return jsonify({"status": "ok"})
    return jsonify(templates)


@app.route("/faq", methods=["GET", "POST"])
def faq_route():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        q = data.get("question", "").strip()
        a = data.get("answer", "").strip()
        if q and a:
            add_faq(q, a)
        return jsonify({"status": "ok"})
    return jsonify(get_faqs())


@app.route("/conversion", methods=["POST"])
def conversion():
    stats["conversions"] += 1
    return jsonify({"status": "ok"})


@app.route("/checkout", methods=["POST"])
def checkout():
    session_id = request.remote_addr
    if session_id in abandoned_cart_flags:
        abandoned_cart_flags.pop(session_id)
    return jsonify({"status": "ok"})


@app.route("/bestsellers")
def bestsellers():
    if not (SHOPIFY_STOREFRONT_TOKEN and SHOPIFY_STORE_DOMAIN):
        return jsonify({"products": []})

    query = """
    {\n      products(first:3, sortKey:BEST_SELLING){\n        edges{\n          node{\n            title\n            totalInventory\n            images(first:1){edges{node{url}}}\n          }\n        }\n      }\n    }
    """
    try:
        resp = requests.post(
            f"https://{SHOPIFY_STORE_DOMAIN}/api/2024-04/graphql.json",
            json={"query": query},
            headers={
                "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        data = resp.json()
        products = []
        for edge in data.get("data", {}).get("products", {}).get("edges", []):
            node = edge.get("node", {})
            image = None
            imgs = node.get("images", {}).get("edges", [])
            if imgs:
                image = imgs[0].get("node", {}).get("url")
            products.append(
                {
                    "title": node.get("title"),
                    "inventory": node.get("totalInventory"),
                    "image": image,
                }
            )
        return jsonify({"products": products})
    except Exception:
        return jsonify({"products": []})


@app.route("/analytics", methods=["POST"])
def analytics():
    data = request.get_json(force=True) or {}
    merchant_id = data.get("merchantId")
    event = data.get("event")
    if not merchant_id or not event:
        return jsonify({"error": "invalid"}), 400
    analytics_events[merchant_id].append(
        {
            "timestamp": datetime.utcnow().isoformat(),
            "type": event,
            "details": data.get("details"),
        }
    )
    return jsonify({"status": "ok"})


@app.route("/log", methods=["GET", "POST"])
def log_event():
    """Simple event logger used by the widget."""
    event = request.args.get("event")
    if not event:
        return jsonify({"error": "event required"}), 400
    analytics_events[event].append(
        {
            "timestamp": datetime.utcnow().isoformat(),
            "ip": request.remote_addr,
        }
    )
    return jsonify({"status": "ok"})


@app.route("/errors", methods=["POST"])
def log_error():
    """Record frontend error reports."""
    data = request.get_json(force=True) or {}
    mid = current_user.id if current_user.is_authenticated else None
    with SessionLocal() as db:
        db.add(
            ErrorLog(
                merchant_id=mid,
                message=data.get("message"),
                stack_trace=data.get("stack"),
            )
        )
        db.commit()
    return jsonify({"status": "ok"})


@app.route("/errors", methods=["GET"])
@login_required
def get_errors():
    with SessionLocal() as db:
        logs = (
            db.query(ErrorLog)
            .filter_by(merchant_id=current_user.id)
            .order_by(ErrorLog.timestamp.desc())
            .all()
        )
    return jsonify(
        {
            "errors": [
                {
                    "message": l.message,
                    "stack": l.stack_trace,
                    "timestamp": l.timestamp.isoformat(),
                }
                for l in logs
            ]
        }
    )


@app.route("/merchant/usage")
@login_required
def get_merchant_usage():
    merchant_id = current_user.id
    data = merchant_usage.get(merchant_id, {"requests": 0, "tokens": 0, "plan": "free"})
    avg = data["tokens"] / data["requests"] if data["requests"] else 0
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        plan = (m.plan if m else data.get("plan", "free")).lower()
    limits = {"free": 2000, "starter": 8000, "pro": float("inf")}
    limit = limits.get(plan, float("inf"))
    return jsonify({
        "requests": data["requests"],
        "tokens": data["tokens"],
        "avgTokens": avg,
        "limit": None if limit == float("inf") else limit,
    })


@app.route('/merchant/logs')
@login_required
def get_merchant_logs():
    merchant_id = current_user.id
    return jsonify({
        "logs": [
            {
                "timestamp": "2025-07-21T14:30:00",
                "user": "How do I track my order?",
                "assistant": "You can track your order on the 'Track Order' page or via your email confirmation."
            },
            {
                "timestamp": "2025-07-21T14:32:00",
                "user": "Do you ship to Canada?",
                "assistant": "Yes, we ship to both the USA and Canada."
            }
        ]
    })

@app.route('/merchant/tips')
@login_required
def get_merchant_tips():
    merchant_id = current_user.id
    return jsonify({
        "tips": [
            "Add product badges to highlight bestsellers.",
            "Include more FAQs to reduce repetitive questions.",
            "Consider offering free shipping over $50 to boost cart size."
        ]
    })


@app.route("/merchant/suggestions")
@login_required
def merchant_suggestions():
    """Return AI-powered suggestions (dummy for now)."""
    merchant_id = current_user.id
    tips = [
        "Respond quickly to customer questions.",
        "Personalize messages with customer details.",
    ]
    return jsonify({"tips": tips})


@app.route("/merchant/dashboard")
@login_required
def merchant_dashboard():
    """Serve the merchant dashboard HTML."""
    return render_template("dashboard.html")


@app.route("/merchant/config")
@login_required
def merchant_config():
    """Return basic configuration for the logged in merchant."""
    merchant_id = current_user.id
    return jsonify(merchant_config_data(merchant_id))


@app.route("/merchant/config/<merchant_id>")
def merchant_config_public(merchant_id):
    """Public endpoint for the widget to fetch configuration."""
    return jsonify(merchant_config_data(merchant_id))


@app.route("/merchant/config", methods=["POST"])
@login_required
def merchant_config_save():
    """Save merchant configuration from the onboarding form."""
    data = request.get_json(force=True) or {}
    merchant_id = current_user.id
    merchant_configs[merchant_id] = {
        "cartUrl": data.get("cartUrl", ""),
        "checkoutUrl": data.get("checkoutUrl", ""),
        "contactUrl": data.get("contactUrl", ""),
    }
    save_welcome(merchant_id, data.get("welcomeGreeting", ""))
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        if m:
            m.store_type = data.get("storeType")
            m.store_domain = data.get("storeDomain")
            m.store_api_key = data.get("storeApiKey")
            m.shopify_domain = data.get("shopifyDomain")
            m.shopify_token = data.get("shopifyToken")
            if "suggestProducts" in data:
                m.suggest_products = 1 if data.get("suggestProducts") else 0
            m.product_endpoint = data.get("productEndpoint")
            m.product_sync_status = None
            db.commit()
            if m.store_type == "Custom HTML" and m.store_domain:
                sync_custom_html_products(merchant_id)
    return jsonify({"status": "ok"})


def sync_shopify_products(merchant_id: str):
    """Fetch product data from Shopify Storefront API."""
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        if not m or not m.shopify_domain or not m.shopify_token:
            return
        m.product_sync_status = "syncing"
        db.commit()
        products = []
        query = """
        { products(first:10) { edges { node { title description onlineStoreUrl images(first:1){edges{node{url}}} variants(first:1){edges{node{price{amount}}}} } } } }
        """
        try:
            resp = requests.post(
                f"https://{m.shopify_domain}/api/2023-10/graphql.json",
                json={"query": query},
                headers={
                    "X-Shopify-Storefront-Access-Token": m.shopify_token,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            data = resp.json()
            for edge in data.get("data", {}).get("products", {}).get("edges", []):
                node = edge.get("node", {})
                price = None
                var = node.get("variants", {}).get("edges", [])
                if var:
                    price = var[0].get("node", {}).get("price", {}).get("amount")
                img = node.get("images", {}).get("edges", [])
                img_url = None
                if img:
                    img_url = img[0].get("node", {}).get("url")
                products.append(
                    {
                        "title": node.get("title"),
                        "description": node.get("description"),
                        "price": price,
                        "link": node.get("onlineStoreUrl"),
                        "image_url": img_url,
                    }
                )
            db.query(Product).filter_by(merchant_id=merchant_id).delete()
            for p in products:
                db.add(
                    Product(
                        merchant_id=merchant_id,
                        title=p.get("title"),
                        description=p.get("description"),
                        price=p.get("price"),
                        image_url=p.get("image_url"),
                        url=p.get("link"),
                    )
                )
            m.product_sync_status = "success"
            m.product_last_synced = datetime.utcnow()
        except Exception:
            m.product_sync_status = "error"
        finally:
            db.commit()
            if m.store_type == "Custom HTML" and m.store_domain:
                sync_custom_html_products(merchant_id)
    return jsonify({"status": "ok"})


@app.route("/merchant/product-settings/<merchant_id>", methods=["GET", "POST"])
@login_required
def merchant_product_settings(merchant_id):
    """Save or fetch product awareness configuration."""
    if merchant_id != current_user.id:
        return jsonify({"error": "unauthorized"}), 403
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        with SessionLocal() as db:
            m = db.query(Merchant).get(merchant_id)
            if m:
                m.store_type = data.get("storeType")
                m.store_domain = data.get("storeDomain")
                m.store_api_key = data.get("apiKey")
                m.product_sync_status = None
                db.commit()
        return jsonify({"status": "ok"})
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        return jsonify(
            {
                "storeType": m.store_type if m else None,
                "storeDomain": m.store_domain if m else None,
                "apiKey": m.store_api_key if m else None,
            }
        )


@app.route("/merchant/bot-settings", methods=["GET", "POST"])
@login_required
def merchant_bot_settings():
    """Update or fetch basic bot customization settings."""
    merchant_id = current_user.id
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        with SessionLocal() as db:
            m = db.query(Merchant).get(merchant_id)
            if m:
                if "greeting" in data:
                    m.greeting = data.get("greeting")
                    save_welcome(merchant_id, m.greeting or "")
                if "color" in data:
                    m.color = data.get("color")
                if "suggestProducts" in data:
                    m.suggest_products = 1 if data.get("suggestProducts") else 0
                db.commit()
        return jsonify({"status": "ok"})
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        return jsonify(
            {
                "greeting": m.greeting if m else "",
                "color": m.color if m else "",
                "suggestProducts": bool(m.suggest_products) if m else False,
            }
        )


# Scrape products from store HTML

@app.route('/merchant/<merchant_id>/scrape-products', methods=['POST'])

@login_required

def scrape_products(merchant_id):

    """Manually scrape product data from the merchant store URL."""

    if merchant_id != current_user.id:

        return jsonify({'error': "unauthorized"}), 403

    with SessionLocal() as db:

        m = db.query(Merchant).get(merchant_id)

        if not m or not m.store_url:

            return jsonify({'error': "store-url-missing"}), 400

        try:

            resp = requests.get(m.store_url, timeout=10)

            soup = BeautifulSoup(resp.text, 'html.parser')

            items = _extract_products(soup, m.store_url)

            added = 0

            for item in items:

                url = item.get('url')

                if not url:

                    continue

                exists = (

                    db.query(Product)

                    .filter_by(merchant_id=merchant_id, url=url)

                    .first()

                )

                if exists:

                    continue

                db.add(

                    Product(

                        merchant_id=merchant_id,

                        title=item.get('title'),

                        description=item.get('description'),

                        price=item.get('price'),

                        image_url=item.get('image'),

                        url=url,

                    )

                )

                added += 1

            db.commit()

            return jsonify({'status': "ok", "count": added})

        except Exception:

            return jsonify({'error': "scrape_failed"}), 500


@app.route('/merchant/<merchant_id>/products', methods=['GET', 'POST'])
@login_required
def merchant_products(merchant_id):
    if merchant_id != current_user.id:
        return jsonify({"error": "unauthorized"}), 403
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        prods = db.query(Product).filter_by(merchant_id=merchant_id).all()
        return jsonify(
            {
                "products": [
                    {
                        "title": p.title,
                        "description": p.description,
                        "price": p.price,
                        "url": p.url,
                        "image": p.image_url,
                    }
                    for p in prods
                ],
                "syncStatus": m.product_sync_status if m else None,
                "lastUpdated": m.product_last_synced.isoformat()
                if m and m.product_last_synced
                else None,
            }
        )

@app.route('/products/<merchant_id>', methods=['POST'])
@login_required
def sync_products_endpoint(merchant_id):
    """Trigger product synchronization for the merchant."""
    if merchant_id != current_user.id:
        return jsonify({"error": "unauthorized"}), 403
    sync_products_by_type(merchant_id)
    with SessionLocal() as db:
        m = db.query(Merchant).get(merchant_id)
        prods = db.query(Product).filter_by(merchant_id=merchant_id).all()
        return jsonify(
            {
                "status": m.product_sync_status if m else None,
                "count": len(prods),
                "products": [
                    {
                        "title": p.title,
                        "description": p.description,
                        "price": p.price,
                        "url": p.url,
                        "image": p.image_url,
                    }
                    for p in prods
                ],
            }
        )


@app.route("/merchant/<merchant_id>/scrape-products", methods=["POST"])
@login_required
def scrape_products_route(merchant_id):
    if merchant_id != current_user.id:
        return jsonify({"error": "unauthorized"}), 403
    sync_products_for_merchant(merchant_id)
    with SessionLocal() as db:
        prods = db.query(Product).filter_by(merchant_id=merchant_id).all()
        return jsonify(
            {
                "products": [
                    {
                        "title": p.title,
                        "description": p.description,
                        "price": p.price,
                        "url": p.url,
                        "image": p.image_url,
                    }
                    for p in prods
                ]
            }
        )


@app.route("/products")
def products_public():
    """Return cached product info for the chat widget."""
    merchant_id = request.headers.get("x-merchant-id") or request.args.get("merchant_id")
    if not merchant_id:
        return jsonify({"products": []})
    with SessionLocal() as db:
        prods = db.query(Product).filter_by(merchant_id=merchant_id).all()
    return jsonify(
        {
            "products": [
                {
                    "name": p.title,
                    "price": p.price,
                    "url": p.url,
                    "image": p.image_url,
                }
                for p in prods
            ]
        }
    )


@app.route("/setup-widget")
def setup_widget():
    """Render merchant onboarding form."""
    return render_template("setup_widget.html")


@app.route("/onboarding")
def onboarding_page():
    """Serve the static onboarding guide with live demo."""
    public_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
    return send_from_directory(public_dir, "onboarding.html")


@app.route("/widget/seep-widget.js")
def widget_script():
    """Serve the embeddable chat widget script."""
    return send_from_directory(
        os.path.join(os.path.dirname(__file__), "static"),
        "seep-widget.js",
        mimetype="application/javascript",
    )


@app.route("/widget/seep-style.css")
def widget_style():
    """Serve the embeddable chat widget stylesheet."""
    return send_from_directory(
        os.path.join(os.path.dirname(__file__), "static"),
        "seep-style.css",
        mimetype="text/css",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
