"""Authenticated FloodGuard water-level simulator.

This utility deliberately submits real API readings. It never seeds the
database, fabricates frontend state, prints credentials, or prints JWTs.
"""

from __future__ import annotations

import argparse
import getpass
import os
import random
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests


DEFAULT_API_URL = "http://localhost:8000"
STATES = ("safe", "watch", "warning", "emergency")


def api_base_url(value: str) -> str:
    base = value.strip().rstrip("/")
    return base if base.lower().endswith("/api") else f"{base}/api"


def classify_level(level: float, watch: float, warning: float, danger: float) -> str:
    if level >= danger:
        return "emergency"
    if level >= warning:
        return "warning"
    if level >= watch:
        return "watch"
    return "safe"


def state_level(phase: str, watch: float, warning: float, danger: float) -> float:
    if phase == "safe":
        return round(max(0.0, watch * 0.65), 2)
    if phase == "watch":
        return round(watch + ((warning - watch) * 0.45), 2)
    if phase == "warning":
        return round(warning + ((danger - warning) * 0.45), 2)
    if phase == "emergency":
        return round(danger + max(0.1, danger * 0.05), 2)
    raise ValueError(f"Unknown simulator state: {phase}")


def simulation_cycle(watch: float, warning: float, danger: float) -> list[tuple[str, float]]:
    if watch < 0:
        raise ValueError("Watch threshold must be at least 0.")
    if watch >= warning:
        raise ValueError("Watch threshold must be less than warning threshold.")
    if warning >= danger:
        raise ValueError("Warning threshold must be less than emergency threshold.")

    phases = [
        "safe", "safe",
        "watch", "watch",
        "warning", "warning",
        "emergency", "emergency",
        "warning", "watch", "safe",
    ]
    return [(phase, state_level(phase, watch, warning, danger)) for phase in phases]


def vary_level(
    level: float,
    phase: str,
    watch: float,
    warning: float,
    danger: float,
    rng: random.Random,
) -> float:
    span = max(danger - watch, 0.1)
    value = level + rng.uniform(-span * 0.04, span * 0.04)
    if phase == "safe":
        return round(max(0.0, min(value, watch - 0.01)), 2)
    if phase == "watch":
        return round(min(max(value, watch), warning - 0.01), 2)
    if phase == "warning":
        return round(min(max(value, warning), danger - 0.01), 2)
    return round(max(value, danger), 2)


def login(session: requests.Session, api_root: str, email: str, password: str) -> str:
    response = session.post(
        f"{api_root}/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError("Login response did not contain an access token.")
    return token


def station_config(session: requests.Session, api_root: str, station_id: str) -> dict[str, Any]:
    response = session.get(f"{api_root}/sensors/stations", timeout=15)
    response.raise_for_status()
    station = next(
        (
            item for item in response.json()
            if item.get("id") == station_id or item.get("station_code") == station_id
        ),
        None,
    )
    if station is None:
        raise LookupError(f"Sensor station '{station_id}' was not found.")
    return station


def post_reading(session: requests.Session, api_root: str, station_id: str, water_level: float) -> dict[str, Any]:
    response = session.post(
        f"{api_root}/sensors/reading",
        json={
            "station_code": station_id,
            "water_level": water_level,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Post authenticated synthetic water-level readings to FloodGuard."
    )
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Backend base URL, for example http://localhost:8000")
    parser.add_argument("--station", required=True, help="Station code, for example STN001")
    parser.add_argument("--email", default=os.getenv("FLOODGUARD_EMAIL"), help="Login email or FLOODGUARD_EMAIL")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between readings (default: 5)")
    parser.add_argument("--count", type=int, default=0, help="Number of readings; 0 runs until Ctrl+C")
    parser.add_argument("--scenario", choices=["cycle"], default="cycle", help="Threshold-derived scenario (default: cycle)")
    parser.add_argument("--state", choices=STATES, help="Send readings inside one fixed state instead of the cycle")
    return parser.parse_args(argv)


def _api_error(prefix: str, exc: requests.HTTPError) -> str:
    detail = ""
    if exc.response is not None:
        try:
            detail = exc.response.json().get("detail", "")
        except ValueError:
            pass
    code = exc.response.status_code if exc.response is not None else "unknown"
    return f"{prefix} ({code}){': ' + str(detail) if detail else ''}"


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.interval < 0 or args.count < 0:
        print("Error: --interval and --count must be zero or greater.", file=sys.stderr)
        return 2

    email = args.email or input("FloodGuard email: ").strip()
    password = os.getenv("FLOODGUARD_PASSWORD") or getpass.getpass("FloodGuard password: ")
    api_root = api_base_url(args.api_url)
    session = requests.Session()

    try:
        token = login(session, api_root, email, password)
        session.headers.update({"Authorization": f"Bearer {token}"})
        station = station_config(session, api_root, args.station)
        watch = float(station["watch_threshold"])
        warning = float(station["warning_threshold"])
        danger = float(station["danger_threshold"])
        phases = (
            [(args.state, state_level(args.state, watch, warning, danger))]
            if args.state
            else simulation_cycle(watch, warning, danger)
        )
    except LookupError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except requests.HTTPError as exc:
        print(_api_error("Error: API request failed", exc), file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Error: could not reach FloodGuard API: {exc}", file=sys.stderr)
        return 1
    except (KeyError, TypeError, ValueError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("FloodGuard Water-Level Simulator")
    print(f"Station: {station.get('station_code') or station.get('id')} - {station.get('station_name') or station.get('name')}")
    print(f"Province: {station.get('province') or 'Not configured'}")
    print(f"District: {station.get('district') or 'Not configured'}")
    print(f"River: {station.get('river_name') or 'Not configured'}")
    print(f"Watch: {watch:.2f} m")
    print(f"Warning: {warning:.2f} m")
    print(f"Emergency: {danger:.2f} m")
    print("Posting threshold-derived phases. Press Ctrl+C to stop.")

    rng = random.Random()
    sent = 0
    try:
        while args.count == 0 or sent < args.count:
            phase, base_level = phases[sent % len(phases)]
            level = vary_level(base_level, phase, watch, warning, danger, rng)
            actual_phase = classify_level(level, watch, warning, danger)
            result = post_reading(session, api_root, args.station, level)
            returned_phase = result.get("status", result.get("alert_level", actual_phase))
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"{level:.2f} m -> {returned_phase.upper()}",
                flush=True,
            )
            sent += 1
            if args.count == 0 or sent < args.count:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print(f"\nSimulator stopped after {sent} reading(s).")
    except requests.HTTPError as exc:
        print(_api_error("Error: reading was rejected", exc), file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Error: could not post reading: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
