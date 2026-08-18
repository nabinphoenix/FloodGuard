export const severityColors = {
  safe: "#16A34A",
  watch: "#F59E0B",
  warning: "#EA580C",
  emergency: "#DC2626",
};

export const severityLabels = {
  safe: "Safe",
  watch: "Watch",
  warning: "Warning",
  emergency: "Emergency",
};

export function normalizeSeverityLevel(level) {
  if (level === "danger") return "emergency";
  if (level && Object.hasOwn(severityColors, level)) return level;
  return "safe";
}
