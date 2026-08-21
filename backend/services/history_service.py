from __future__ import annotations

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "nepal_flood_history.json"


@lru_cache(maxsize=1)
def load_history() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def history_summary() -> dict[str, Any]:
    data = load_history()
    return {
        "period": data["period"],
        **copy.deepcopy(data["summary"]),
        "source": data["source_metadata"][0]["source"],
        "notes": "National annual totals; not province- or district-level aggregates.",
    }


def annual_records(
    year: int | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
    province: str | None = None,
    district: str | None = None,
    river_basin: str | None = None,
    river: str | None = None,
) -> dict[str, Any]:
    records = copy.deepcopy(load_history()["annual"])
    if year is not None:
        records = [record for record in records if record["year"] == year]
    if start_year is not None:
        records = [record for record in records if record["year"] >= start_year]
    if end_year is not None:
        records = [record for record in records if record["year"] <= end_year]

    geography_filters = {
        "province": province,
        "district": district,
        "river_basin": river_basin,
        "river": river,
    }
    requested_geography = any(value for value in geography_filters.values())
    message = None
    if requested_geography:
        records = []
        message = "Province-level annual totals are not available in this dataset."

    return {
        "period": load_history()["period"],
        "records": records,
        "supported_filters": ["year", "start_year", "end_year"],
        "filters": {
            "year": year,
            "start_year": start_year,
            "end_year": end_year,
            **geography_filters,
        },
        "message": message,
        "source": load_history()["source_metadata"][0],
    }


def event_records(
    year: int | None = None,
    district: str | None = None,
    river: str | None = None,
    river_basin: str | None = None,
) -> dict[str, Any]:
    events = copy.deepcopy(load_history()["major_events"])
    if year is not None:
        events = [event for event in events if event["year"] == year]
    if district:
        needle = district.casefold()
        events = [
            event for event in events
            if any(needle in area.casefold() for area in event.get("areas", []))
        ]
    if river:
        needle = river.casefold()
        events = [
            event for event in events
            if any(needle == item.casefold() for item in event.get("rivers", []))
        ]
    if river_basin:
        needle = river_basin.casefold()
        events = [
            event for event in events
            if any(needle == item.casefold() for item in event.get("river_basins", []))
        ]

    return {
        "events": events,
        "filters": {
            "year": year,
            "district": district,
            "river": river,
            "river_basin": river_basin,
        },
        "source_metadata": copy.deepcopy(load_history()["source_metadata"]),
    }


def limitations() -> list[str]:
    return copy.deepcopy(load_history()["limitations"])


def source_metadata() -> list[dict[str, Any]]:
    return copy.deepcopy(load_history()["source_metadata"])


def long_term_context() -> dict[str, Any]:
    return copy.deepcopy(load_history()["long_term_context"])
