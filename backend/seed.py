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

    def get_or_create(session, model, **kwargs):
        instance = session.query(model).filter_by(**kwargs).first()
        if instance:
            return instance, False
        else:
            instance = model(**kwargs)
            session.add(instance)
            session.flush() # flush to get the ID for relationships
            return instance, True

    # Get-or-create permissions
    read_vectors, _ = get_or_create(db, Permission, name="read_vectors")
    write_vectors, _ = get_or_create(db, Permission, name="write_vectors")
    admin_perm, _ = get_or_create(db, Permission, name="admin")

    # Get-or-create roles
    user_role, _ = get_or_create(db, Role, name="user")
    admin_role, _ = get_or_create(db, Role, name="admin")

    # Associate permissions with roles idempotently
    if read_vectors not in user_role.permissions:
        user_role.permissions.append(read_vectors)
    if write_vectors not in user_role.permissions:
        user_role.permissions.append(write_vectors)

    if read_vectors not in admin_role.permissions:
        admin_role.permissions.append(read_vectors)
    if write_vectors not in admin_role.permissions:
        admin_role.permissions.append(write_vectors)
    if admin_perm not in admin_role.permissions:
        admin_role.permissions.append(admin_perm)

    # Get-or-create admin user
    admin_user = db.query(User).filter_by(username="admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            role_id=admin_role.id
        )
        db.add(admin_user)

    db.commit()
    db.close()
    print("Database seeding complete.")

if __name__ == "__main__":
    seed()
