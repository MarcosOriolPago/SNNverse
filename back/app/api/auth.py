from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta
from typing import Optional

from ..core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from ..core.database import get_db_manager
from ..core.models import User

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# --- Pydantic Models ---
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    username: str
    user_id: str
    
    class Config:
        from_attributes = True

# --- Dependency ---
def get_db():
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        yield session

# --- Routes ---

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate):
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        db_user = session.query(User).filter(User.username == user.username).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        hashed_password = get_password_hash(user.password)
        new_user = User(username=user.username, password_hash=hashed_password)
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        # Convert UUID to string for Pydantic response
        return UserResponse(
            username=new_user.username,
            user_id=str(new_user.user_id)
        )

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db_manager = get_db_manager()
    with db_manager.session_context() as session:
        user = session.query(User).filter(User.username == form_data.username).first()
        if not user or not verify_password(form_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "user_id": str(user.user_id)},
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(token: str = Depends(oauth2_scheme)):
    # Simple validation for now, ideally decode token and fetch user
    # In a real app, you'd decode the JWT here and query the DB
    from jose import JWTError, jwt
    from ..core.security import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        if username is None:
             raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    return UserResponse(username=username, user_id=user_id)
