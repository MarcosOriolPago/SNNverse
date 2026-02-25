import uuid
import urllib.parse
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta
from typing import Optional
from jose import JWTError, jwt

from ..core.security import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from ..core.database import get_db_manager
from ..core.models import User
from ..core.config import config

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    username: str
    password: str

class UpgradeRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    username: str
    user_id: str
    is_guest: bool = False
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        username=user.username,
        user_id=str(user.user_id),
        is_guest=user.is_guest,
        email=user.email,
        display_name=user.display_name or user.username,
        avatar_url=user.avatar_url,
    )

def _issue_token(user: User) -> dict:
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": str(user.user_id),
            "is_guest": user.is_guest,
        },
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}

def _decode_token(token: str) -> dict:
    """Decode a JWT and return its payload. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def _get_user_by_id(session: Session, user_id: str) -> User:
    user = session.query(User).filter(User.user_id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate):
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        db_user = session.query(User).filter(User.username == user.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")

        hashed_password = get_password_hash(user.password)
        new_user = User(
            username=user.username,
            password_hash=hashed_password,
            is_guest=False,
            display_name=user.username,
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        return _user_to_response(new_user)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        user = session.query(User).filter(User.username == form_data.username).first()
        if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return _issue_token(user)


@router.post("/guest", response_model=Token)
def create_guest():
    """Create an anonymous guest user with auto-generated credentials."""
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        short_id = uuid.uuid4().hex[:8]
        guest_user = User(
            username=f"guest_{short_id}",
            password_hash=None,
            is_guest=True,
            display_name="Guest",
        )
        session.add(guest_user)
        session.commit()
        session.refresh(guest_user)
        return _issue_token(guest_user)


@router.post("/upgrade", response_model=Token)
def upgrade_guest(body: UpgradeRequest, token: str = Depends(oauth2_scheme)):
    """Convert a guest account to a full registered account, preserving all data."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_token(token)
    if not payload.get("is_guest"):
        raise HTTPException(status_code=400, detail="Account is already registered")

    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        user = _get_user_by_id(session, payload["user_id"])

        # Check username availability
        existing = session.query(User).filter(User.username == body.username).first()
        if existing and existing.user_id != user.user_id:
            raise HTTPException(status_code=400, detail="Username already taken")

        user.username = body.username
        user.password_hash = get_password_hash(body.password)
        user.is_guest = False
        user.display_name = body.username
        session.commit()
        session.refresh(user)
        return _issue_token(user)


@router.get("/me", response_model=UserResponse)
def read_users_me(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_token(token)
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        user = _get_user_by_id(session, payload["user_id"])
        return _user_to_response(user)


# ---------------------------------------------------------------------------
# Google OAuth2
# ---------------------------------------------------------------------------

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
def google_login(guest_token: Optional[str] = None):
    """Redirect the user to Google's OAuth consent screen."""
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    state = guest_token or ""
    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
    }
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str, state: str = ""):
    """Handle the redirect from Google after consent."""
    if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured")

    # 1. Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "redirect_uri": config.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code with Google")
        tokens = token_resp.json()

        # 2. Fetch user profile
        userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        google_user = userinfo_resp.json()

    google_id = google_user["sub"]
    email = google_user.get("email")
    name = google_user.get("name", email)
    picture = google_user.get("picture")

    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        # 3. Look up by google_id
        user = session.query(User).filter(User.google_id == google_id).first()

        if user:
            # Existing Google user — update profile in case it changed
            user.display_name = name
            user.avatar_url = picture
            if email:
                user.email = email
            session.commit()
            session.refresh(user)
        else:
            # 4. If a guest token was passed in state, merge into that guest account
            if state:
                try:
                    guest_payload = _decode_token(state)
                    if guest_payload.get("is_guest"):
                        user = _get_user_by_id(session, guest_payload["user_id"])
                        user.google_id = google_id
                        user.email = email
                        user.display_name = name
                        user.avatar_url = picture
                        user.is_guest = False
                        session.commit()
                        session.refresh(user)
                except Exception:
                    user = None  # Fall through to create new user

            # 5. Create a new user if we still don't have one
            if not user:
                # Check if email already exists (shouldn't normally happen)
                if email:
                    user = session.query(User).filter(User.email == email).first()
                if user:
                    # Link Google to existing email account
                    user.google_id = google_id
                    user.display_name = name
                    user.avatar_url = picture
                    session.commit()
                    session.refresh(user)
                else:
                    short_id = uuid.uuid4().hex[:8]
                    user = User(
                        username=f"g_{short_id}",
                        password_hash=None,
                        is_guest=False,
                        google_id=google_id,
                        email=email,
                        display_name=name,
                        avatar_url=picture,
                    )
                    session.add(user)
                    session.commit()
                    session.refresh(user)

        # 6. Issue JWT and redirect to frontend
        token_data = _issue_token(user)
        frontend_url = config.FRONTEND_URL
        redirect_url = f"{frontend_url}/?token={token_data['access_token']}"
        return RedirectResponse(url=redirect_url)
