# SEEP Global AI Sales Assistant

This project contains a simple Flask backend and React frontend for an e-commerce chat assistant powered by OpenRouter's DeepSeek model.

## Backend
- Located in `backend/app.py`.
- Reads `OPENROUTER_API_KEY` from `.env` to access OpenRouter.
- `/chat` endpoint streams responses from the model.
- Tracks usage per merchant with monthly token caps tied to their subscription plan.
 - Plans are **Start**, **Growth**, and **Elite** with increasing token limits.

Copy `.env.template` to `.env` and set the following variables before starting the server:

```
SECRET_KEY=your-secret-key
ADMIN_PASSWORD=strong-admin-pass
OPENROUTER_API_KEY=your-openrouter-key
CORS_ORIGINS=https://your-frontend-domain
```

Install dependencies and run with:
```bash
pip install -r backend/requirements.txt
python backend/app.py
```

## Frontend
- Located in `frontend/` using Vite + React.
- `npm install` then `npm run dev` to start the dev server.
- Set `VITE_API_BASE` in a `.env` file to your backend URL (defaults to `http://localhost:5000` for development).

Chat history and settings are kept in the browser's local storage.

To embed the assistant on any page, include the widget script served by the backend:

```html
<script src="https://your-server.com/widget/seep-widget.js" data-merchant-id="YOUR_ID"></script>
```

This script automatically fetches the configuration and displays a chat bubble that communicates with the `/chat` endpoint.

## Product Awareness UI

The merchant dashboard now includes a **Product Awareness** tab. From this tab you can either connect your store's API or allow the bot to scan your public site:

1. **API Connection** – Choose Shopify or WooCommerce and enter your API key (and secret for WooCommerce) along with your store URL. Save the settings and click **Refresh Products** to cache product data.
2. **Structured HTML** – Select "Structured HTML" to let the backend crawl your site starting from the store or cart URL. Product information in schema.org or Open Graph format will be detected automatically.

After syncing, cached products are shown along with sync status and last updated time.

A **Synced Products** section lists the cached products with thumbnails, price, short descriptions and a **Sync Products** button to trigger scraping again.

A new **Customize Bot** tab lets you update the welcome greeting, choose the
widget colour and toggle product suggestions. Changes are persisted to your
merchant account and are picked up by the chat widget automatically.

### Updating the database

Schema changes may lead to errors such as `no such column` if an old
`bots.db` file is present. Run the helper script below to remove the
database, recreate all tables and seed a `test-merchant` account:

```bash
python reset_db.py
```
