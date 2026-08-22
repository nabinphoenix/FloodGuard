import { Marker, Popup } from "react-leaflet";
import MapPopup from "./MapPopup";
import { MAP_STATUS_COLORS } from "./mapConfig";
import { createMapIcon, formatMapDate, statusLabel } from "./mapUtils";

export default function AlertMarker({ alert, onSelect }) {
  const latitude = alert.latitude ?? alert.lat;
  const longitude = alert.longitude ?? alert.lng;
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;

  return (
    <Marker
      position={[Number(latitude), Number(longitude)]}
      icon={createMapIcon({ color: MAP_STATUS_COLORS.alert, glyph: "!" })}
      eventHandlers={{ click: () => onSelect?.({ type: "alert", item: alert }) }}
    >
      <Popup>
        <MapPopup title={alert.district || "Flood alert"} subtitle="Active alert">
          <p><strong>Level:</strong> {statusLabel(alert.alert_level)}</p>
          <p><strong>Triggered:</strong> {formatMapDate(alert.triggered_at)}</p>
          {alert.message ? <p className="mt-1">{alert.message}</p> : null}
        </MapPopup>
      </Popup>
    </Marker>
  );
}
