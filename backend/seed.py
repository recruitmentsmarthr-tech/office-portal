from models import Base, Role, Permission, RolePermission, User
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def seed():
    db = SessionLocal()
    # Create permissions
    read_vectors = Permission(name="read_vectors")
    write_vectors = Permission(name="write_vectors")
    admin_perm = Permission(name="admin")
    db.add(read_vectors)
    db.add(write_vectors)
    db.add(admin_perm)
    # Create roles
    user_role = Role(name="user", permissions=[read_vectors, write_vectors])
    admin_role = Role(name="admin", permissions=[read_vectors, write_vectors, admin_perm])
    db.add(user_role)
    db.add(admin_role)
    db.commit()
    # Create initial admin user
    admin_user = User(
        username="admin",
        email="admin@example.com",
        hashed_password=get_password_hash("admin"),
        role_id=admin_role.id
    )
    db.add(admin_user)
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
