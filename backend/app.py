from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import openai
import traceback
import os
import time

app = Flask(__name__)
CORS(app)

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "deepseek/deepseek-chat-v3-0324:free"

print("API Key loaded:", bool(API_KEY))

client = openai.OpenAI(
    api_key=API_KEY,
    base_url="https://openrouter.ai/api/v1"
)

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        user_input = data.get("message", "")
        print(f"Received input: {user_input}")

        response = client.chat.completions.create(
            model="deepseek/deepseek-chat-v3-0324:free",
            messages=[
                {"role": "system", "content": "You are Seep, a smart and helpful assistant."},
                {"role": "user", "content": user_input}
            ]
        )

        print("🟢 Raw AI response:", response)

        if hasattr(response, "choices") and response.choices:
            ai_message = response.choices[0].message.content.strip()
            print(f"🟡 Extracted message: {ai_message}")
            return jsonify({"message": ai_message})
        else:
            print("🔴 No 'choices' in response!")
            return jsonify({"error": "No valid response from AI"}), 500

    except Exception as e:
        print("🔥 ERROR OCCURRED 🔥")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/chat-stream", methods=["POST"])
def chat_stream():
    try:
        data = request.get_json(force=True)
        user_input = data.get("message", "")

        def generate():
            # Replace with your streaming logic
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You are Seep, a smart and helpful assistant."},
                    {"role": "user", "content": user_input}
                ]
            )
            if hasattr(response, "choices") and response.choices:
                for token in response.choices[0].message.content.split():
                    yield token + " "
            else:
                yield "No valid response from AI."

        return Response(stream_with_context(generate()), mimetype="text/plain")
    except Exception as e:
        print("🔥 ERROR OCCURRED IN STREAMING 🔥")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/chat")
def chat_sse():
    user_message = request.args.get("message", "")
    def event_stream():
        # Replace this with your actual AI streaming logic
        reply = f"Echo: {user_message}"
        for word in reply.split():
            yield f"data: {word} \n\n"
            time.sleep(0.3)
        yield "event: end\ndata: \n\n"
    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")

if __name__ == "__main__":
    app.run(port=5000, debug=True)