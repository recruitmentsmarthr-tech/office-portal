import os
import unicodedata
import requests
from typing import List, Optional

from sqlalchemy.orm import Session
from models import Chat, ChatMessage, DocumentChunk

def get_or_create_chat(
    user_id: int, db: Session, session_id: Optional[int] = None
) -> Chat:
    """Gets a specific chat for a user, or creates a new one if session_id is None or not found."""
    if session_id:
        chat = (
            db.query(Chat)
            .filter(Chat.id == session_id, Chat.user_id == user_id)
            .first()
        )
        if chat:
            return chat
    new_chat = Chat(user_id=user_id)
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

def save_message(chat_id: int, role: str, content: str, db: Session) -> ChatMessage:
    """Saves a message to the chat history."""
    message = ChatMessage(chat_id=chat_id, role=role, content=content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_chat_history(chat_id: int, db: Session, limit: int = 10) -> List[ChatMessage]:
    """Retrieves the most recent messages for a given chat, newest first."""
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )

def normalize_text(text: str) -> str:
    """Converts text to Unicode Normalization Form C (NFC)."""
    if not isinstance(text, str):
        return ""
    return unicodedata.normalize("NFC", text)

def generate_embedding(text: str) -> List[float]:
    """Generates an embedding for a single user query using Google's REST API."""
    if not text.strip():
        return []

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found in environment variables.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    body = {
        "model": "models/gemini-embedding-001",
        "taskType": "RETRIEVAL_QUERY",
        "content": {
            "parts": [{"text": text}]
        },
        "output_dimensionality": 768
    }

    try:
        response = requests.post(url, headers=headers, json=body, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get('embedding', {}).get('values', [])
    except requests.exceptions.RequestException as e:
        print(f"Error calling Gemini embedding API: {e}")
        raise

def perform_vector_search(
    query_embedding: List[float], db: Session, top_k: int = 5
) -> List[DocumentChunk]:
    """Performs a vector similarity search using L2 distance."""
    if not query_embedding:
        return []
    
    results = (
        db.query(DocumentChunk)
        .order_by(DocumentChunk.embedding.l2_distance(query_embedding))
        .limit(top_k)
        .all()
    )
    return results

def construct_llm_prompt(
    user_query: str, retrieved_chunks: List[DocumentChunk], chat_history: List[ChatMessage]
) -> str:
    """Assembles a structured prompt for the Gemini LLM."""
    context_str = "\n---\n".join(
        [f"Source: {chunk.document.filename}, Chunk {chunk.chunk_metadata.get('chunk_number', 'N/A')}\n{chunk.content}" for chunk in retrieved_chunks]
    )
    history_str = "\n".join(
        [f"{msg.role}: {msg.content}" for msg in reversed(chat_history)]
    )
    prompt = f"""
System Preamble: You are a helpful and precise HR assistant for an internal company portal. Your role is to answer user questions based *only* on the provided context from internal documents. If the answer is not found in the context, state that clearly. Do not use outside knowledge.
---
**Chat History:**
{history_str}
---
**Retrieved Document Context:**
{context_str}
---
**User's Current Question:**
{user_query}

**Your Answer:**
"""
    return prompt

def get_llm_response(prompt: str) -> str:
    """Generates a response from the Gemini 1.5 Flash model using the REST API."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found in environment variables.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    body = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        ]
    }

    try:
        response = requests.post(url, headers=headers, json=body, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('candidates'):
            return "Response was blocked due to safety settings or other reasons."
            
        return data['candidates'][0]['content']['parts'][0]['text']
    except requests.exceptions.RequestException as e:
        print(f"Error during Gemini API call: {e}")
        return f"Error: Could not get a response from the AI model. Details: {str(e)}"

