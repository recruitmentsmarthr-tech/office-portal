import os
import re
import requests
import unicodedata
from typing import List

from pypdf import PdfReader
from sqlalchemy.orm import Session

from models import Document, DocumentChunk, DocumentStatus
from dotenv import load_dotenv

load_dotenv()

# 1. CLEANING FUNCTION
def clean_text(text):
    if not text:
        return ""
    # Remove null bytes or non-printable characters
    text = text.replace('\x00', '')
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    # Strip leading/trailing whitespace
    return text.strip()

# 2. SPLIT FUNCTION
def split_text(text, chunk_size=1000, overlap=100):
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunks.append(text[start:end])
        if end == text_len: break
        start += (chunk_size - overlap)
    return chunks

# 3. EMBEDDING GENERATOR
def generate_embeddings(chunks):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not found")

    # Filter garbage
    valid_chunks = [c for c in chunks if c and c.strip()]
    
    if not valid_chunks:
        print("DEBUG: No valid chunks to embed.")
        return [], []

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={api_key}"
    all_embeddings = []
    
    # Process in batches of 100
    BATCH_SIZE = 100
    
    for i in range(0, len(valid_chunks), BATCH_SIZE):
        batch = valid_chunks[i : i + BATCH_SIZE]
        payload = {
            "requests": [
                {
                    "model": "models/gemini-embedding-001",
                    "taskType": "RETRIEVAL_DOCUMENT",
                    "title": "Handbook Chunk",
                    "content": {"parts": [{"text": chunk}]},
                    "output_dimensionality": 768
                } for chunk in batch
            ]
        }

        try:
            print(f"DEBUG: Sending clean batch {i} to {i + len(batch)}...")
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
            
            if response.status_code != 200:
                print(f"CRITICAL ERROR: {response.text}")
                response.raise_for_status()
            
            batch_embeddings = [item['values'] for item in response.json()['embeddings']]
            all_embeddings.extend(batch_embeddings)
            
        except Exception as e:
            print(f"Error in batch {i}: {e}")
            raise e

    return all_embeddings, valid_chunks

def extract_text_from_pdf(file_path: str) -> str:
    """Extracts text from a PDF file."""
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text

def ingest_document_pipeline(document_id: int, file_path: str, db: Session):
    """
    Orchestrates the document ingestion process:
    Parses, normalizes, chunks, embeds, and stores in the database.
    """
    document = None
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document with ID {document_id} not found.")
        document.status = DocumentStatus.INDEXING
        db.commit()

        raw_text = extract_text_from_pdf(file_path)
        
        # APPLY CLEANING
        cleaned_text = clean_text(raw_text)
        
        chunks = split_text(cleaned_text)
        
        if not chunks:
            print(f"Warning: Document {document_id} resulted in no text chunks after cleaning and splitting.")
            document.status = DocumentStatus.COMPLETED
            db.commit()
            return

        embeddings, valid_chunks = generate_embeddings(chunks)

        if not embeddings:
            print(f"Warning: No embeddings were generated for document {document_id}.")
            document.status = DocumentStatus.COMPLETED
            db.commit()
            return
            
        new_chunks = []
        for i, chunk_content in enumerate(valid_chunks):
            new_chunk = DocumentChunk(
                document_id=document.id,
                content=chunk_content,
                embedding=embeddings[i],
                chunk_metadata={"chunk_number": i, "filename": document.filename},
            )
            new_chunks.append(new_chunk)
        db.bulk_save_objects(new_chunks)
        db.commit()

        document.status = DocumentStatus.COMPLETED
        db.commit()
        print(f"Document {document_id} ingested successfully with {len(new_chunks)} chunks.")

    except Exception as e:
        print(f"Error ingesting document {document_id}: {e}")
        if document:
            document.status = DocumentStatus.FAILED
            db.commit()
        raise
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)