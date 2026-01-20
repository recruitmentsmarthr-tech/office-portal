from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    JSON,
    DateTime,
    Text,
    Enum as SAEnum,
    Boolean,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import enum

Base = declarative_base()


# --- RAG & Memory Schema ---
class DocumentStatus(enum.Enum):
    PENDING = "PENDING"
    INDEXING = "INDEXING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(SAEnum(DocumentStatus), nullable=False, default=DocumentStatus.PENDING)
    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    # Dimension for models/text-embedding-004
    embedding = Column(Vector(768))
    chunk_metadata = Column(JSON)
    document = relationship("Document", back_populates="chunks")


class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_deleted = Column(Boolean, default=False, nullable=False, server_default="false")
    messages = relationship(
        "ChatMessage", back_populates="chat", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    # 'user' or 'assistant'
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    chat = relationship("Chat", back_populates="messages")
    feedback = relationship("MessageFeedback", back_populates="message", uselist=False)


class MessageFeedback(Base):
    __tablename__ = "message_feedback"
    id = Column(Integer, primary_key=True)
    message_id = Column(
        Integer, ForeignKey("chat_messages.id"), nullable=False, unique=True
    )
    # e.g., 'good', 'bad', 'incorrect'
    rating = Column(String)
    correction = Column(Text)
    message = relationship("ChatMessage", back_populates="feedback")


# --- Existing User/Role Models ---
class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    permissions = relationship(
        "Permission", secondary="role_permissions", back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    roles = relationship(
        "Role", secondary="role_permissions", back_populates="permissions"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id"), primary_key=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role")
