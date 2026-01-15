from models import Base, Role, Permission, RolePermission
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    # Create permissions
    read_vectors = Permission(name="read_vectors")
    write_vectors = Permission(name="write_vectors")
    db.add(read_vectors)
    db.add(write_vectors)
    # Create roles
    user_role = Role(name="user", permissions=[read_vectors, write_vectors])
    admin_role = Role(name="admin", permissions=[read_vectors, write_vectors])  # Add more permissions for admin if needed
    db.add(user_role)
    db.add(admin_role)
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
