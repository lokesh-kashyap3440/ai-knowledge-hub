import pytest
from unittest.mock import patch, MagicMock
import io

TEST_USERNAME = "testuser_upload"
TEST_PASSWORD = "testpassword123"

@pytest.fixture
def authenticated_client(test_client):
    """Fixture to get an authenticated client and token."""
    response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = response.json()["access_token"]
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client

@patch("routes.upload.parse_pdf")
@patch("routes.upload.chunk_text")
@patch("routes.upload.get_embedding")
@patch("routes.upload.add_chunks")
@patch("routes.upload.has_document")
def test_upload_pdf_success(mock_has, mock_add, mock_get_emb, mock_chunk, mock_parse, authenticated_client):
    """Test successful PDF upload with mocked services."""
    mock_has.return_value = False
    mock_parse.return_value = "some text"
    mock_chunk.return_value = ["chunk1"]
    mock_get_emb.return_value = [0.1, 0.2]
    mock_add.return_value = None
    
    # Create a dummy PDF file
    file_content = b"%PDF-1.4 test content"
    file = io.BytesIO(file_content)
    
    response = authenticated_client.post(
        "/upload",
        files={"file": ("test.pdf", file, "application/pdf")}
    )
    
    # Wait, check current routes.upload.py: router = APIRouter() no prefix. 
    # But main.py might include it with prefix.
    # Let's check main.py
    assert response.status_code == 200
    assert response.json()["file"] == "test.pdf"

@patch("routes.upload.has_document")
def test_upload_already_exists(mock_has, authenticated_client):
    mock_has.return_value = True
    file = io.BytesIO(b"content")
    response = authenticated_client.post(
        "/upload",
        files={"file": ("test.pdf", file, "application/pdf")}
    )
    assert response.status_code == 409

@patch("routes.upload.list_documents")
def test_get_documents_success(mock_list, authenticated_client):
    """Test fetching the list of uploaded documents."""
    mock_list.return_value = ["doc1.pdf", "doc2.pdf"]
    
    response = authenticated_client.get("/upload/documents")
    
    assert response.status_code == 200
    assert response.json()["documents"] == ["doc1.pdf", "doc2.pdf"]
