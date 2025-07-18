import os
import traceback
from collections import defaultdict
from flask import Flask, request, jsonify, Response, stream_with_context
import sqlite3
from flask_cors import CORS
import openai
from dotenv import load_dotenv
import requests

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "deepseek/deepseek-chat-v3-0324:free"
TOKEN_LIMIT = 2000

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'bots.db')


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bots (name TEXT PRIMARY KEY, welcome_message TEXT)"
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

session_usage = defaultdict(lambda: {"requests": 0, "tokens": 0})
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
    if usage["tokens"] >= TOKEN_LIMIT:
        stats["failure"] += 1
        return jsonify({"error": "limit", "message": "You\u2019ve hit your free usage limit. Upgrade to continue."}), 402

    if not API_KEY:
        stats["failure"] += 1
        return jsonify({"error": "server_config", "message": "OpenRouter API key missing"}), 500

    data = request.get_json(force=True) or {}
    user_message = data.get("message", "")
    usage["requests"] += 1

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
            usage["tokens"] += len(full.split())
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
    return jsonify({
        "totalChats": total_chats,
        "monthlyMessages": monthly_messages,
        "avgMessages": avg_messages,
        "uniqueVisitors": len(stats["unique_visitors"]),
        "successRate": success_rate,
        "conversions": stats["conversions"],
        "plan": "Free Tier",
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
    return jsonify({"welcomeMessage": get_welcome(bot_name)})


@app.route("/templates", methods=["GET", "POST"])
def templates_route():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        templates["welcome"] = data.get("welcome", templates["welcome"])
        templates["abandoned_cart"] = data.get("abandonedCart", templates["abandoned_cart"])
        templates["faq"] = data.get("faq", templates["faq"])
        return jsonify({"status": "ok"})
    return jsonify(templates)


@app.route("/conversion", methods=["POST"])
def conversion():
    stats["conversions"] += 1
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
