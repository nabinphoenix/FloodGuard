from collections import Counter

from models.alert import AlertLevel, AlertZone
from routers import admin as admin_router
from routers import authority as authority_router
from seeders.flood_zones import seed_flood_zones, validate_zone_seeds
from services.coordinate_validation import is_within_nepal_operational_bounds
from services.geography_service import resolve_province_district
from data.flood_zone_seeds import ZONE_SEEDS


EXPECTED_PROVINCES = {
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
}


def test_zone_seed_dataset_is_valid_and_covers_all_provinces():
    validate_zone_seeds()

    province_counts = Counter(seed["province"] for seed in ZONE_SEEDS)
    names = [seed["name"].casefold() for seed in ZONE_SEEDS]

    assert set(province_counts) == EXPECTED_PROVINCES
    assert all(count >= 1 for count in province_counts.values())
    assert len(names) == len(set(names))
    assert all(
        resolve_province_district(seed["province"], seed["district"])
        == (seed["province"], seed["district"])
        for seed in ZONE_SEEDS
    )
    assert all(
        is_within_nepal_operational_bounds(seed["latitude"], seed["longitude"])
        for seed in ZONE_SEEDS
    )


def test_zone_seed_is_idempotent_and_preserves_existing_zones(db):
    existing = AlertZone(
        name="Existing Admin Zone",
        district="Kathmandu",
        alert_level=AlertLevel.watch,
        latitude=27.7,
        longitude=85.3,
        is_active=False,
    )
    db.add(existing)
    db.commit()

    first = seed_flood_zones(db)
    second = seed_flood_zones(db)

    assert first.before == 1
    assert first.added == len(ZONE_SEEDS)
    assert first.after == len(ZONE_SEEDS) + 1
    assert second.added == 0
    assert second.skipped == len(ZONE_SEEDS)
    assert second.after == first.after
    assert db.get(AlertZone, existing.id).name == "Existing Admin Zone"
    assert db.get(AlertZone, existing.id).is_active is False


def test_public_zone_filtering_supports_province_level_report_zones(client, db):
    test_client, _ = client
    seed_flood_zones(db)

    for province in EXPECTED_PROVINCES:
        response = test_client.get(
            "/api/public/zones",
            params={"province": province},
        )
        assert response.status_code == 200
        zones = response.json()
        expected_names = {seed["name"] for seed in ZONE_SEEDS if seed["province"] == province}
        assert {zone["name"] for zone in zones} == expected_names
        assert {zone["province"] for zone in zones} == {province}

    district_response = test_client.get(
        "/api/public/zones",
        params={"province": "Koshi", "district": "Jhapa"},
    )
    assert district_response.status_code == 200
    assert {zone["district"] for zone in district_response.json()} == {"Jhapa"}

    mismatch = test_client.get(
        "/api/public/zones",
        params={"province": "Koshi", "district": "Chitwan"},
    )
    assert mismatch.status_code == 200
    assert mismatch.json() == []


def test_inactive_zones_remain_admin_managed_but_are_not_public(db, client):
    test_client, _ = client
    seed_flood_zones(db)
    zone = db.query(AlertZone).filter(AlertZone.name == "Tinau River Flood Zone").one()
    zone.is_active = False
    db.commit()

    assert zone in admin_router.get_zones(db)
    assert zone not in authority_router.get_authority_zones(db)
    public = test_client.get(
        "/api/public/zones",
        params={"province": "Lumbini", "district": "Rupandehi"},
    )
    assert public.status_code == 200
    assert public.json() == []

    public_map = test_client.get("/api/public/map")
    assert public_map.status_code == 200
    assert zone.id not in {item["id"] for item in public_map.json()["zones"]}
