from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from models import Base, User, Role, Permission, Document, DocumentStatus, Chat, ChatMessage, MessageFeedback, TranscriptionJob, TranscriptionJobStatus # Added TranscriptionJob, TranscriptionJobStatus
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional, Union # Added Union for typing
from fastapi.middleware.cors import CORSMiddleware
import logging
from pathlib import Path
import uuid
from celery import Celery # New import for Celery
from tasks import transcribe_audio_task, generate_minutes_task # New: Import Celery tasks


# Import the RAG pipeline functions
from rag_pipeline import ingest_document_pipeline

from contextlib import asynccontextmanager

app = FastAPI()

# Celery setup
celery_app = Celery(
    "office_portal",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")
)

logging.basicConfig(level=logging.INFO)


# CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base.metadata.create_all(bind=engine)  # Managed by Alembic now

# Directory for uploaded audio files
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# Auth setup
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class VectorCreate(BaseModel):
    embedding: List[float]
    vector_metadata: Optional[dict] = None

class RoleCreate(BaseModel):
    name: str

class UserCreateAdmin(BaseModel):
    username: str
    email: str
    password: str
    role_id: int

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None

class DocumentDisplay(BaseModel):
    id: int
    filename: str
    upload_date: datetime
    status: DocumentStatus

    class Config:
        orm_mode = True

