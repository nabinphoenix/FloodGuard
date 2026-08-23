import L from "leaflet";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NEPAL_OPERATIONAL_BOUNDS } from "./mapConfig";
import { formatKathmanduDateTime } from "../../utils/time";

export function coordinatePair(latitude, longitude) {
  if ([latitude, longitude].some((value) => value === null || value === undefined || (typeof value === "string" && !value.trim()))) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lat, lng];
}

export function isWithinNepalOperationalBounds(latitude, longitude) {
  const pair = coordinatePair(latitude, longitude);
  if (!pair) return false;

  return pair[0] >= NEPAL_OPERATIONAL_BOUNDS.south
    && pair[0] <= NEPAL_OPERATIONAL_BOUNDS.north
    && pair[1] >= NEPAL_OPERATIONAL_BOUNDS.west
    && pair[1] <= NEPAL_OPERATIONAL_BOUNDS.east;
}

export function operationalCoordinatePair(latitude, longitude) {
  return isWithinNepalOperationalBounds(latitude, longitude) ? coordinatePair(latitude, longitude) : null;
}

export function formatMapDate(value) {
  if (!value) return "No reading yet";
  return formatKathmanduDateTime(value);
}

export function formatAge(value) {
  if (!value) return "No reading yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown age";

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function normalizeStatus(value) {
  const normalized = String(value || "no_data").toLowerCase().replace(/\s+/g, "_");
  return ["safe", "watch", "warning", "emergency", "no_data"].includes(normalized)
    ? normalized
    : "no_data";
}

export function statusLabel(value) {
  return normalizeStatus(value).replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createMapIcon({ color = "#2563eb", icon: Icon = null } = {}) {
  const iconMarkup = Icon
    ? renderToStaticMarkup(createElement(Icon, { size: 16, strokeWidth: 2.5, 'aria-hidden': true }))
    : "";

  return L.divIcon({
    className: "floodguard-map-icon-wrapper",
    html: `<span class="floodguard-map-icon" style="--marker-color:${color}">${iconMarkup}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}
