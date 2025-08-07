# integrity/db.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class IntegrityEvent(Base):
    __tablename__ = "integrity_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    session_id = Column(String, index=True)
    event_type = Column(String, index=True)
    evidence = Column(Text)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    outcomes = relationship("FollowUpOutcome", back_populates="event")

class FollowUpOutcome(Base):
    __tablename__ = "followup_outcomes"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("integrity_events.id"))
    outcome = Column(Text)
    reviewer_id = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    event = relationship("IntegrityEvent", back_populates="outcomes")

# Database configuration and setup

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite+aiosqlite:///./integrity.db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with async_session() as session:
        yield session
