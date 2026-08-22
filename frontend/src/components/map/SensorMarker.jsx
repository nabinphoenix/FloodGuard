import { Link } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import MapPopup from "./MapPopup";
import { MAP_STATUS_COLORS } from "./mapConfig";
import { createMapIcon, formatAge, formatMapDate, normalizeStatus, operationalCoordinatePair, statusLabel } from "./mapUtils";

export default function SensorMarker({ station, onSelect }) {
  const latitude = station.latitude ?? station.lat;
  const longitude = station.longitude ?? station.lng;
  const status = normalizeStatus(station.status || station.latest_reading?.status);
  const latestWaterLevel = station.latest_water_level ?? station.latest_reading?.water_level;
  const lastReadingAt = station.last_reading_at ?? station.latest_reading?.timestamp ?? station.latest_reading?.recorded_at;
  const stationCode = station.station_code || station.id;

  const position = operationalCoordinatePair(latitude, longitude);
  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={createMapIcon({ color: MAP_STATUS_COLORS[status], glyph: "S" })}
      eventHandlers={{ click: () => onSelect?.({ type: "station", item: station }) }}
    >
      <Popup>
        <MapPopup title={station.name || station.station_name || stationCode} subtitle={`${stationCode} · ${station.district || "Nepal"}`}>
          <p><strong>Status:</strong> {statusLabel(status)}{station.is_stale ? " · stale" : ""}</p>
          <p><strong>Water level:</strong> {latestWaterLevel ?? "No data"}</p>
          <p><strong>Last reading:</strong> {lastReadingAt ? `${formatAge(lastReadingAt)} (${formatMapDate(lastReadingAt)})` : "No reading yet"}</p>
          {station.river_name ? <p><strong>River:</strong> {station.river_name}</p> : null}
          <Link className="mt-2 inline-block font-semibold text-blue-700 hover:underline" to={`/sensors/history?station=${encodeURIComponent(stationCode)}`}>
            View history
          </Link>
        </MapPopup>
      </Popup>
    </Marker>
  );
}
