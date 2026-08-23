export const SENSOR_DASHBOARD_POLL_INTERVAL_MS = 10_000;

export function simulatorButtonState(enabled, isChanging) {
  return {
    startDisabled: isChanging || enabled,
    stopDisabled: isChanging || !enabled,
  };
}

export function simulatorScheduleLabel(schedule) {
  return schedule === "rate(1 minute)" ? "Every 1 minute" : schedule || "Unavailable";
}
