# Application Sequence Diagrams

This document contains sequence diagrams illustrating the key workflows in the Office Portal application.

---

## 1. Audio Transcription & Minutes Generation Workflow

This diagram shows the end-to-end process from a user uploading an audio file to generating meeting minutes. It involves all major components of the architecture: the frontend, the API backend, the database, the Redis message queue, the Celery worker for heavy lifting, and the external Gemini API.

```mermaid
sequenceDiagram
    participant User
    participant React Frontend
    participant FastAPI Backend
    participant Redis
    participant Celery Worker
    participant PostgreSQL DB
    participant Gemini API

    User->>React Frontend: 1. Uploads Audio File & Meeting Info
    React Frontend->>FastAPI Backend: 2. POST /api/transcribe (file, meeting_name)

    activate FastAPI Backend
    FastAPI Backend->>PostgreSQL DB: 3. Create TranscriptionJob (status: PENDING)
    PostgreSQL DB-->>FastAPI Backend: 4. Returns Job ID
    FastAPI Backend->>FastAPI Backend: 5. Saves audio file to /uploads
    FastAPI Backend->>Redis: 6. transcribe_audio_task.delay(job_id, file_path)
    FastAPI Backend-->>React Frontend: 7. Returns Job Info (status: PENDING)
    deactivate FastAPI Backend

    activate Celery Worker
    Celery Worker->>Redis: 8. Fetches transcription task
    Celery Worker->>PostgreSQL DB: 9. Update Job (status: PROCESSING, text: "Splitting audio...")
    Celery Worker->>Celery Worker: 10. Chunks audio with FFmpeg

    loop For each audio chunk
        Celery Worker->>PostgreSQL DB: 11. Update Job (progress_percent)
        Celery Worker->>Gemini API: 12. Upload audio chunk
        Gemini API-->>Celery Worker: 13. Returns file URI
        Celery Worker->>Gemini API: 14. Request transcription for chunk URI
        Gemini API-->>Celery Worker: 15. Returns chunk transcript
        Celery Worker->>PostgreSQL DB: 16. Append transcript to Job record
        Celery Worker->>Gemini API: 17. Delete chunk file from Gemini
    end

    Celery Worker->>PostgreSQL DB: 18. Update Job (status: COMPLETED)
    deactivate Celery Worker

    User->>React Frontend: 19. Requests to generate minutes
    React Frontend->>FastAPI Backend: 20. POST /api/transcriptions/{id}/generate-minutes
    activate FastAPI Backend
    FastAPI Backend->>PostgreSQL DB: 21. Get full transcript from Job record
    FastAPI Backend->>Redis: 22. generate_minutes_task.delay(job_id, transcript)
    FastAPI Backend-->>React Frontend: 23. Returns 202 Accepted
    deactivate FastAPI Backend

    activate Celery Worker
    Celery Worker->>Redis: 24. Fetches minutes generation task
    Celery Worker->>PostgreSQL DB: 25. Update Job (status: PROCESSING, text: "Generating minutes...")
    Celery Worker->>Gemini API: 26. Send transcript with summarization prompt
    Gemini API-->>Celery Worker: 27. Returns generated minutes
    Celery Worker->>PostgreSQL DB: 28. Save minutes to Job record, update status to COMPLETED
    deactivate Celery Worker

    loop Poll for status
        User->>React Frontend: Periodically checks status
        React Frontend->>FastAPI Backend: GET /api/transcribe/status/{id}
        FastAPI Backend->>PostgreSQL DB: Read Job status & results
        PostgreSQL DB-->>FastAPI Backend: Return Job data
        FastAPI Backend-->>React Frontend: Return final transcript & minutes
    end
```

---

## 2. Document Ingestion & RAG Chat Workflow

This diagram illustrates the two core parts of the RAG (Retrieval-Augmented Generation) system: ingesting a new document and using the knowledge base in a chat conversation.

```mermaid
sequenceDiagram
    participant User
    participant React Frontend
    participant FastAPI Backend
    participant "FastAPI BackgroundTasks" as BGTasks
    participant PostgreSQL DB
    participant Gemini API

    %% Ingestion Flow
    User->>React Frontend: 1. Uploads Document (e.g., PDF)
    React Frontend->>FastAPI Backend: 2. POST /api/ingest (file)

    activate FastAPI Backend
    FastAPI Backend->>PostgreSQL DB: 3. Create Document record (status: PENDING)
    PostgreSQL DB-->>FastAPI Backend: 4. Returns Document ID
    FastAPI Backend->>FastAPI Backend: 5. Saves file to temporary path
    FastAPI Backend->>BGTasks: 6. add_task(ingest_document_pipeline, doc_id, path)
    FastAPI Backend-->>React Frontend: 7. Returns 202 Accepted
    deactivate FastAPI Backend

    activate BGTasks
    BGTasks->>BGTasks: 8. Reads & Chunks Text from file
    BGTasks->>Gemini API: 9. Request embeddings for chunks
    Gemini API-->>BGTasks: 10. Returns embeddings
    BGTasks->>PostgreSQL DB: 11. bulk_save(DocumentChunks with embeddings)
    BGTasks->>PostgreSQL DB: 12. Update Document (status: COMPLETED)
    deactivate BGTasks


    %% Chat Flow
    User->>React Frontend: 13. Sends a chat message
    React Frontend->>FastAPI Backend: 14. POST /chat (message)

    activate FastAPI Backend
    FastAPI Backend->>Gemini API: 15. Generate embedding for user message
    Gemini API-->>FastAPI Backend: 16. Returns query vector
    FastAPI Backend->>PostgreSQL DB: 17. Vector Search for relevant chunks (using pgvector)
    PostgreSQL DB-->>FastAPI Backend: 18. Returns context chunks
    FastAPI Backend->>Gemini API: 19. Send prompt (query + history + context)
    Gemini API-->>FastAPI Backend: 20. Returns generated response
    FastAPI Backend->>PostgreSQL DB: 21. Save user & AI messages to history
    FastAPI Backend-->>React Frontend: 22. Streams response back to user
    deactivate FastAPI Backend
```
