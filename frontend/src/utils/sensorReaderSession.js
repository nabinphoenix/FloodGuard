export const READER_DURATION_OPTIONS = [60, 180, 300, 600];
export const READER_INTERVAL_OPTIONS = [10, 30, 60];

export function createReaderSession({ now, stationId, pattern, durationSeconds, intervalSeconds }) {
  return {
    stationId,
    pattern,
    startedAt: now,
    endsAt: now + durationSeconds * 1000,
    nextReadingAt: now + intervalSeconds * 1000,
    durationSeconds,
    intervalSeconds,
  };
}

export function readerSessionTiming(session, now) {
  const elapsedSeconds = Math.min(session.durationSeconds, Math.max(0, Math.floor((now - session.startedAt) / 1000)));
  const remainingSeconds = Math.max(0, Math.ceil((session.endsAt - now) / 1000));
  const intervalMilliseconds = session.intervalSeconds * 1000;
  const firstScheduledReading = session.nextReadingAt;
  const nextReadingAt = now <= firstScheduledReading
    ? firstScheduledReading
    : firstScheduledReading + Math.ceil((now - firstScheduledReading) / intervalMilliseconds) * intervalMilliseconds;
  const nextReadingInSeconds = Math.max(0, Math.ceil((nextReadingAt - now) / 1000));
  return {
    elapsedSeconds,
    remainingSeconds,
    nextReadingInSeconds,
    expired: now >= session.endsAt,
  };
}

export function readerControlState({ isRunning, hasStation, isSending }) {
  return {
    startDisabled: isRunning || !hasStation || isSending,
    stopDisabled: !isRunning,
  };
}
