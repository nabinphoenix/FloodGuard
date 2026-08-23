export const KATHMANDU_TIME_ZONE = "Asia/Kathmandu";

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatKathmanduDateTime(value, options = {}) {
  const date = validDate(value);
  if (!date) return "Unknown time";
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: KATHMANDU_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  }).format(date);
}

export function formatKathmanduTime(value, options = {}) {
  const date = validDate(value);
  if (!date) return "Unknown time";
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: KATHMANDU_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  }).format(date);
}

export function formatKathmanduDate(value, options = {}) {
  const date = validDate(value);
  if (!date) return "Unknown date";
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: KATHMANDU_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}
