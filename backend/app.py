import os
import traceback
from collections import defaultdict
from flask import Flask, request, jsonify, Response, stream_with_context
import sqlite3
from flask_cors import CORS
import openai
from dotenv import load_dotenv
import requests
import difflib
from datetime import datetime

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "deepseek/deepseek-chat-v3-0324:free"

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'bots.db')


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bots (name TEXT PRIMARY KEY, welcome_message TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT UNIQUE, answer TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS usage (user TEXT, month TEXT, tokens INTEGER DEFAULT 0, plan TEXT DEFAULT 'Free', PRIMARY KEY(user, month))"
    )
    conn.commit()
    conn.close()


init_db()

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


def get_user_usage_record(user: str):
    month = datetime.utcnow().strftime("%Y-%m")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT tokens, plan, month FROM usage WHERE user=? AND month=?",
        (user, month),
    )
    row = cur.fetchone()
    if not row:
        conn.execute(
            "INSERT OR REPLACE INTO usage (user, month, tokens, plan) VALUES (?, ?, 0, 'Free')",
            (user, month),
        )
        conn.commit()
        conn.close()
        return {"tokens": 0, "plan": "Free"}
    conn.close()
    return {"tokens": row[0], "plan": row[1]}


def add_user_tokens(user: str, amount: int):
    month = datetime.utcnow().strftime("%Y-%m")
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO usage (user, month, tokens, plan) VALUES (?, ?, ?, 'Free')"
        " ON CONFLICT(user, month) DO UPDATE SET tokens=tokens + excluded.tokens",
        (user, month, amount),
    )
    conn.commit()
    conn.close()

session_usage = defaultdict(lambda: {"requests": 0, "tokens": 0})
# Track sessions that mentioned the cart but didn't checkout
abandoned_cart_flags = defaultdict(bool)
# In-memory store for configuration and extended stats
config = {"welcome_message": "", "tone": "Friendly", "business_name": ""}
templates = {"welcome": "", "abandoned_cart": "", "faq": ""}
SHOPIFY_STOREFRONT_TOKEN = os.getenv("SHOPIFY_STOREFRONT_TOKEN")
SHOPIFY_STORE_DOMAIN = os.getenv("SHOPIFY_STORE_DOMAIN")
stats = {
    "unique_visitors": set(),
    "success": 0,
    "failure": 0,
    "conversions": 0,
}


def get_client():
    return openai.OpenAI(api_key=API_KEY, base_url="https://openrouter.ai/api/v1")


@app.route("/chat", methods=["POST"])
def chat():
    session_id = request.remote_addr
    usage = session_usage[session_id]
    stats["unique_visitors"].add(session_id)
    user_record = get_user_usage_record(session_id)
    limit = 5000 if user_record["plan"] == "Premium" else 500
    if user_record["tokens"] >= limit:
        stats["failure"] += 1
        return jsonify({"error": "limit", "message": "You\u2019ve hit your plan usage limit."}), 402

    if not API_KEY:
        stats["failure"] += 1
        return jsonify({"error": "server_config", "message": "OpenRouter API key missing"}), 500

    data = request.get_json(force=True) or {}
    user_message = data.get("message", "")
    usage["requests"] += 1

    # If the user mentions cart/checkout keywords, flag session
    lower = user_message.lower()
    keywords = ["cart", "checkout", "left item", "left in cart", "forgot"]
    if any(k in lower for k in keywords):
        abandoned_cart_flags[session_id] = True

    # Check stored FAQs before calling the LLM
    for faq in get_faqs():
        ratio = difflib.SequenceMatcher(None, lower, faq["question"].lower()).ratio()
        if ratio > 0.6:
            def gen():
                usage["tokens"] += len(faq["answer"].split())
                stats["success"] += 1
                yield faq["answer"]

            return Response(stream_with_context(gen()), mimetype="text/plain")

    def generate():
        success = True
        try:
            client = get_client()
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are Seep, a smart and helpful assistant."},
                    {"role": "user", "content": user_message},
                ],
                stream=True,
            )
            full = ""
            for chunk in response:
                token = chunk.choices[0].delta.content or ""
                full += token
                yield token
            token_count = len(full.split())
            usage["tokens"] += token_count
            add_user_tokens(session_id, token_count)
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
    user_id = request.remote_addr
    record = get_user_usage_record(user_id)
    limit = 5000 if record["plan"] == "Premium" else 500
    return jsonify({
        "totalChats": total_chats,
        "monthlyMessages": monthly_messages,
        "avgMessages": avg_messages,
        "uniqueVisitors": len(stats["unique_visitors"]),
        "successRate": success_rate,
        "conversions": stats["conversions"],
        "plan": record["plan"],
        "tokensUsed": record["tokens"],
        "tokenLimit": limit,
    })


@app.route("/config", methods=["GET", "POST"])
def config_route():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        config["welcome_message"] = data.get("welcomeMessage", config["welcome_message"])
        config["tone"] = data.get("tone", config["tone"])
        config["business_name"] = data.get("businessName", config["business_name"])
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


if __name__ == "__main__":
    app.run(port=5000, debug=True)
