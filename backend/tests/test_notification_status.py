from unittest.mock import MagicMock

from models.user import User, UserRole
from routers import auth as auth_router
from routers.auth import hash_password
from services import sns_service


def make_public_user(db, email="citizen@example.com"):
    user = User(
        name="Citizen",
        email=email,
        password_hash=hash_password("Password123!"),
        role=UserRole.public,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_authenticated_client(client, user):
    test_client, current_user = client
    current_user["value"] = user
    return test_client


def test_notification_status_defaults_to_disabled(client, db):
    user = make_public_user(db)

    response = make_authenticated_client(client, user).get("/api/auth/notification-status")

    assert response.status_code == 200
    assert response.json() == {
        "flood_alerts": {"enabled": False, "status": "disabled", "label": "Disabled"},
        "password_recovery": {"enabled": False, "status": "disabled", "label": "Disabled"},
        "message": None,
    }


def test_flood_alert_status_detects_pending_and_confirmed_from_sns(client, db, monkeypatch):
    user = make_public_user(db)
    user.email_alerts = True
    db.commit()
    statuses = iter([
        ("pending", "PendingConfirmation"),
        ("confirmed", "arn:aws:sns:us-east-1:123:alerts:confirmed"),
    ])
    monkeypatch.setattr(auth_router, "get_flood_alert_subscription_status", lambda _email: next(statuses))
    test_client = make_authenticated_client(client, user)

    pending = test_client.get("/api/auth/notification-status")
    confirmed = test_client.get("/api/auth/notification-status")

    assert pending.json()["flood_alerts"] == {
        "enabled": True,
        "status": "pending",
        "label": "Pending confirmation",
    }
    assert confirmed.json()["flood_alerts"] == {
        "enabled": True,
        "status": "confirmed",
        "label": "Confirmed & Active",
    }
    assert user.sns_subscription_arn.endswith("confirmed")


def test_enable_flood_alerts_uses_authenticated_email_and_persists_pending(client, db, monkeypatch):
    user = make_public_user(db, "owner@example.com")
    enable = MagicMock(return_value=("pending", "PendingConfirmation"))
    monkeypatch.setattr(auth_router, "enable_flood_alert_subscription", enable)
    monkeypatch.setattr(auth_router, "get_flood_alert_subscription_status", lambda _email: ("pending", "PendingConfirmation"))

    response = make_authenticated_client(client, user).post(
        "/api/auth/flood-alerts/enable",
        json={"email": "other@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["flood_alerts"]["status"] == "pending"
    assert "Confirmation email sent" in response.json()["message"]
    enable.assert_called_once_with("owner@example.com")
    db.expire_all()
    assert db.get(User, user.id).email_alerts is True
    assert db.get(User, user.id).sns_subscription_arn == "PendingConfirmation"


def test_repeated_flood_enable_does_not_create_duplicate_sns_subscription(monkeypatch):
    sns = MagicMock()
    sns.list_subscriptions_by_topic.return_value = {
        "Subscriptions": [{
            "Protocol": "email",
            "Endpoint": "citizen@example.com",
            "SubscriptionArn": "PendingConfirmation",
        }]
    }
    monkeypatch.setattr(sns_service, "sns_client", sns)

    state, subscription_arn = sns_service.enable_flood_alert_subscription("citizen@example.com")

    assert (state, subscription_arn) == ("pending", "PendingConfirmation")
    sns.subscribe.assert_not_called()


def test_flood_alert_sns_listing_distinguishes_pending_confirmed_and_unsubscribes_exact_email(monkeypatch):
    confirmed_arn = "arn:aws:sns:us-east-1:123:alerts:owner"
    sns = MagicMock()
    sns.list_subscriptions_by_topic.side_effect = [
        {"Subscriptions": [{
            "Protocol": "email",
            "Endpoint": "owner@example.com",
            "SubscriptionArn": "PendingConfirmation",
        }]},
        {"Subscriptions": [
            {
                "Protocol": "email",
                "Endpoint": "owner@example.com",
                "SubscriptionArn": confirmed_arn,
            },
            {
                "Protocol": "email",
                "Endpoint": "another@example.com",
                "SubscriptionArn": "arn:aws:sns:us-east-1:123:alerts:another",
            },
        ]},
        {"Subscriptions": [
            {
                "Protocol": "email",
                "Endpoint": "owner@example.com",
                "SubscriptionArn": confirmed_arn,
            },
            {
                "Protocol": "email",
                "Endpoint": "another@example.com",
                "SubscriptionArn": "arn:aws:sns:us-east-1:123:alerts:another",
            },
        ]},
    ]
    monkeypatch.setattr(sns_service, "sns_client", sns)

    pending = sns_service.get_flood_alert_subscription_status("OWNER@example.com")
    confirmed = sns_service.get_flood_alert_subscription_status("owner@example.com")
    marker = sns_service.disable_flood_alert_subscription("owner@example.com")

    assert pending == ("pending", "PendingConfirmation")
    assert confirmed == ("confirmed", confirmed_arn)
    assert marker is None
    sns.unsubscribe.assert_called_once_with(SubscriptionArn=confirmed_arn)


def test_disable_confirmed_flood_alert_unsubscribes_only_current_users_subscription(client, db, monkeypatch):
    user = make_public_user(db, "owner@example.com")
    user.email_alerts = True
    user.sns_subscription_arn = "arn:old"
    db.commit()
    disable = MagicMock(return_value=None)
    monkeypatch.setattr(auth_router, "disable_flood_alert_subscription", disable)

    response = make_authenticated_client(client, user).post("/api/auth/flood-alerts/disable")

    assert response.status_code == 200
    assert response.json()["flood_alerts"]["status"] == "disabled"
    disable.assert_called_once_with("owner@example.com")
    assert user.email_alerts is False
    assert user.sns_subscription_arn is None


def test_disabled_pending_flood_alert_is_reconciled_and_cleaned_after_confirmation(client, db, monkeypatch):
    user = make_public_user(db)
    user.sns_subscription_arn = "PendingConfirmation"
    db.commit()
    cleanup = MagicMock(return_value=None)
    monkeypatch.setattr(auth_router, "disable_flood_alert_subscription", cleanup)

    response = make_authenticated_client(client, user).get("/api/auth/notification-status")

    assert response.status_code == 200
    cleanup.assert_called_once_with(user.email)
    assert user.sns_subscription_arn is None


def test_password_recovery_statuses_are_independent_and_dynamic(client, db, monkeypatch):
    user = make_public_user(db)
    user.password_recovery_enabled = True
    user.password_recovery_topic_arn = "arn:aws:sns:us-east-1:123:private-topic"
    db.commit()
    statuses = iter([
        ("pending", "PendingConfirmation"),
        ("confirmed", "arn:aws:sns:us-east-1:123:private-topic:confirmed"),
    ])
    monkeypatch.setattr(auth_router, "get_password_reset_subscription_status", lambda _topic, _email: next(statuses))
    test_client = make_authenticated_client(client, user)

    pending = test_client.get("/api/auth/notification-status")
    confirmed = test_client.get("/api/auth/notification-status")

    assert pending.json()["password_recovery"]["status"] == "pending"
    assert confirmed.json()["password_recovery"] == {
        "enabled": True,
        "status": "confirmed",
        "label": "Confirmed & Active",
    }
    assert confirmed.json()["flood_alerts"]["status"] == "disabled"


def test_enable_and_disable_password_recovery_are_scoped_to_authenticated_user(client, db, monkeypatch):
    user = make_public_user(db, "owner@example.com")
    topic_arn = "arn:aws:sns:us-east-1:123:owner-private-topic"
    enable = MagicMock(return_value=(topic_arn, "PendingConfirmation", "pending"))
    monkeypatch.setattr(auth_router, "enable_password_reset_subscription", enable)
    monkeypatch.setattr(auth_router, "get_password_reset_subscription_status", lambda _topic, _email: ("pending", "PendingConfirmation"))
    test_client = make_authenticated_client(client, user)

    enabled = test_client.post("/api/auth/password-recovery/enable", json={"user_id": 999})

    assert enabled.status_code == 200
    assert enabled.json()["password_recovery"]["status"] == "pending"
    enable.assert_called_once_with("owner@example.com")

    disable = MagicMock(return_value=None)
    monkeypatch.setattr(auth_router, "disable_password_reset_subscription", disable)
    disabled = test_client.post("/api/auth/password-recovery/disable")

    assert disabled.status_code == 200
    assert disabled.json()["password_recovery"]["status"] == "disabled"
    disable.assert_called_once_with(topic_arn, "owner@example.com")
    assert user.password_recovery_enabled is False


def test_notification_management_rejects_non_citizen_roles(client, db, monkeypatch):
    officer = User(
        name="Officer",
        email="officer@example.com",
        password_hash=hash_password("Password123!"),
        role=UserRole.field_officer,
    )
    db.add(officer)
    db.commit()
    enable = MagicMock()
    monkeypatch.setattr(auth_router, "enable_flood_alert_subscription", enable)

    response = make_authenticated_client(client, officer).post("/api/auth/flood-alerts/enable")

    assert response.status_code == 403
    enable.assert_not_called()
