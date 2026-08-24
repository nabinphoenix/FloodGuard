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
from services.sns_service import (
    SUBSCRIPTION_CONFIRMED,
    SUBSCRIPTION_DISABLED,
    SUBSCRIPTION_PENDING,
    disable_flood_alert_subscription,
    enable_flood_alert_subscription,
    get_flood_alert_subscription_status,
    is_subscription_pending,
    subscribe_email,
    unsubscribe,
)
from schemas.common import NormalizedModel
from schemas.user import (
    ForgotPasswordRequest,
    NotificationStatusResponse,
    ProfileUpdateResponse,
    ResetPasswordRequest,
    Token,
    TokenData,
    UserCreate,
    UserOut,
    UserUpdate,
)
from services.email_service import (
    EmailDeliveryError,
    PASSWORD_RECOVERY_CONFIRMED,
    PASSWORD_RECOVERY_DISABLED,
    PASSWORD_RECOVERY_PENDING,
    disable_password_reset_subscription,
    enable_password_reset_subscription,
    get_confirmed_password_reset_subscription,
    get_password_reset_subscription_status,
    send_password_reset_email,
    unsubscribe_password_reset_subscription,
)
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
    return db.scalar(
        select(User).where(
            User.email == email.strip().lower(),
            User.deleted_at.is_(None),
        )
    )


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
    if user is None or user.deleted_at is not None:
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


def require_exact_role(required_role: UserRole | str) -> Callable[[User], User]:
    """Require the user's real role without the admin view-as exception."""
    role = UserRole(required_role)

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
        if current_user.role != role:
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
        try:
            confirmed = None
            if user.password_recovery_enabled:
                confirmed = get_confirmed_password_reset_subscription(
                    user.password_recovery_topic_arn,
                    user.email,
                )
            if confirmed:
                topic_arn, subscription_arn = confirmed
                user.password_recovery_subscription_arn = subscription_arn
                raw_token, _ = issue_reset_token(db, user, client_ip)
                logger.info("Password reset requested for user_id=%s", user.id)
                send_password_reset_email(user.email, build_reset_url(raw_token), topic_arn)
            else:
                logger.info("Password reset not sent because recovery is disabled or unconfirmed for user_id=%s", user.id)
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
    if user is None or user.deleted_at is not None:
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


NOTIFICATION_STATUS_LABELS = {
    SUBSCRIPTION_DISABLED: "Disabled",
    SUBSCRIPTION_PENDING: "Pending confirmation",
    SUBSCRIPTION_CONFIRMED: "Confirmed & Active",
}


def _notification_status(status_value: str) -> dict[str, str | bool]:
    return {
        "enabled": status_value != SUBSCRIPTION_DISABLED,
        "status": status_value,
        "label": NOTIFICATION_STATUS_LABELS[status_value],
    }


def _reconcile_notification_statuses(current_user: User) -> tuple[str, str]:
    """Synchronize desired user settings with the actual scoped SNS topics.

    Stored booleans represent user intent only. The returned status always comes
    from SNS for an enabled subscription. A disabled pending subscription keeps
    a private marker so a later confirmation is automatically unsubscribed.
    """
    flood_status = SUBSCRIPTION_DISABLED
    if current_user.email_alerts:
        actual_status, subscription_arn = get_flood_alert_subscription_status(current_user.email)
        if actual_status == SUBSCRIPTION_DISABLED:
            current_user.email_alerts = False
            current_user.sns_subscription_arn = None
        else:
            current_user.sns_subscription_arn = subscription_arn
            flood_status = actual_status
    elif current_user.sns_subscription_arn:
        current_user.sns_subscription_arn = disable_flood_alert_subscription(current_user.email)

    recovery_status = SUBSCRIPTION_DISABLED
    if current_user.password_recovery_enabled:
        try:
            actual_status, subscription_arn = get_password_reset_subscription_status(
                current_user.password_recovery_topic_arn,
                current_user.email,
            )
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Password recovery subscription status could not be checked.",
            ) from exc

        if actual_status == PASSWORD_RECOVERY_DISABLED:
            current_user.password_recovery_enabled = False
            current_user.password_recovery_subscription_arn = None
        else:
            current_user.password_recovery_subscription_arn = subscription_arn
            recovery_status = actual_status
    elif current_user.password_recovery_subscription_arn and current_user.password_recovery_topic_arn:
        try:
            current_user.password_recovery_subscription_arn = disable_password_reset_subscription(
                current_user.password_recovery_topic_arn,
                current_user.email,
            )
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Password recovery subscription status could not be checked.",
            ) from exc

    return flood_status, recovery_status


