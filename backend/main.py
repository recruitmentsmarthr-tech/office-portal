from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from models import Base, User, Role, Permission, Vector
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import logging

app = FastAPI()

logging.basicConfig(level=logging.INFO)

# CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)  # Remove in prod

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

# ... (rest of the code)

@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not check_permission(current_user, "admin", db):
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Admins cannot delete themselves.")

    db.delete(db_user)
    db.commit()
    return

@app.post("/chat")
async def chat(chat_request: ChatRequest, current_user: User = Depends(get_current_user)):
    # Simple AI response for demo; this is non-blocking.
    await asyncio.sleep(0) # Ensures the event loop yields, can help in some edge cases.
    response_text = f"Hello {current_user.username}! You said: '{chat_request.message}'. How can I assist with your vectors today?"
    return {"response": response_text}

@app.get("/")
def read_root():
    return {"message": "Hey, world!"}
