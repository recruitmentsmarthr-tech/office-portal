from fastapi.testclient import TestClient
from main import app
from models import Base, SessionLocal, engine
import pytest

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_register(setup_db):
    response = client.post("/register", json={"username": "testuser", "email": "test@example.com", "password": "password"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login(setup_db):
    client.post("/register", json={"username": "testuser", "email": "test@example.com", "password": "password"})
    response = client.post("/token", data={"username": "testuser", "password": "password"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_create_vector(setup_db):
    client.post("/register", json={"username": "testuser", "email": "test@example.com", "password": "password"})
    login_response = client.post("/token", data={"username": "testuser", "password": "password"})
    token = login_response.json()["access_token"]
    response = client.post("/vectors", json={"embedding": [0.1] * 384, "metadata": {"key": "value"}}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
