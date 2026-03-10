# API Endpoint Documentation

This document provides a summary of the available API endpoints in the Office Portal backend.

**Authentication Levels:**
*   **Public:** No authentication required.
*   **User:** Requires a valid user access token.
*   **Admin:** Requires a user with 'admin' role privileges.

---

## Authentication

| Method | Path         | Description                       | Auth Level |
| :----- | :----------- | :-------------------------------- | :--------- |
| `POST` | `/register`  | Creates a new user account.       | Public     |
| `POST` | `/token`     | Authenticates a user and returns a JWT. | Public     |
| `GET`  | `/users/me`  | Retrieves the current user's profile. | User       |

---

## Document Ingestion & Management (RAG)

| Method   | Path                          | Description                                                                 | Auth Level |
| :------- | :---------------------------- | :-------------------------------------------------------------------------- | :--------- |
| `POST`   | `/api/ingest`                 | Uploads a document (PDF) for ingestion into the 'corporate' knowledge base. | Admin      |
| `GET`    | `/api/documents`              | Lists all ingested documents with filtering and pagination.                 | User       |
| `DELETE` | `/api/documents/{document_id}`| Deletes an ingested document and its associated chunks from the DB.         | Admin      |

---

## Audio Transcription

| Method   | Path                                    | Description                                                              | Auth Level |
| :------- | :-------------------------------------- | :----------------------------------------------------------------------- | :--------- |
| `POST`   | `/api/transcribe`                       | Uploads an audio file to start a new transcription job.                  | User       |
| `GET`    | `/api/transcribe/jobs`                  | Lists all transcription jobs for the current user.                       | User       |
| `GET`    | `/api/transcribe/status/{job_id}`       | Gets the detailed status, progress, and results of a specific job.       | User       |
| `DELETE` | `/api/transcribe/jobs/{job_id}`         | Deletes a transcription job and its associated audio file.               | User       |
| `POST`   | `/api/transcribe/jobs/{job_id}/cancel`  | Cancels a job that is currently `PENDING` or `PROCESSING`.               | User       |
| `PUT`    | `/api/transcribe/jobs/{job_id}/transcript`| Manually updates the full transcript text of a completed job.            | User       |
| `GET`    | `/api/transcribe/jobs/{job_id}/download/docx`| Downloads the generated meeting minutes as a `.docx` file.           | User       |

---

## Post-Transcription Actions

| Method | Path                                          | Description                                                              | Auth Level |
| :----- | :-------------------------------------------- | :----------------------------------------------------------------------- | :--------- |
| `POST` | `/api/transcriptions/{job_id}/generate-minutes`| Starts a background task to generate meeting minutes from a transcript.  | Admin      |
| `POST` | `/api/transcriptions/{job_id}/ingest`         | Ingests a transcript or minutes into the 'meetings' knowledge base.      | Admin      |
| `GET`  | `/api/transcriptions/{job_id}/ingestion-status`| Checks the ingestion status of a job's transcript and minutes.           | Admin      |

---

## Chat

| Method   | Path                          | Description                                                              | Auth Level |
| :------- | :---------------------------- | :----------------------------------------------------------------------- | :--------- |
| `POST`   | `/chat`                       | Sends a message to the RAG chat for the 'corporate' collection.        | User       |
| `POST`   | `/api/chat/meetings`          | Sends a message to the RAG chat for the 'meetings' collection.           | Admin      |
| `GET`    | `/api/chat/sessions`          | Lists all non-deleted chat sessions for the user, filterable by collection. | User       |
| `GET`    | `/api/chat/history/{session_id}`| Retrieves the message history for a specific chat session.               | User       |
| `DELETE` | `/api/chat/sessions/{session_id}`| Soft-deletes a chat session.                                             | User       |

---

## Admin Management

| Method   | Path                       | Description                                      | Auth Level |
| :------- | :------------------------- | :----------------------------------------------- | :--------- |
| `GET`    | `/admin/roles`             | Lists all available user roles.                  | Admin      |
| `POST`   | `/admin/roles`             | Creates a new user role.                         | Admin      |
| `PUT`    | `/admin/roles/{role_id}`   | Updates the name of a user role.                 | Admin      |
| `DELETE` | `/admin/roles/{role_id}`   | Deletes a user role if it's not in use.          | Admin      |
| `GET`    | `/admin/users`             | Lists all users in the system.                   | Admin      |
| `POST`   | `/admin/users`             | Creates a new user with a specified role.        | Admin      |
| `PUT`    | `/admin/users/{user_id}`   | Updates a user's details (username, email, role).| Admin      |

---

## Legacy/Internal

These endpoints appear to be part of an older implementation and may not be in active use by the frontend.

| Method | Path        | Description                               | Auth Level |
| :----- | :---------- | :---------------------------------------- | :--------- |
| `POST` | `/vectors`  | Creates a raw vector entry in the database. | Admin      |
| `GET`  | `/vectors`  | Reads raw vector entries for the user.    | Admin      |
