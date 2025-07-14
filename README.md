# SEEP Global AI Sales Assistant

This project contains a simple Flask backend and React frontend for an e-commerce chat assistant powered by OpenRouter's DeepSeek model.

## Backend
- Located in `backend/app.py`.
- Reads `OPENROUTER_API_KEY` from `.env` to access OpenRouter.
- `/chat` endpoint streams responses from the model.
- Basic in-memory usage tracking and token cap (2000 tokens per session).

Run with:
```bash
python backend/app.py
```

## Frontend
- Located in `frontend/` using Vite + React.
- `npm install` then `npm run dev` to start the dev server.
- Proxy is configured to forward API calls to `localhost:5000`.

Chat history and settings are kept in session storage.
