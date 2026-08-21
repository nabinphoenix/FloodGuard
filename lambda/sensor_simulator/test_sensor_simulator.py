import json
import logging
from io import BytesIO

import pytest

from sensor_simulator import handler


class FakeResponse:
    def __init__(self, status, payload):
        self.status = status
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def getcode(self):
        return self.status

    def read(self):
        return self.payload


def thresholds():
    return 2.5, 3.5, 4.5


@pytest.mark.parametrize(
    ("phase", "expected"),
    [("safe", "safe"), ("watch", "watch"), ("warning", "warning"), ("emergency", "emergency")],
)
def test_generate_level_stays_inside_requested_phase(phase, expected):
    watch, warning, emergency = thresholds()
    level = handler.generate_level(phase, watch, warning, emergency)
    assert handler.classify_level(level, watch, warning, emergency) == expected


def configure_enabled(monkeypatch):
    monkeypatch.setenv("SIMULATOR_ENABLED", "true")
    monkeypatch.setenv("FLOODGUARD_API_URL", "https://floodguard.example.com")
    monkeypatch.setenv("SENSOR_STATION_CODE", "STN001")
    monkeypatch.setenv("SENSOR_INGESTION_TOKEN", "test-only-token")


def test_disabled_simulator_sends_no_request(monkeypatch):
    monkeypatch.delenv("SIMULATOR_ENABLED", raising=False)
    monkeypatch.setattr(handler, "urlopen", lambda *args: pytest.fail("request must not be sent"))

    assert handler.lambda_handler({}, None) == {"status": "disabled"}


def test_fetches_thresholds_and_submits_exactly_one_reading(monkeypatch):
    configure_enabled(monkeypatch)
    monkeypatch.setattr(handler, "current_epoch_minute", lambda: 0)
    requests = []
    responses = [
        FakeResponse(200, {"station_code": "STN001", "is_active": True, "watch_threshold": 2.5, "warning_threshold": 3.5, "danger_threshold": 4.5}),
        FakeResponse(201, {"status": "safe", "alert_level": "safe"}),
    ]

    def fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return responses.pop(0)

    monkeypatch.setattr(handler, "urlopen", fake_urlopen)
    result = handler.lambda_handler({}, None)

    assert result["status"] == "submitted"
    assert len(requests) == 2
    assert requests[0][0].method == "GET"
    assert requests[1][0].method == "POST"
    submitted = json.loads(requests[1][0].data.decode("utf-8"))
    assert set(submitted) == {"station_code", "water_level"}
    assert submitted["station_code"] == "STN001"
    assert result["api_status"] == 201


@pytest.mark.parametrize("status_code", [401, 403, 404, 500])
def test_api_errors_are_handled(monkeypatch, status_code):
    configure_enabled(monkeypatch)
    from urllib.error import HTTPError

    def fail_urlopen(request, timeout):
        raise HTTPError(request.full_url, status_code, "error", {}, BytesIO(b"{}"))

    monkeypatch.setattr(handler, "urlopen", fail_urlopen)
    result = handler.lambda_handler({}, None)

    assert result["status"] == "error"
    assert result["http_status"] == status_code


def test_timeout_is_handled(monkeypatch):
    configure_enabled(monkeypatch)
    monkeypatch.setattr(handler, "urlopen", lambda request, timeout: (_ for _ in ()).throw(TimeoutError()))

    result = handler.lambda_handler({}, None)

    assert result == {"status": "error", "reason": "transport_error"}


def test_token_never_appears_in_logs(monkeypatch, caplog):
    configure_enabled(monkeypatch)
    token = "super-secret-device-token"
    monkeypatch.setenv("SENSOR_INGESTION_TOKEN", token)
    monkeypatch.setattr(handler, "urlopen", lambda request, timeout: (_ for _ in ()).throw(TimeoutError()))

    with caplog.at_level(logging.INFO):
        handler.lambda_handler({}, None)

    assert token not in caplog.text


def test_sequence_repeats_every_eleven_minutes():
    assert handler.requested_phase(0) == "safe"
    assert handler.requested_phase(10) == "safe"
    assert handler.requested_phase(11) == "safe"
    assert handler.requested_phase(17) == "emergency"
