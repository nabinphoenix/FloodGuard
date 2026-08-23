import assert from "node:assert/strict";
import test from "node:test";

import {
  SENSOR_DASHBOARD_POLL_INTERVAL_MS,
  simulatorButtonState,
  simulatorScheduleLabel,
} from "./simulatorControl.js";

test("simulator controls disable the action that does not match the EventBridge state", () => {
  assert.deepEqual(simulatorButtonState(true, false), {
    startDisabled: true,
    stopDisabled: false,
  });
  assert.deepEqual(simulatorButtonState(false, false), {
    startDisabled: false,
    stopDisabled: true,
  });
  assert.deepEqual(simulatorButtonState(true, true), {
    startDisabled: true,
    stopDisabled: true,
  });
});

test("dashboard polling remains on the ten-second interval", () => {
  assert.equal(SENSOR_DASHBOARD_POLL_INTERVAL_MS, 10_000);
  assert.equal(simulatorScheduleLabel("rate(1 minute)"), "Every 1 minute");
});
