import os
import sys
import sqlite3
import uuid
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

# Ensure we can import modules from the backend folder
BASE_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.append(BACKEND_DIR)

from models import DB_PATH, init_db, SessionLocal, Merchant, Plan, Subscription


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


def add_default_merchant():
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
                suggest_products=1,
            )
            db.add(m)
            db.commit()
            plan = db.query(Plan).filter_by(name='start').first()
            if plan:
                sub = Subscription(
                    merchant_id=m.id,
                    plan_id=plan.id,
                    start_date=datetime.utcnow(),
                    trial_end=datetime.utcnow() + timedelta(days=7),
                    next_bill_date=datetime.utcnow() + timedelta(days=7),
                    stripe_subscription_id=None,
                )
                db.add(sub)
                db.commit()


def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    init_sqlite_tables()
    add_default_merchant()
    print(f"Database reset complete. New database at {DB_PATH}")


if __name__ == "__main__":
    main()
