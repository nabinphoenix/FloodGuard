import assert from "node:assert/strict";
import test from "node:test";

import {
  getNotificationPresentation,
  NOTIFICATION_POLL_INTERVAL_MS,
  shouldPollNotificationStatus,
} from "./notificationStatus.js";

test("disabled status exposes only the Enable control", () => {
  const presentation = getNotificationPresentation("disabled");
  assert.equal(presentation.label, "Disabled");
  assert.deepEqual(presentation.actions, ["enable"]);
});

test("pending status exposes Check Status and Disable controls", () => {
  const presentation = getNotificationPresentation("pending");
  assert.equal(presentation.label, "Pending confirmation");
  assert.deepEqual(presentation.actions, ["check", "disable"]);
  assert.match(presentation.message, /confirm the AWS SNS subscription/i);
});

test("confirmed status exposes the active badge and Disable control", () => {
  const presentation = getNotificationPresentation("confirmed");
  assert.equal(presentation.label, "Confirmed & Active");
  assert.deepEqual(presentation.actions, ["disable"]);
});

test("status polling runs only while either subscription is pending", () => {
  assert.equal(shouldPollNotificationStatus({
    flood_alerts: { status: "pending" },
    password_recovery: { status: "disabled" },
  }), true);
  assert.equal(shouldPollNotificationStatus({
    flood_alerts: { status: "confirmed" },
    password_recovery: { status: "pending" },
  }), true);
  assert.equal(shouldPollNotificationStatus({
    flood_alerts: { status: "confirmed" },
    password_recovery: { status: "disabled" },
  }), false);
  assert.equal(NOTIFICATION_POLL_INTERVAL_MS, 12_000);
});
