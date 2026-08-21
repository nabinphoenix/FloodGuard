"""Authenticated FloodGuard water-level simulator.

The simulator logs in through the API, reads the selected station's live
threshold configuration, and posts synthetic readings to the normal ingestion
endpoint. It never seeds the database or prints credentials/tokens.
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


def api_base_url(value: str) -> str:
    """Return an API root ending in exactly one /api segment."""
    base = value.strip().rstrip("/")
    if base.lower().endswith("/api"):
        return base
    return f"{base}/api"


def classify_level(level: float, warning: float, danger: float) -> str:
    """Apply the production sensor classification boundaries."""
    if level >= danger:
        return "emergency"
    if level >= warning:
        return "warning"
    return "safe"


def simulation_cycle(warning: float, danger: float) -> list[tuple[str, float]]:
    """Return one deterministic phase cycle derived from station thresholds.

    A valid station may have equal warning and danger thresholds. In that case
    no distinct warning band exists, so the cycle skips that phase rather than
    posting a value with a misleading label.
    """
    if warning < 0 or danger < warning:
        raise ValueError("Station thresholds must satisfy 0 <= warning <= danger.")

    safe = max(0.0, warning * 0.65)
    if danger == warning:
        phases = [("safe", safe), ("safe", safe), ("emergency", danger + 0.1), ("safe", safe)]
    else:
        warning_level = warning + ((danger - warning) * 0.45)
        emergency_level = danger + max(0.1, danger * 0.05)
        phases = [
            ("safe", safe),
            ("safe", safe),
            ("warning", warning_level),
            ("warning", warning_level),
            ("emergency", emergency_level),
            ("warning", warning_level),
            ("safe", safe),
        ]

    return [(expected, round(level, 2)) for expected, level in phases]


def vary_level(level: float, phase: str, warning: float, danger: float, rng: random.Random) -> float:
    """Add small variation while keeping the generated phase valid."""
    span = max(danger - warning, 0.1)
    variation = rng.uniform(-span * 0.05, span * 0.05)
    value = level + variation

    if phase == "safe":
        value = min(value, max(0.0, warning - 0.01))
        return max(0.0, value)
    if phase == "warning" and danger > warning:
        return min(max(value, warning), danger - 0.01)
    if phase == "emergency":
        return max(value, danger)
    return max(0.0, value)


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
    stations = response.json()
    station = next((item for item in stations if item.get("id") == station_id), None)
    if station is None:
        raise LookupError(f"Sensor station '{station_id}' was not found.")
    return station


def post_reading(
    session: requests.Session,
    api_root: str,
    station_id: str,
    water_level: float,
) -> dict[str, Any]:
    response = session.post(
        f"{api_root}/sensors/reading",
        json={
            "station_id": station_id,
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
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Frontend/backend base URL, for example http://localhost:8000")
    parser.add_argument("--station", required=True, help="Station ID, for example STN001")
    parser.add_argument("--email", default=os.getenv("FLOODGUARD_EMAIL"), help="Login email (or set FLOODGUARD_EMAIL)")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between readings (default: 5)")
    parser.add_argument("--count", type=int, default=0, help="Number of readings; 0 runs until Ctrl+C")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.interval < 0:
        print("Error: --interval must be zero or greater.", file=sys.stderr)
        return 2
    if args.count < 0:
        print("Error: --count must be zero or greater.", file=sys.stderr)
        return 2

    email = args.email or input("FloodGuard email: ").strip()
    password = os.getenv("FLOODGUARD_PASSWORD") or getpass.getpass("FloodGuard password: ")
    api_root = api_base_url(args.api_url)
    session = requests.Session()

    try:
        token = login(session, api_root, email, password)
        session.headers.update({"Authorization": f"Bearer {token}"})
        station = station_config(session, api_root, args.station)
        warning = float(station["warning_threshold"])
        danger = float(station["danger_threshold"])
        phases = simulation_cycle(warning, danger)
    except LookupError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except requests.HTTPError as exc:
        detail = ""
        if exc.response is not None:
            try:
                detail = exc.response.json().get("detail", "")
            except ValueError:
                detail = ""
        code = exc.response.status_code if exc.response is not None else "unknown"
        suffix = f": {detail}" if detail else ""
        print(f"Error: API request failed ({code}){suffix}", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Error: could not reach FloodGuard API: {exc}", file=sys.stderr)
        return 1
    except (KeyError, TypeError, ValueError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(
        f"FloodGuard simulator connected to {api_root}; "
        f"station {args.station} ({station.get('name', 'unnamed')}); "
        f"warning={warning:.2f} m, danger={danger:.2f} m"
    )
    print("Posting safe/warning/emergency phases. Press Ctrl+C to stop.")

    rng = random.Random()
    sent = 0
    try:
        while args.count == 0 or sent < args.count:
            phase, base_level = phases[sent % len(phases)]
            level = round(vary_level(base_level, phase, warning, danger, rng), 2)
            actual_phase = classify_level(level, warning, danger)
            result = post_reading(session, api_root, args.station, level)
            returned_phase = result.get("alert_level", actual_phase)
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(
                f"[{timestamp}] {args.station} {level:.2f} m "
                f"-> {returned_phase.upper()}",
                flush=True,
            )
            sent += 1
            if args.count == 0 or sent < args.count:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print(f"\nSimulator stopped after {sent} reading(s).")
    except requests.HTTPError as exc:
        detail = ""
        if exc.response is not None:
            try:
                detail = exc.response.json().get("detail", "")
            except ValueError:
                detail = ""
        code = exc.response.status_code if exc.response is not None else "unknown"
        suffix = f": {detail}" if detail else ""
        print(f"Error: reading was rejected ({code}){suffix}", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"Error: could not post reading: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
