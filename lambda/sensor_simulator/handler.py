"""One-reading-per-invocation FloodGuard sensor simulator.

EventBridge invokes this handler once per minute. The handler fetches the
selected station's live thresholds, generates one value for the current phase,
and submits only the station code and measurement to the device endpoint.
"""

from __future__ import annotations

import json
import logging
import math
import os
import random
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SEQUENCE = (
    "safe",
    "safe",
    "watch",
    "watch",
    "warning",
    "warning",
    "emergency",
    "emergency",
    "warning",
    "watch",
    "safe",
)


class SimulatorError(Exception):
    """Expected configuration or response error from the simulator."""


class ApiRequestError(SimulatorError):
    def __init__(self, status_code: int):
        self.status_code = status_code
        super().__init__(f"FloodGuard API returned HTTP {status_code}.")


class ApiTransportError(SimulatorError):
    pass


@dataclass(frozen=True)
class SimulatorConfig:
    api_url: str
    station_code: str
    token: str
    enabled: bool
    timeout_seconds: float


def api_base_url(value: str) -> str:
    root = (value or "").strip().rstrip("/")
    if not root:
        return ""
    return root if root.endswith("/api") else f"{root}/api"


def _env_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_config() -> SimulatorConfig:
    raw_timeout = os.getenv("HTTP_TIMEOUT_SECONDS", "8")
    try:
        timeout = float(raw_timeout)
    except ValueError as exc:
        raise SimulatorError("HTTP_TIMEOUT_SECONDS must be numeric.") from exc
    if timeout <= 0:
        raise SimulatorError("HTTP_TIMEOUT_SECONDS must be greater than zero.")
    return SimulatorConfig(
        api_url=api_base_url(os.getenv("FLOODGUARD_API_URL", "")),
        station_code=os.getenv("SENSOR_STATION_CODE", "STN001").strip() or "STN001",
        token=os.getenv("SENSOR_INGESTION_TOKEN", ""),
        enabled=_env_bool(os.getenv("SIMULATOR_ENABLED"), default=False),
        timeout_seconds=timeout,
    )


def current_epoch_minute() -> int:
    return math.floor(time.time() / 60)


def requested_phase(epoch_minute: int | None = None) -> str:
    minute = current_epoch_minute() if epoch_minute is None else int(epoch_minute)
    return SEQUENCE[minute % len(SEQUENCE)]


def classify_level(level: float, watch: float, warning: float, emergency: float) -> str:
    if level >= emergency:
        return "emergency"
    if level >= warning:
        return "warning"
    if level >= watch:
        return "watch"
    return "safe"


def _random_below(lower: float, upper: float, rng: random.Random) -> float:
    if upper <= lower:
        return lower
    return lower + rng.random() * (upper - lower)


def generate_level(
    phase: str,
    watch: float,
    warning: float,
    emergency: float,
    rng: random.Random | None = None,
) -> float:
    """Generate a varied value that remains inside the requested state."""
    if not 0 < watch < warning < emergency:
        raise SimulatorError("Station thresholds must satisfy 0 < watch < warning < emergency.")
    if phase not in SEQUENCE:
        raise SimulatorError(f"Unsupported simulator phase: {phase}")

    generator = rng or random.Random()
    if phase == "safe":
        return _random_below(watch * 0.6, math.nextafter(watch, 0), generator)
    if phase == "watch":
        return _random_below(watch, math.nextafter(warning, watch), generator)
    if phase == "warning":
        return _random_below(warning, math.nextafter(emergency, warning), generator)
    return emergency + generator.random() * max(0.1, emergency * 0.08)


def _request_json(
    url: str,
    *,
    method: str,
    token: str,
    timeout_seconds: float,
    payload: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any]]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "Accept": "application/json",
        "X-Sensor-Token": token,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            status_code = int(response.getcode())
            raw = response.read()
    except HTTPError as exc:
        raise ApiRequestError(exc.code) from exc
    except (TimeoutError, URLError, OSError) as exc:
        raise ApiTransportError(f"Could not reach FloodGuard API: {type(exc).__name__}.") from exc

    try:
        decoded = json.loads(raw.decode("utf-8")) if raw else {}
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SimulatorError("FloodGuard API returned invalid JSON.") from exc
    if not isinstance(decoded, dict):
        raise SimulatorError("FloodGuard API returned an invalid response.")
    return status_code, decoded


def fetch_station_config(config: SimulatorConfig) -> dict[str, Any]:
    if not config.api_url:
        raise SimulatorError("FLOODGUARD_API_URL is not configured.")
    if not config.token:
        raise SimulatorError("SENSOR_INGESTION_TOKEN is not configured.")
    station_path = quote(config.station_code, safe="")
    _, station = _request_json(
        f"{config.api_url}/sensors/device-stations/{station_path}",
        method="GET",
        token=config.token,
        timeout_seconds=config.timeout_seconds,
    )
    return station


def submit_reading(
    config: SimulatorConfig,
    level: float,
) -> tuple[int, dict[str, Any]]:
    return _request_json(
        f"{config.api_url}/sensors/device-reading",
        method="POST",
        token=config.token,
        timeout_seconds=config.timeout_seconds,
        payload={"station_code": config.station_code, "water_level": round(level, 3)},
    )


def lambda_handler(event: dict[str, Any] | None, context: Any) -> dict[str, Any]:
    del event, context
    try:
        config = load_config()
        if not config.enabled:
            logger.info("Simulator disabled")
            return {"status": "disabled"}

        station = fetch_station_config(config)
        if not station.get("is_active", False):
            raise SimulatorError("Configured station is inactive.")
        watch = float(station["watch_threshold"])
        warning = float(station["warning_threshold"])
        emergency = float(station["danger_threshold"])
        phase = requested_phase()
        level = generate_level(phase, watch, warning, emergency)
        api_status, response = submit_reading(config, level)
        classified = response.get("status", response.get("alert_level", "unknown"))

        logger.info("FloodGuard AWS Sensor Simulator")
        logger.info("Station: %s", config.station_code)
        logger.info("Requested phase: %s", phase.upper())
        logger.info("Generated level: %.2f m", level)
        logger.info("API status: %s", api_status)
        logger.info("Classified status: %s", str(classified).upper())
        return {
            "status": "submitted",
            "station_code": config.station_code,
            "phase": phase,
            "water_level": round(level, 3),
            "api_status": api_status,
            "classified_status": classified,
        }
    except ApiRequestError as exc:
        logger.error("Simulator API request failed with HTTP %s.", exc.status_code)
        return {"status": "error", "reason": "api_error", "http_status": exc.status_code}
    except ApiTransportError as exc:
        logger.error("Simulator API request failed: %s", exc)
        return {"status": "error", "reason": "transport_error"}
    except SimulatorError as exc:
        logger.error("Sensor simulator stopped: %s", exc)
        return {"status": "error", "reason": "configuration_or_response_error"}

    except (KeyError, TypeError, ValueError):
        logger.error("Sensor simulator stopped: station configuration is invalid.")
        return {"status": "error", "reason": "invalid_station_configuration"}
