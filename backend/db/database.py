import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer
from sqlalchemy.orm import DeclarativeBase, sessionmaker

engine = create_engine("sqlite:///./docflow.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    doc_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    summary = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    size_bytes = Column(Integer, nullable=False)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
