import os
import traceback
from collections import defaultdict
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import openai
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "deepseek/deepseek-chat-v3-0324:free"
TOKEN_LIMIT = 2000

app = Flask(__name__)
CORS(app)

session_usage = defaultdict(lambda: {"requests": 0, "tokens": 0})


def get_client():
    return openai.OpenAI(api_key=API_KEY, base_url="https://openrouter.ai/api/v1")


@app.route("/chat", methods=["POST"])
def chat():
    session_id = request.remote_addr
    usage = session_usage[session_id]
    if usage["tokens"] >= TOKEN_LIMIT:
        return jsonify({"error": "limit", "message": "You\u2019ve hit your free usage limit. Upgrade to continue."}), 402

    if not API_KEY:
        return jsonify({"error": "server_config", "message": "OpenRouter API key missing"}), 500

    data = request.get_json(force=True) or {}
    user_message = data.get("message", "")
    usage["requests"] += 1

    def generate():
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
            yield "[Invalid API key]"
        except openai.RateLimitError:
            yield "[Rate limit exceeded]"
        except Exception:
            traceback.print_exc()
            yield "[Error fetching response]"

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route("/usage")
def usage_stats():
    return jsonify(session_usage)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