def _notification_response(
    current_user: User,
    db: Session,
    message: str | None = None,
) -> NotificationStatusResponse:
    flood_status, recovery_status = _reconcile_notification_statuses(current_user)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return NotificationStatusResponse(
        flood_alerts=_notification_status(flood_status),
        password_recovery=_notification_status(recovery_status),
        message=message,
    )


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/notification-status", response_model=NotificationStatusResponse)
def get_notification_status(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> NotificationStatusResponse:
    """Return the authenticated citizen's real, reconciled SNS states."""
    return _notification_response(current_user, db)


@router.post("/flood-alerts/enable", response_model=NotificationStatusResponse)
def enable_flood_alerts(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> NotificationStatusResponse:
    try:
        subscription_status, subscription_arn = enable_flood_alert_subscription(current_user.email)
    except HTTPException:
        raise

    current_user.email_alerts = True
    current_user.sns_subscription_arn = subscription_arn
    return _notification_response(
        current_user,
        db,
        "Email notifications are active."
        if subscription_status == SUBSCRIPTION_CONFIRMED
        else "Confirmation email sent. Please check your inbox and confirm the SNS subscription.",
    )


@router.post("/flood-alerts/disable", response_model=NotificationStatusResponse)
def disable_flood_alerts(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> NotificationStatusResponse:
    try:
        current_user.sns_subscription_arn = disable_flood_alert_subscription(current_user.email)
    except HTTPException:
        raise

    current_user.email_alerts = False
    return _notification_response(current_user, db, "Email notifications are disabled.")


@router.post("/password-recovery/enable", response_model=NotificationStatusResponse)
def enable_password_recovery(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> NotificationStatusResponse:
    try:
        topic_arn, subscription_arn, subscription_status = enable_password_reset_subscription(current_user.email)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Password recovery subscription could not be enabled.",
        ) from exc

    current_user.password_recovery_enabled = True
    current_user.password_recovery_topic_arn = topic_arn
    current_user.password_recovery_subscription_arn = subscription_arn
    return _notification_response(
        current_user,
        db,
        "Email notifications are active."
        if subscription_status == PASSWORD_RECOVERY_CONFIRMED
        else "Confirmation email sent. Please check your inbox and confirm the SNS subscription.",
    )


@router.post("/password-recovery/disable", response_model=NotificationStatusResponse)
def disable_password_recovery(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> NotificationStatusResponse:
    try:
        current_user.password_recovery_subscription_arn = disable_password_reset_subscription(
            current_user.password_recovery_topic_arn,
            current_user.email,
        )
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Password recovery subscription could not be disabled.",
        ) from exc

    current_user.password_recovery_enabled = False
    return _notification_response(current_user, db, "Email notifications are disabled.")


@router.put("/profile", response_model=ProfileUpdateResponse)
def update_profile(
    profile_in: UserUpdate,
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> ProfileUpdateResponse:
    update_data = profile_in.model_dump(exclude_unset=True)
    messages: list[str] = []
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
                messages.append("Subscription request sent. Check your email and confirm the subscription.")
            elif is_subscription_pending(current_user.sns_subscription_arn):
                messages.append("Email subscription is pending confirmation. Check your inbox.")
            else:
                messages.append("Email alerts remain enabled. Check your inbox if confirmation is still required.")
        else:
            if current_user.sns_subscription_arn:
                unsubscribe(current_user.sns_subscription_arn)
                current_user.sns_subscription_arn = None
            messages.append("Email alerts disabled.")
        current_user.email_alerts = new_val

    # Apply remaining fields
    if "password_recovery_enabled" in update_data:
        new_val = update_data["password_recovery_enabled"]
        if new_val is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Password recovery must be enabled or disabled explicitly.",
            )
        if new_val:
            try:
                if current_user.password_recovery_topic_arn:
                    recovery_status, subscription_arn = get_password_reset_subscription_status(
                        current_user.password_recovery_topic_arn,
                        current_user.email,
                    )
                    if recovery_status == PASSWORD_RECOVERY_DISABLED:
                        topic_arn, subscription_arn, recovery_status = enable_password_reset_subscription(
                            current_user.email
                        )
                    else:
                        topic_arn = current_user.password_recovery_topic_arn
                else:
                    topic_arn, subscription_arn, recovery_status = enable_password_reset_subscription(
                        current_user.email
                    )
            except EmailDeliveryError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Password recovery subscription could not be enabled.",
                ) from exc

            current_user.password_recovery_enabled = True
            current_user.password_recovery_topic_arn = topic_arn
            current_user.password_recovery_subscription_arn = subscription_arn
            if recovery_status == PASSWORD_RECOVERY_CONFIRMED:
                messages.append("Password recovery email is confirmed and ready.")
            else:
                messages.append("Password recovery email is pending confirmation. Check your inbox and confirm the SNS subscription.")
        else:
            try:
                unsubscribe_password_reset_subscription(current_user.password_recovery_subscription_arn)
            except EmailDeliveryError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Password recovery subscription could not be disabled.",
                ) from exc
            current_user.password_recovery_enabled = False
            current_user.password_recovery_subscription_arn = None
            messages.append("Password recovery email disabled.")
    for field, value in update_data.items():
        if field in {"email_alerts", "password_recovery_enabled"}:
            continue
        if isinstance(value, str):
            value = value.strip() or None
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {
        "user": current_user,
        "message": " ".join(messages) or None,
    }


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "Logged out successfully. Remove the token from the client."}


@router.post("/password-recovery/check-status", response_model=ProfileUpdateResponse)
def check_password_recovery_status(
    current_user: User = Depends(require_exact_role(UserRole.public)),
    db: Session = Depends(get_db),
) -> ProfileUpdateResponse:
    if not current_user.password_recovery_enabled or not current_user.password_recovery_topic_arn:
        current_user.password_recovery_enabled = False
        current_user.password_recovery_subscription_arn = None
        message = "Password recovery email is disabled."
    else:
        try:
            recovery_status, subscription_arn = get_password_reset_subscription_status(
                current_user.password_recovery_topic_arn,
                current_user.email,
            )
        except EmailDeliveryError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Password recovery subscription status could not be checked.",
            ) from exc

        if recovery_status == PASSWORD_RECOVERY_CONFIRMED:
            current_user.password_recovery_subscription_arn = subscription_arn
            message = "Password recovery email is confirmed and ready."
        elif recovery_status == PASSWORD_RECOVERY_PENDING:
            current_user.password_recovery_subscription_arn = "PendingConfirmation"
            message = "Password recovery email is still pending confirmation."
        else:
            current_user.password_recovery_enabled = False
            current_user.password_recovery_subscription_arn = None
            message = "Password recovery email is disabled."

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"user": current_user, "message": message}
