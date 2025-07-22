import os
import uuid
from datetime import datetime

from sqlalchemy import (

    create_engine,

    Column,

    Integer,

    String,

    DateTime,

    Text,

    ForeignKey,

    UniqueConstraint,

)

from sqlalchemy.orm import declarative_base, sessionmaker
from flask_login import UserMixin

DB_PATH = os.path.join(os.path.dirname(__file__), 'bots.db')

engine = create_engine(f'sqlite:///{DB_PATH}', connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Merchant(UserMixin, Base):
    __tablename__ = 'merchants'
    id = Column(String, primary_key=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    plan = Column(String, default='free')
    color = Column(String)
    greeting = Column(Text)
    cart_url = Column(String)
    checkout_url = Column(String)
    contact_url = Column(String)
    api_key = Column(String, unique=True)
    api_secret = Column(String)
    store_type = Column(String)
    store_domain = Column(String)
    store_api_key = Column(String)
    product_endpoint = Column(String)
    product_sync_status = Column(String)
    product_last_synced = Column(DateTime)
    # New fields for product awareness configuration
    product_method = Column(String)
    api_type = Column(String)
    store_url = Column(String)
    # Shopify specific fields
    shopify_domain = Column(String)
    shopify_token = Column(String)
    # Enable product suggestions feature
    suggest_products = Column(Integer, default=1)


class Product(Base):

    __tablename__ = "merchant_products"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    merchant_id = Column(String, ForeignKey("merchants.id"))

    title = Column(String)

    description = Column(Text)

    price = Column(String)

    image_url = Column(String)

    url = Column(String)

    scraped_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("merchant_id", "url", name="uq_merchant_url"),
    )

class MerchantUsage(Base):
    __tablename__ = 'merchant_usage'
    id = Column(Integer, primary_key=True)
    merchant_id = Column(String, ForeignKey('merchants.id'))
    month = Column(String)
    tokens = Column(Integer, default=0)
    requests = Column(Integer, default=0)

class MerchantLog(Base):
    __tablename__ = 'merchant_logs'
    id = Column(Integer, primary_key=True)
    merchant_id = Column(String, ForeignKey('merchants.id'))
    session = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = Column(Text)
    assistant = Column(Text)

class AnalyticsEvent(Base):
    __tablename__ = 'analytics_events'
    id = Column(Integer, primary_key=True)
    merchant_id = Column(String, ForeignKey('merchants.id'))
    timestamp = Column(DateTime, default=datetime.utcnow)
    type = Column(String)
    details = Column(Text)

def init_db():
    Base.metadata.create_all(bind=engine)

