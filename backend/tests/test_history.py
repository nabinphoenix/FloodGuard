from models.user import UserRole


EXPECTED_PROVINCES = {
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
}


def test_public_history_endpoints_require_no_jwt(client):
    test_client, current_user = client
    current_user["value"] = None

    assert test_client.get("/api/history/floods/summary").status_code == 200
    assert test_client.get("/api/history/floods/annual").status_code == 200
    assert test_client.get("/api/history/floods/events").status_code == 200
    assert test_client.get("/api/history/geography").status_code == 200
    assert test_client.get("/api/history/basins").status_code == 200
    assert test_client.get("/api/history/sources").status_code == 200


def test_history_annual_values_and_totals(client):
    test_client, _ = client
    summary = test_client.get("/api/history/floods/summary").json()
    annual = test_client.get("/api/history/floods/annual").json()["records"]

    assert len(annual) == 13
    assert next(record for record in annual if record["year"] == 2017)["flood_incidents"] == 338
    assert next(record for record in annual if record["year"] == 2013)["deaths"] == 131
    assert summary["flood_incidents"] == 1967
    assert summary["deaths"] == 894
    assert summary["missing"] == 584
    assert summary["injured"] == 217
    assert summary["affected_families"] == 69042
    assert summary["estimated_loss_npr"] == 17083333888


def test_geography_filters_and_no_fabricated_aggregation(client):
    test_client, _ = client
    geography = test_client.get("/api/history/geography").json()
    assert {province["name"] for province in geography["provinces"]} == EXPECTED_PROVINCES

    chitwan = test_client.get("/api/history/geography", params={"province": "Bagmati", "district": "Chitwan"}).json()
    chitwan_district = chitwan["districts"][0]
    assert chitwan_district["province"] == "Bagmati"
    assert "Narayani" in chitwan_district["rivers"]
    assert "Rapti" in chitwan_district["rivers"]

    sunsari = test_client.get("/api/history/geography", params={"province": "Koshi", "district": "Sunsari"}).json()
    assert sunsari["districts"][0]["province"] == "Koshi"

    kailali = test_client.get("/api/history/geography", params={"province": "Sudurpashchim", "district": "Kailali"}).json()
    assert kailali["districts"][0]["province"] == "Sudurpashchim"

    river = test_client.get("/api/history/geography", params={"province": "Bagmati", "district": "Chitwan", "river": "Narayani"}).json()
    assert river["rivers"] == ["Narayani"]

    invalid = test_client.get("/api/history/geography", params={"province": "Koshi", "district": "Chitwan"}).json()
    assert invalid["districts"] == []

    unsupported = test_client.get("/api/history/floods/annual", params={"province": "Bagmati"}).json()
    assert unsupported["records"] == []
    assert "not available" in unsupported["message"].lower()


def test_major_events_include_required_records(client):
    test_client, _ = client
    events = test_client.get("/api/history/floods/events").json()["events"]
    names = {event["year"] for event in events}
    assert {1993, 2008, 2013, 2017, 2021}.issubset(names)
