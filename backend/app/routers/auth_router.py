"""Authentication API routes: register, login, current user."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.Token)
def register(data: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check if email already exists
    existing = db.query(models.User).filter(models.User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        name=data.name,
        email=data.email,
        mobile=data.mobile,
        hashed_password=auth.hash_password(data.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(
        access_token=token,
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not auth.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = auth.create_access_token({"sub": str(user.id)})
    return schemas.Token(
        access_token=token,
        user=schemas.UserOut.model_validate(user),
    )


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user
