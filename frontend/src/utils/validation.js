export const PHONE_ERROR = "Phone number must contain exactly 10 digits with no spaces or symbols.";
export const PHONE_PATTERN = /^[0-9]{10}$/;

export function validatePhone(value) {
  const phone = value.trim();
  return !phone || PHONE_PATTERN.test(phone) ? "" : PHONE_ERROR;
}

export function validateCoordinate(value, minimum, maximum, label) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return `${label} must be between ${minimum} and ${maximum}.`;
  }
  return "";
}

export function backendError(error, fallback) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(" ");
  return detail || fallback;
}
