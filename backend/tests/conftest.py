import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import warnings

# Suppress the PytestUnraisableExceptionWarning
warnings.filterwarnings("ignore", category=pytest.PytestUnraisableExceptionWarning)


# Set up the test database URL
# Uses SQLite in-memory for speed and isolation
TEST_DATABASE_URL = "sqlite:///./test.db"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["TESTING"] = "1"

# Now import app modules after setting the env var
from app.main import app
from app.db import Base, get_db

# Create a new SQLAlchemy engine for the test database
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})

# Create a sessionmaker for the test database
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """
    Fixture to set up the database for a test function.
    Creates all tables, yields a session, then drops all tables.
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_client(db_session):
    """
    Fixture to create a test client with an overridden DB dependency.
    """

    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    # Clean up the override after the test
    app.dependency_overrides.pop(get_db, None)
