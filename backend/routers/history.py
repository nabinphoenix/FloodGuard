from __future__ import annotations

from fastapi import APIRouter, Query

from services.geography_service import basin_records, filtered_geography
from services.history_service import (
    annual_records,
    event_records,
    history_summary,
    limitations,
    long_term_context,
    source_metadata,
)


router = APIRouter(prefix="/history", tags=["history"])


@router.get("/floods/summary")
def get_flood_summary() -> dict:
    return history_summary()


@router.get("/floods/annual")
def get_annual_floods(
    year: int | None = Query(default=None, ge=1900, le=2100),
    start_year: int | None = Query(default=None, ge=1900, le=2100),
    end_year: int | None = Query(default=None, ge=1900, le=2100),
    province: str | None = None,
    district: str | None = None,
    river_basin: str | None = None,
    river: str | None = None,
) -> dict:
    return annual_records(
        year=year,
        start_year=start_year,
        end_year=end_year,
        province=province,
        district=district,
        river_basin=river_basin,
        river=river,
    )


@router.get("/floods/events")
def get_flood_events(
    year: int | None = Query(default=None, ge=1900, le=2100),
    district: str | None = None,
    river_basin: str | None = None,
    river: str | None = None,
) -> dict:
    return event_records(year=year, district=district, river_basin=river_basin, river=river)


@router.get("/geography")
def get_history_geography(
    province: str | None = None,
    district: str | None = None,
    river_basin: str | None = None,
    river: str | None = None,
) -> dict:
    return filtered_geography(
        province=province,
        district=district,
        river_basin=river_basin,
        river=river,
    )


@router.get("/basins")
def get_history_basins(name: str | None = None) -> dict:
    return {
        "basins": basin_records(name),
        "source_metadata": source_metadata(),
    }


@router.get("/sources")
def get_history_sources() -> dict:
    return {
        "sources": source_metadata(),
        "long_term_context": long_term_context(),
        "limitations": limitations(),
    }
