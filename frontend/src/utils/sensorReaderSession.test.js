import assert from "node:assert/strict";
import test from "node:test";

import {
  createReaderSession,
  readerControlState,
  readerSessionTiming,
} from "./sensorReaderSession.js";

test("Start creates one bounded reader session", () => {
  const session = createReaderSession({
    now: 1_000,
    stationId: "SIM001",
    pattern: "rising",
    durationSeconds: 180,
    intervalSeconds: 30,
  });

  assert.deepEqual(session, {
    stationId: "SIM001",
    pattern: "rising",
    startedAt: 1_000,
    endsAt: 181_000,
    nextReadingAt: 31_000,
    durationSeconds: 180,
    intervalSeconds: 30,
  });
});

test("Stop and duplicate Start controls are guarded by session state", () => {
  assert.deepEqual(readerControlState({ isRunning: false, hasStation: true, isSending: false }), {
    startDisabled: false,
    stopDisabled: true,
  });
  assert.deepEqual(readerControlState({ isRunning: true, hasStation: true, isSending: false }), {
    startDisabled: true,
    stopDisabled: false,
  });
});

test("session timing follows the selected interval and expires at its duration", () => {
  const session = createReaderSession({
    now: 10_000,
    stationId: "SIM001",
    pattern: "mixed",
    durationSeconds: 60,
    intervalSeconds: 10,
  });

  assert.deepEqual(readerSessionTiming(session, 15_000), {
    elapsedSeconds: 5,
    remainingSeconds: 55,
    nextReadingInSeconds: 5,
    expired: false,
  });
  assert.equal(readerSessionTiming(session, 21_000).nextReadingInSeconds, 9);
  assert.deepEqual(readerSessionTiming(session, 70_000), {
    elapsedSeconds: 60,
    remainingSeconds: 0,
    nextReadingInSeconds: 0,
    expired: true,
  });
});
