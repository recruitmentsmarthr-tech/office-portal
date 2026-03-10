# Third-Party Dependencies

This document outlines the key third-party libraries and dependencies for both the backend and frontend services.

---

## Backend Dependencies (`backend/requirements.txt`)

These are the primary Python libraries that power the backend API and background workers.

| Library            | Version | Description                                                      |
| :----------------- | :------ | :--------------------------------------------------------------- |
| `fastapi`          | ~0.109  | The core high-performance web framework for building the API.      |
| `uvicorn`          | ~0.27   | The ASGI server that runs the FastAPI application.                 |
| `sqlalchemy`       | -       | The Object-Relational Mapper (ORM) for all database interactions.  |
| `psycopg2-binary`  | ~2.9.9  | The PostgreSQL adapter for Python, enabling connection to the DB.  |
| `pgvector`         | ~0.2.4  | Enables vector similarity search capabilities within PostgreSQL.   |
| `celery`           | ~5.3.6  | The distributed task queue for handling asynchronous background jobs.|
| `redis`            | ~5.0.1  | The client library for connecting to the Redis message broker.     |
| `alembic`          | ~1.13.1 | A database migration tool for managing schema changes with SQLAlchemy. |
| `python-jose`      | ~3.3.0  | Implements JWTs for user authentication and session management.    |
| `passlib[bcrypt]`  | ~1.7.4  | Used for securely hashing and verifying user passwords.            |
| `requests`         | ~2.26.0 | Used for making HTTP requests to the external Gemini API.          |
| `pypdf`            | ~3.17.0 | A library for extracting text content from uploaded PDF files.     |
| `python-docx`      | ~1.1.2  | Used to generate `.docx` files for downloading meeting minutes.    |
| `markdown-it-py`   | ~3.0.0  | A Python port of the popular Markdown parser, used for processing text. |

---

## Frontend Dependencies (`frontend/package.json`)

These are the primary JavaScript libraries that power the React-based user interface.

| Library                 | Version | Description                                                              |
| :---------------------- | :------ | :----------------------------------------------------------------------- |
| `react`                 | ~18.2.0 | The core library for building the component-based user interface.        |
| `react-router-dom`      | ~6.18.0 | Manages client-side routing and navigation within the single-page app.   |
| `axios`                 | ~1.6.0  | A promise-based HTTP client for making API requests to the backend.      |
| `react-markdown`        | ~10.1.0 | Renders Markdown content in the UI, essential for the chat interface.    |
| `remark-gfm`            | ~4.0.1  | A plugin for `react-markdown` that adds support for GitHub Flavored Markdown. |
| `@tailwindcss/typography` | ~0.5.19 | A Tailwind CSS plugin for styling raw HTML or Markdown content.          |
| `lucide-react`          | ~0.294.0| Provides a lightweight and customizable library of icons for the UI.     |
| `jwt-decode`            | ~4.0.0  | A small utility for decoding JWT access tokens on the client-side.       |
| `date-fns`              | ~2.30.0 | A modern JavaScript date utility library for formatting and manipulation. |
