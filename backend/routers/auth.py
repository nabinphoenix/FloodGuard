import hashlib
import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from models.password_reset import PasswordResetToken
from database import get_db
from models.user import User, UserRole
from services.sns_service import is_subscription_pending, subscribe_email, unsubscribe
from schemas.common import NormalizedModel
from schemas.user import (
    ForgotPasswordRequest,
    ProfileUpdateResponse,
    ResetPasswordRequest,
    Token,
    TokenData,
    UserCreate,
    UserOut,
    UserUpdate,
)
from services.email_service import EmailDeliveryError, send_password_reset_email
from services.password_reset_service import (
    GENERIC_RESET_MESSAGE,
    INVALID_RESET_MESSAGE,
    build_reset_url,
    get_valid_reset_token,
    is_reset_rate_limited,
    issue_reset_token,
    record_reset_request,
)


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


class LoginRequest(NormalizedModel):
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "pwd": hashlib.sha256(user.password_hash.encode("utf-8")).hexdigest(),
        "iat": now,
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id), role=UserRole(role))
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (JWTError, ValueError) as exc:
        raise credentials_exception from exc

    user = db.get(User, token_data.user_id)
    if user is None:
        raise credentials_exception

    token_password_version = payload.get("pwd")
    current_password_version = hashlib.sha256(user.password_hash.encode("utf-8")).hexdigest()
    if token_password_version and token_password_version != current_password_version:
        raise credentials_exception
    if user.password_changed_at and payload.get("iat") is not None:
        try:
            issued_at = datetime.fromtimestamp(float(payload["iat"]), timezone.utc)
            changed_at = user.password_changed_at
            if changed_at.tzinfo is None:
                changed_at = changed_at.replace(tzinfo=timezone.utc)
            if issued_at < changed_at.astimezone(timezone.utc):
                raise credentials_exception
        except (TypeError, ValueError, OverflowError) as exc:
            raise credentials_exception from exc

    return user


def role_has_access(current_role: UserRole, *allowed_roles: UserRole | str) -> bool:
    """Allow admins to operate other role-scoped views without changing identity."""
    roles = {UserRole(role) for role in allowed_roles}
    return current_role == UserRole.admin or current_role in roles


def require_role(required_role: UserRole | str) -> Callable[[User], User]:
    role = UserRole(required_role)

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
        if not role_has_access(current_user.role, role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return role_checker


def require_any_role(*allowed_roles: UserRole | str) -> Callable[[User], User]:
    roles = [UserRole(r) for r in allowed_roles]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
        if not role_has_access(current_user.role, *roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )
        return current_user

    return role_checker


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Token:
    normalized_email = user_in.email.strip().lower()
    if get_user_by_email(db, normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=user_in.name.strip(),
        email=normalized_email,
        phone=user_in.phone.strip() if user_in.phone else None,
        district=user_in.district.strip() if user_in.district else None,
        password_hash=hash_password(user_in.password),
        role=UserRole.public,
    )
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    db.refresh(user)
    return Token(access_token=create_access_token(user), token_type="bearer")


@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = get_user_by_email(db, credentials.email)

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(user), token_type="bearer")


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    normalized_email = str(payload.email).strip().lower()
    client_ip = request.client.host if request.client else None
    rate_limited = is_reset_rate_limited(normalized_email, client_ip)
    record_reset_request(normalized_email, client_ip)
    user = get_user_by_email(db, normalized_email)

    if user and not rate_limited:
        raw_token, _ = issue_reset_token(db, user, client_ip)
        logger.info("Password reset requested for user_id=%s", user.id)
        try:
            send_password_reset_email(user.email, build_reset_url(raw_token))
        except EmailDeliveryError:
            logger.exception("Password reset email delivery failed for user_id=%s", user.id)
    elif user and rate_limited:
        logger.warning("Password reset request throttled for user_id=%s", user.id)

    return {"message": GENERIC_RESET_MESSAGE}

@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    record = get_valid_reset_token(db, payload.token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_RESET_MESSAGE)

    user = db.get(User, record.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_RESET_MESSAGE)

    changed_at = datetime.now(timezone.utc).replace(microsecond=0)
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = changed_at
    record.used_at = changed_at
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != record.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=changed_at)
    )
    db.commit()
    logger.info("Password reset completed for user_id=%s", user.id)
    return {"message": "Password reset successful."}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    profile_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileUpdateResponse:
    update_data = profile_in.model_dump(exclude_unset=True)
    message = None
    if "email_alerts" in update_data:
        new_val = update_data["email_alerts"]
        if new_val is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email alerts must be enabled or disabled explicitly.",
            )
        if new_val:
            if not current_user.sns_subscription_arn:
                current_user.sns_subscription_arn = subscribe_email(current_user.email)
                message = "Subscription request sent. Check your email and confirm the subscription."
            elif is_subscription_pending(current_user.sns_subscription_arn):
                message = "Email subscription is pending confirmation. Check your inbox."
            else:
                message = "Email alerts remain enabled. Check your inbox if confirmation is still required."
        else:
            if current_user.sns_subscription_arn:
                unsubscribe(current_user.sns_subscription_arn)
                current_user.sns_subscription_arn = None
            message = "Email alerts disabled."
        current_user.email_alerts = new_val

    # Apply remaining fields
    for field, value in update_data.items():
        if field == "email_alerts":
            continue
        if isinstance(value, str):
            value = value.strip() or None
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {
        "user": current_user,
        "message": message,
    }


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "Logged out successfully. Remove the token from the client."}
