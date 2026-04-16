from unittest.mock import patch

# A constant for a test user's credentials
TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpassword123"


def test_register_user_success(test_client):
    """Test successful user registration."""
    response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == TEST_USERNAME


def test_register_user_already_exists(test_client):
    """Test registration failure when user already exists."""
    # First, create the user
    test_client.post("/auth/register", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    
    # Then, try to create the same user again
    response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_register_user_short_password(test_client):
    """Test registration failure with a short password."""
    response = test_client.post(
        "/auth/register",
        json={"username": "shortpass", "password": "123"},
    )
    assert response.status_code == 400
    assert "at least 8 characters" in response.json()["detail"]


def test_login_success(test_client):
    """Test successful user login."""
    # Register user first
    test_client.post("/auth/register", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})

    # Attempt to log in
    response = test_client.post(
        "/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == TEST_USERNAME


def test_login_invalid_credentials(test_client):
    """Test login failure with invalid credentials."""
    response = test_client.post(
        "/auth/login",
        json={"username": "nouser", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


def test_get_me_success(test_client):
    """Test fetching the current user's details."""
    # Register and log in
    reg_response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = reg_response.json()["access_token"]

    # Fetch "me"
    response = test_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == TEST_USERNAME


def test_get_me_unauthorized(test_client):
    """Test fetching "me" without a valid token."""
    response = test_client.get("/auth/me")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


def test_change_password_success(test_client):
    """Test successfully changing a user's password."""
    # Register and get token
    reg_response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = reg_response.json()["access_token"]
    new_password = "newpassword456"

    # Change password
    response = test_client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": TEST_PASSWORD, "new_password": new_password},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password updated successfully."

    # Verify new password works for login
    login_response = test_client.post(
        "/auth/login",
        json={"username": TEST_USERNAME, "password": new_password},
    )
    assert login_response.status_code == 200


def test_change_password_incorrect_current(test_client):
    """Test password change failure with incorrect current password."""
    # Register and get token
    reg_response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = reg_response.json()["access_token"]

    # Attempt to change password with wrong current pass
    response = test_client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "wrongpassword", "new_password": "newpassword456"},
    )
    assert response.status_code == 400
    assert "Current password is incorrect" in response.json()["detail"]


def test_get_session_messages_empty(test_client):
    """Test fetching messages for a session that has none."""
    # Register and get token
    reg_response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = reg_response.json()["access_token"]

    # Fetch messages for a new, random session ID
    response = test_client.get(
        "/auth/sessions/some-random-session-id/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == {"messages": []}
