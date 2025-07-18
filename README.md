# SEEP Global AI Sales Assistant

This project contains a simple Flask backend and React frontend for an e-commerce chat assistant powered by OpenRouter's DeepSeek model.

## Backend
- Located in `backend/app.py`.
- Reads `OPENROUTER_API_KEY` from `.env` to access OpenRouter.
- `/chat` endpoint streams responses from the model.
- Tracks usage per merchant with monthly token limits based on plan
  (Free: 2000 tokens, Starter: 8000 tokens, Pro: unlimited).

Install dependencies and run with:
```bash
pip install -r backend/requirements.txt
python backend/app.py
```

## Frontend
- Located in `frontend/` using Vite + React.
- `npm install` then `npm run dev` to start the dev server.
- Proxy rules are defined in `frontend/vite.config.js` so API calls reach `localhost:5000`.

Chat history and settings are kept in the browser's local storage.

To embed the assistant on any page, include the widget script served by the backend:

```html
<script src="https://your-server.com/widget/seep-widget.js" data-merchant-id="YOUR_ID"></script>
```

This script automatically fetches the configuration and displays a chat bubble that communicates with the `/chat` endpoint.
