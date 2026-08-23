import assert from "node:assert/strict";
import test from "node:test";

import {
  KATHMANDU_TIME_ZONE,
  formatKathmanduDateTime,
  formatKathmanduTime,
} from "./time.js";

test("timestamps render in Kathmandu time regardless of browser locale", () => {
  const instant = "2026-08-23T06:15:00+00:00";

  assert.equal(KATHMANDU_TIME_ZONE, "Asia/Kathmandu");
  assert.match(formatKathmanduTime(instant, { hour12: false }), /12:00/);
  assert.match(formatKathmanduDateTime(instant, { hour12: false }), /12:00/);
});
