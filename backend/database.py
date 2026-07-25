from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker
import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/trustsync")

# In case running locally without docker, fallback to sqlite
if not os.getenv("DATABASE_URL"):
    DATABASE_URL = "sqlite:///./trustsync.db"

# Create engine (sqlite requires check_same_thread=False)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class WebhookTransaction(Base):
    __tablename__ = "webhook_transactions"
    id = Column(Integer, primary_key=True, index=True)
    target_url = Column(String)
    merchant_id = Column(String)
    amount = Column(Float, default=0.0)
    status = Column(String) # 'delivered', 'failed_but_queued', 'queued' (by AI)
    ai_intervened = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(String)
    type = Column(String) # 'info', 'warning', 'error', 'success'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class IdempotencyKey(Base):
    """Tracks unique payment keys to prevent duplicate webhook delivery."""
    __tablename__ = "idempotency_keys"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, nullable=False, index=True)
    merchant_id = Column(String, nullable=False)
    target_url = Column(String)
    status = Column(String, default="accepted")  # 'accepted' | 'duplicate_blocked'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MerchantBudget(Base):
    """Tracks per-merchant retry counts and pause state within a rolling window."""
    __tablename__ = "merchant_budgets"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(String, unique=True, nullable=False, index=True)
    retry_count = Column(Integer, default=0)
    window_start = Column(DateTime, default=datetime.datetime.utcnow)
    is_paused = Column(Boolean, default=False)
    paused_reason = Column(String, nullable=True)
    paused_at = Column(DateTime, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
