from models.report import IncidentReport, ReportHelpfulVote, ReportStatus
from models.user import User, UserRole
from routers.auth import hash_password


def make_user(db, email: str) -> User:
    user = User(
        name="Helpful Tester",
        email=email,
        password_hash=hash_password("Password123!"),
        role=UserRole.public,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_report_helpful_endpoint_toggles_per_user_vote(client, db):
    test_client, current_user = client
    author = make_user(db, "author-helpful@example.com")
    voter = make_user(db, "voter-helpful@example.com")
    current_user["value"] = voter
    report = IncidentReport(
        user_id=author.id,
        province="Bagmati",
        district="Chitwan",
        severity=3,
        description="Approved report for helpful toggle testing.",
        latitude=27.67,
        longitude=84.43,
        status=ReportStatus.approved,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    marked = test_client.post(f"/api/reports/{report.id}/helpful")

    assert marked.status_code == 200
    assert marked.json()["helpful_count"] == 1
    assert marked.json()["helpful_by_me"] is True
    assert db.query(ReportHelpfulVote).filter_by(report_id=report.id, user_id=voter.id).count() == 1

    unmarked = test_client.post(f"/api/reports/{report.id}/helpful")

    assert unmarked.status_code == 200
    assert unmarked.json()["helpful_count"] == 0
    assert unmarked.json()["helpful_by_me"] is False
    assert db.query(ReportHelpfulVote).filter_by(report_id=report.id, user_id=voter.id).count() == 0
