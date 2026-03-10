# Technology Stack Overview

This document provides a high-level overview of the technologies and tools used in the Office Portal application.

| Category                | Technology                    | Description/Purpose                                                                   |
| :---------------------- | :---------------------------- | :------------------------------------------------------------------------------------ |
| **Frontend**            | React                         | User interface development; responsible for all client-side interactions.             |
| **Backend Framework**   | FastAPI (Python)              | High-performance web framework for building APIs; handles core application logic.     |
| **Database**            | PostgreSQL with `pgvector`    | Primary database for relational data (users, documents) and vector embeddings.        |
| **Message Broker**      | Redis                         | In-memory data store used as a message broker for Celery and caching.                 |
| **Task Queue**          | Celery                        | Distributed task queue for asynchronous and long-running background jobs.             |
| **AI/LLM**              | Google Gemini API             | Provides AI capabilities for text embeddings (`gemini-embedding-001`) and generation (`gemini-2.5-flash`). |
| **Audio Processing**    | FFmpeg                        | Command-line tool used within Celery tasks for audio file manipulation and chunking. |
| **Containerization**    | Docker, Docker Compose        | For packaging, deploying, and managing application services in isolated containers.   |
| **Web Server (Prod)**   | Nginx (implied by `nginx.conf`)| High-performance HTTP server and reverse proxy, typically for production deployments. |
