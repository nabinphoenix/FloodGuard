"""Idempotently add FloodGuard's Nepal operational/demo monitoring zones."""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from data.flood_zone_seeds import ZONE_SEEDS
from database import SessionLocal
from models.alert import AlertLevel, AlertZone
from services.coordinate_validation import is_within_nepal_operational_bounds
from services.geography_service import resolve_province_district


@dataclass(frozen=True)
class SeedSummary:
    before: int
    added: int
    after: int
    skipped: int
    added_by_province: dict[str, int]


def validate_zone_seeds() -> None:
    names: set[str] = set()
    for zone in ZONE_SEEDS:
        name_key = zone["name"].strip().casefold()
        if name_key in names:
            raise ValueError(f"Duplicate FloodGuard zone seed name: {zone['name']}")
        names.add(name_key)

        geography = resolve_province_district(zone["province"], zone["district"])
        if geography != (zone["province"], zone["district"]):
            raise ValueError(
                f"Invalid province/district seed mapping: {zone['province']} / {zone['district']}"
            )
        if not is_within_nepal_operational_bounds(zone["latitude"], zone["longitude"]):
            raise ValueError(f"Zone seed is outside FloodGuard Nepal bounds: {zone['name']}")


def seed_flood_zones(db: Session, *, commit: bool = True) -> SeedSummary:
    """Insert missing named zones without changing existing or Admin-edited rows."""

    validate_zone_seeds()
    before = db.scalar(select(func.count(AlertZone.id))) or 0
    existing_names = {
        name.strip().casefold()
        for name in db.scalars(select(AlertZone.name)).all()
        if name
    }
    added_by_province: Counter[str] = Counter()

    for seed in ZONE_SEEDS:
        if seed["name"].strip().casefold() in existing_names:
            continue
        db.add(
            AlertZone(
                name=seed["name"],
                district=seed["district"],
                alert_level=AlertLevel.safe,
                latitude=seed["latitude"],
                longitude=seed["longitude"],
                is_active=True,
            )
        )
        existing_names.add(seed["name"].strip().casefold())
        added_by_province[seed["province"]] += 1

    db.flush()
    after = db.scalar(select(func.count(AlertZone.id))) or 0
    if commit:
        db.commit()

    added = after - before
    return SeedSummary(
        before=before,
        added=added,
        after=after,
        skipped=len(ZONE_SEEDS) - added,
        added_by_province=dict(sorted(added_by_province.items())),
    )


def main() -> None:
    with SessionLocal() as db:
        summary = seed_flood_zones(db)
    print(asdict(summary))


if __name__ == "__main__":
    main()
