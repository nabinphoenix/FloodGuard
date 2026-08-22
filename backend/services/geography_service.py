from __future__ import annotations

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "nepal_flood_geography.json"


@lru_cache(maxsize=1)
def load_geography() -> dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def province_names() -> list[str]:
    return [province["name"] for province in load_geography()["provinces"]]


def _matches(value: str, expected: str | None) -> bool:
    return not expected or value.casefold() == expected.strip().casefold()


def filtered_geography(
    province: str | None = None,
    district: str | None = None,
    river_basin: str | None = None,
    river: str | None = None,
) -> dict[str, Any]:
    data = load_geography()
    selected_provinces: list[dict[str, Any]] = []

    for source_province in data["provinces"]:
        if not _matches(source_province["name"], province):
            continue

        selected_districts: list[dict[str, Any]] = []
        for source_district in source_province["districts"]:
            if not _matches(source_district["name"], district):
                continue
            if river_basin and not any(
                basin.casefold() == river_basin.strip().casefold()
                for basin in source_district.get("river_basins", [])
            ):
                continue
            if river and not any(
                name.casefold() == river.strip().casefold()
                for name in source_district.get("rivers", [])
            ):
                continue

            selected_district = copy.deepcopy(source_district)
            if river_basin:
                selected_district["river_basins"] = [
                    basin
                    for basin in selected_district.get("river_basins", [])
                    if basin.casefold() == river_basin.strip().casefold()
                ]
            if river:
                selected_district["rivers"] = [
                    name
                    for name in selected_district.get("rivers", [])
                    if name.casefold() == river.strip().casefold()
                ]
            selected_districts.append(selected_district)

        if selected_districts or (not district and not river_basin and not river):
            selected_province = copy.deepcopy(source_province)
            selected_province["districts"] = selected_districts
            selected_provinces.append(selected_province)

    districts = [
        {"province": province_item["name"], **district_item}
        for province_item in selected_provinces
        for district_item in province_item["districts"]
    ]
    rivers = sorted({
        river_name
        for district_item in districts
        for river_name in district_item.get("rivers", [])
    })
    river_basins = sorted({
        basin_name
        for district_item in districts
        for basin_name in district_item.get("river_basins", [])
    })
    basins = [
        copy.deepcopy(basin)
        for basin in data["basins"]
        if not river_basin or basin["name"].casefold() == river_basin.strip().casefold()
    ]

    result = {
        "dataset_scope": data["dataset_scope"],
        "provinces": selected_provinces,
        "districts": districts,
        "rivers": rivers,
        "river_basins": river_basins,
        "basins": basins,
        "historical_boundary_notes": data["historical_boundary_notes"],
        "filters": {
            "province": province,
            "district": district,
            "river_basin": river_basin,
            "river": river,
        },
    }

    if province and not selected_provinces:
        result["message"] = "No geographic records are available for this selection."
    elif district and not districts:
        result["message"] = "No district is available for the selected geography."
    elif river and not rivers:
        result["message"] = "No river is available for the selected geography."

    return result


def basin_records(name: str | None = None) -> list[dict[str, Any]]:
    basins = load_geography()["basins"]
    if not name:
        return copy.deepcopy(basins)
    return [
        copy.deepcopy(basin)
        for basin in basins
        if basin["name"].casefold() == name.strip().casefold()
    ]


def _find_province(province_name: str | None) -> dict[str, Any] | None:
    if not province_name:
        return None
    return next(
        (
            province
            for province in load_geography()["provinces"]
            if province["name"].casefold() == province_name.strip().casefold()
        ),
        None,
    )


def resolve_province_district(
    province_name: str | None,
    district_name: str | None,
) -> tuple[str, str] | None:
    """Return canonical names when a district belongs to the province."""
    province = _find_province(province_name)
    if province is None or not district_name:
        return None
    district = next(
        (
            district
            for district in province["districts"]
            if district["name"].casefold() == district_name.strip().casefold()
        ),
        None,
    )
    if district is None:
        return None
    return province["name"], district["name"]


def province_for_district(district_name: str | None) -> str | None:
    """Return the unique canonical province for a district, if known."""
    if not district_name:
        return None
    district_key = district_name.strip().casefold()
    for province in load_geography()["provinces"]:
        if any(district["name"].casefold() == district_key for district in province["districts"]):
            return province["name"]
    return None


def resolve_district(district_name: str | None) -> tuple[str, str] | None:
    """Return the canonical province and district for a district name."""
    if not district_name:
        return None
    district_key = district_name.strip().casefold()
    for province in load_geography()["provinces"]:
        for district in province["districts"]:
            if district["name"].casefold() == district_key:
                return province["name"], district["name"]
    return None


def public_geography() -> dict[str, Any]:
    """Return only the province/district hierarchy needed by public forms."""
    return {
        "provinces": [
            {
                "name": province["name"],
                "districts": [{"name": district["name"]} for district in province["districts"]],
            }
            for province in load_geography()["provinces"]
        ]
    }