class ChatSessionDisplay(BaseModel):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class ChatMessageDisplay(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        orm_mode = True

class UserDisplay(BaseModel):
    id: int
    username: str
    email: str
    role_id: int

    class Config:
        orm_mode = True # To allow ORM models to be directly returned

class RoleDisplay(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True # To allow ORM models to be directly returned

class TranscriptionJobDisplay(BaseModel):
    id: int
    user_id: int
    original_filename: str
    status: TranscriptionJobStatus
    progress_percent: int
    progress_text: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class TranscriptionJobDetailDisplay(TranscriptionJobDisplay):
    full_transcript: Optional[str] = None
    meeting_minutes: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        orm_mode = True

# Helper functions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def check_permission(user: User, permission_name: str, db: Session):
    if not user.role:
        return False
    
    # Specific logic for ingest_documents
    if permission_name == "ingest_documents":
        return user.role.name == "admin" # Only admin can ingest for now
    
    # Specific logic for read_documents
    if permission_name == "read_documents":
        return user.role.name in ["admin", "user"] # Both admin and regular users can read documents
    
    permissions = [p.name for p in user.role.permissions]
    return permission_name in permissions

# Routes
@app.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    default_role = db.query(Role).filter(Role.name == "user").first()
    if not default_role:
        raise HTTPException(status_code=500, detail="Default role not found")
    new_user = User(username=user.username, email=user.email, hashed_password=hashed_password, role_id=default_role.id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username, "role": user.role.name if user.role else None})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {"username": current_user.username, "role": current_user.role.name if current_user.role else None}

class IngestResponse(BaseModel):
    message: str
    document_id: int
    filename: str

@app.post("/api/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_permission(current_user, "ingest_documents", db):
        raise HTTPException(status_code=403, detail="Not enough permissions to ingest documents")

    # Create a document entry
    new_document = Document(filename=file.filename, status=DocumentStatus.PENDING)
    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    # Save file temporarily
    # Create a unique filename to avoid collisions
    unique_filename = f"{new_document.id}_{uuid.uuid4()}_{file.filename}"
    temp_file_path = Path("/tmp") / unique_filename
    temp_file_path.parent.mkdir(parents=True, exist_ok=True) # Ensure /tmp exists within the container

    try:
        with open(temp_file_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as e:
        db.delete(new_document) # Rollback document creation
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Add ingestion to background tasks
    # Pass SessionLocal directly, as it will create a new session for the background task
    background_tasks.add_task(ingest_document_pipeline, new_document.id, str(temp_file_path), SessionLocal())

    return IngestResponse(
        message="Document received and processing started in background.",
        document_id=new_document.id,
        filename=file.filename,
    )

@app.post("/api/transcribe", response_model=TranscriptionJobDisplay)
async def start_transcription(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check for existing active jobs for this user
    existing_job = (
        db.query(TranscriptionJob)
        .filter(
            TranscriptionJob.user_id == current_user.id,
            TranscriptionJob.status.in_([TranscriptionJobStatus.PENDING, TranscriptionJobStatus.PROCESSING]),
        )
        .first()
    )
    if existing_job:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"You already have a transcription job in progress (ID: {existing_job.id}, Status: {existing_job.status.value}). Please wait for it to complete or fail before starting a new one.",
        )

    # 1. Create a preliminary job entry to get an ID
    new_job = TranscriptionJob(
        user_id=current_user.id,
        original_filename=file.filename,
        status=TranscriptionJobStatus.PENDING,
        progress_text="File uploaded, awaiting processing.",
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # 2. Generate the filename using the new job's ID
    file_extension = Path(file.filename).suffix
    saved_file_name = f"{new_job.id}_{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / saved_file_name
    
    # 3. Update the job with the generated filename
    new_job.saved_file_name = saved_file_name
    db.commit()
    db.refresh(new_job)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as e:
        # Update job status to failed and roll back
        new_job.status = TranscriptionJobStatus.FAILED
        new_job.error_message = f"Failed to save uploaded file: {e}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Trigger the Celery task here
    from tasks import transcribe_audio_task # Import the task
    task_result = transcribe_audio_task.delay(new_job.id, str(file_path))
    new_job.celery_task_id = task_result.id # Store the Celery task ID
    db.commit() # Commit the task ID to the database after dispatching
    db.refresh(new_job)

    return new_job

@app.get("/api/transcribe/status/{job_id}", response_model=TranscriptionJobDetailDisplay)
def get_transcription_job_status(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    if job.user_id != current_user.id and not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not authorized to view this job's status")

    return job

@app.get("/api/transcribe/jobs", response_model=List[TranscriptionJobDisplay])
def list_transcription_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(TranscriptionJob).filter(TranscriptionJob.user_id == current_user.id).order_by(TranscriptionJob.created_at.desc()).all()
    return jobs

@app.delete("/api/transcribe/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transcription_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    if job.user_id != current_user.id and not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not authorized to delete this job")

    # Delete the associated audio file if it exists
    if job.saved_file_name:
        file_path = UPLOAD_DIR / job.saved_file_name
        if file_path.exists():
            try:
                os.remove(file_path)
            except OSError as e:
                logging.error(f"Error deleting file {file_path}: {e}")
                # Don't fail the API call if file deletion fails, just log it.

    db.delete(job)
    db.commit()
    return

@app.post("/api/transcribe/jobs/{job_id}/cancel", response_model=TranscriptionJobDisplay)
def cancel_transcription_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    if job.user_id != current_user.id and not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this job")

    if job.status not in [TranscriptionJobStatus.PENDING, TranscriptionJobStatus.PROCESSING]:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not cancellable. Current status: {job.status.value}",
        )

    if job.celery_task_id:
        # Revoke the Celery task
        # terminate=True will kill the worker process that is currently executing the task
        # This is often necessary for long-running tasks that don't check for revocation frequently
        celery_app.control.revoke(job.celery_task_id, terminate=True)
        logging.info(f"Revoked Celery task {job.celery_task_id} for job {job.id}")
    else:
        logging.warning(f"Job {job.id} has no celery_task_id to revoke.")

    job.status = TranscriptionJobStatus.CANCELLED
    job.error_message = "Job cancelled by user."
    db.commit()
    db.refresh(job)
    
    return job

@app.post("/api/generate-minutes/{job_id}", status_code=status.HTTP_202_ACCEPTED)
async def generate_minutes(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(TranscriptionJob).filter(TranscriptionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    if job.user_id != current_user.id and not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not authorized to generate minutes for this job")
    
    if job.status not in [TranscriptionJobStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Minutes can only be generated for completed transcription jobs.")

    if not job.full_transcript:
        raise HTTPException(status_code=400, detail="No full transcript available for this job to generate minutes.")

    # Trigger the Celery task for minutes generation
    from tasks import generate_minutes_task # Import the task
    generate_minutes_task.delay(job.id)

    return {"message": "Minutes generation started in the background.", "job_id": job.id}

@app.get("/api/documents", response_model=List[DocumentDisplay])
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "read_documents", db):
        raise HTTPException(status_code=403, detail="Not enough permissions to read documents")
    documents = db.query(Document).order_by(Document.upload_date.desc()).all()
    return documents

@app.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "ingest_documents", db): # Using ingest_documents permission for delete as well
        raise HTTPException(status_code=403, detail="Not enough permissions to delete documents")
    
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(document)
    db.commit()
    return

@app.post("/vectors")
def create_vector(vector: VectorCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "write_vectors", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    new_vector = Vector(user_id=current_user.id, embedding=vector.embedding, vector_metadata=vector.vector_metadata)
    db.add(new_vector)
    db.commit()
    db.refresh(new_vector)
    return {"id": new_vector.id}

@app.get("/vectors")
def read_vectors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "read_vectors", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    vectors = db.query(Vector).filter(Vector.user_id == current_user.id).all()
    return [{"id": v.id, "embedding": v.embedding, "metadata": v.vector_metadata} for v in vectors]

@app.post("/admin/roles")
def create_role(role: RoleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db_role = db.query(Role).filter(Role.name == role.name).first()
    if db_role:
        raise HTTPException(status_code=400, detail="Role already exists")
    new_role = Role(name=role.name)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return {"id": new_role.id, "name": new_role.name}

@app.get("/admin/roles", response_model=List[RoleDisplay])
def read_roles(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    roles = db.query(Role).all()
    return roles

@app.put("/admin/roles/{role_id}", response_model=RoleDisplay)
def update_role(role_id: int, role_update: RoleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")

    db_role.name = role_update.name
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.delete("/admin/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Prevent deletion of 'admin' and 'user' roles
    if db_role.name in ['admin', 'user']:
        raise HTTPException(status_code=400, detail=f"Cannot delete essential system role: '{db_role.name}'.")

    # Prevent deletion if role is in use
    users_with_role = db.query(User).filter(User.role_id == role_id).count()
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role. It is currently assigned to {users_with_role} user(s).")

    db.delete(db_role)
    db.commit()
    return

@app.post("/admin/users")
def create_user(user: UserCreateAdmin, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, email=user.email, hashed_password=hashed_password, role_id=user.role_id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"id": new_user.id, "username": new_user.username}

@app.get("/admin/users", response_model=List[UserDisplay])
def read_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    users = db.query(User).all()
    return users

@app.put("/admin/users/{user_id}", response_model=UserDisplay)
def update_user(user_id: int, user_update: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        hashed_password = get_password_hash(update_data["password"])
        update_data["hashed_password"] = hashed_password
        del update_data["password"]
    else:
        if "password" in update_data:
            del update_data["password"]

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

import asyncio
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
# ... (rest of the imports)

# Import RAG chat functions
from rag_chat import (
    get_or_create_chat,
    save_message,
    get_chat_history,
    normalize_text,
    generate_embedding,
    perform_vector_search,
    construct_llm_prompt,
    get_llm_response,
)

@app.post("/chat")
def chat(
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Get or create chat session
    chat_session = get_or_create_chat(current_user.id, db, session_id=chat_request.session_id)

    # 2. Save user message
    save_message(chat_session.id, "user", chat_request.message, db)

    # 3. Normalize and embed user query
    normalized_query = normalize_text(chat_request.message)
    query_embedding = generate_embedding(normalized_query)

    # 4. Perform vector search for context
    retrieved_chunks = perform_vector_search(query_embedding, db)

    # 5. Get chat history (for context in LLM)
    history = get_chat_history(chat_session.id, db, limit=5) # Last 5 messages

    # 6. Construct LLM prompt
    llm_prompt = construct_llm_prompt(chat_request.message, retrieved_chunks, history)

    # 7. Get LLM response
    llm_response = get_llm_response(llm_prompt)

    # 8. Save AI response
    save_message(chat_session.id, "assistant", llm_response, db)

    return {"session_id": chat_session.id, "response": llm_response}

@app.get("/api/chat/sessions", response_model=List[ChatSessionDisplay])
def get_chat_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns all non-deleted chat sessions for the current user.
    """
    sessions = (
        db.query(Chat)
        .filter(Chat.user_id == current_user.id, Chat.is_deleted == False)
        .order_by(Chat.created_at.desc())
        .all()
    )
    return sessions

@app.get("/api/chat/history/{session_id}", response_model=List[ChatMessageDisplay])
def get_chat_history_route(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify chat belongs to user (or admin permission)
    chat = db.query(Chat).filter(Chat.id == session_id, Chat.user_id == current_user.id).first()
    if not chat and not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not authorized to view this chat history")
    
    history = get_chat_history(session_id, db, limit=50) # Fetch more history for display
    return history


@app.delete("/api/chat/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft deletes a chat session.
    """
    chat = db.query(Chat).filter(Chat.id == session_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    chat.is_deleted = True
    db.commit()
    return


@app.get("/")
def read_root():
    return {"message": "Hey, world!"}
