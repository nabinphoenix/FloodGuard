from __future__ import annotations

import random
import sys
import time
from datetime import datetime, timezone

import requests


AUTHORITY_EMAIL = "authority@floodguard.com"
AUTHORITY_PASSWORD = "Auth@123"

STATIONS = [
    {
        "station_id": "STN001",
        "name": "Klang River KL",
        "district": "Kuala Lumpur",
        "warning_threshold": 3.5,
        "danger_threshold": 4.5,
        "base_level": 2.7,
    },
    {
        "station_id": "STN002",
        "name": "Gombak River Selangor",
        "district": "Selangor",
        "warning_threshold": 3.2,
        "danger_threshold": 4.2,
        "base_level": 2.5,
    },
    {
        "station_id": "STN003",
        "name": "Muar River Johor",
        "district": "Johor",
        "warning_threshold": 3.0,
        "danger_threshold": 4.0,
        "base_level": 2.3,
    },
]

COLORS = {
    "safe": "\033[92m",
    "warning": "\033[93m",
    "danger": "\033[91m",
    "reset": "\033[0m",
}


def status_for_level(level: float, station: dict) -> str:
    if level >= station["danger_threshold"]:
        return "danger"
    if level >= station["warning_threshold"]:
        return "warning"
    return "safe"


def authenticate(base_url: str) -> str:
    response = requests.post(
        f"{base_url}/auth/login",
        json={"email": AUTHORITY_EMAIL, "password": AUTHORITY_PASSWORD},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def send_reading(base_url: str, token: str, station: dict) -> None:
    water_level = round(
        max(0.2, random.gauss(station["base_level"], 0.55) + random.choice([0, 0, 0.4, 0.9])),
        2,
    )
    level_status = status_for_level(water_level, station)
    payload = {
        "station_id": station["station_id"],
        "water_level": water_level,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    response = requests.post(
        f"{base_url}/sensors/reading",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )

    color = COLORS[level_status]
    reset = COLORS["reset"]
    timestamp = datetime.now().strftime("%H:%M:%S")

    if response.ok:
        print(
            f"{color}[{timestamp}] {level_status.upper():7} "
            f"{station['station_id']} {station['name']} - {water_level:.2f} m{reset}",
            flush=True,
        )
    else:
        print(
            f"\033[91m[{timestamp}] FAILED  {station['station_id']} "
            f"{response.status_code}: {response.text}\033[0m",
            flush=True,
        )


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python sensor_simulator.py http://localhost:8000")
        sys.exit(1)

    base_url = sys.argv[1].rstrip("/")
    token = authenticate(base_url)
    print("FloodGuard sensor simulator started. Press Ctrl+C to stop.")

    while True:
        for station in STATIONS:
            send_reading(base_url, token, station)
        time.sleep(30)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSensor simulator stopped.")
