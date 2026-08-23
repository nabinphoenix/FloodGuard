export function formatReadingAge(timestamp) {
  if (!timestamp) return "No reading yet";
  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs)) return "Unknown time";
  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (ageSeconds < 60) return `${ageSeconds} second${ageSeconds === 1 ? "" : "s"} ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  return `${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago`;
}

export function freshnessLabel(value) {
  return {
    fresh: "Fresh",
    delayed: "Delayed",
    stale: "Stale",
    no_reading: "No reading",
  }[value] || "Unknown";
}

export function freshnessClass(value) {
  return {
    fresh: "bg-emerald-100 text-emerald-800",
    delayed: "bg-amber-100 text-amber-800",
    stale: "bg-rose-100 text-rose-800",
    no_reading: "bg-slate-100 text-slate-700",
  }[value] || "bg-slate-100 text-slate-700";
}

export function trendLabel(value) {
  return {
    rising: "Rising",
    falling: "Falling",
    steady: "Steady",
    unavailable: "No comparison yet",
  }[value] || "No comparison yet";
}
