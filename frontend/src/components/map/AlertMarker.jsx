import { useEffect, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import MapPopup from "./MapPopup";
import { MAP_STATUS_COLORS } from "./mapConfig";
import { createMapIcon, formatMapDate, normalizeStatus, operationalCoordinatePair, statusLabel } from "./mapUtils";

export default function AlertMarker({ alert, onSelect, isSelected = false }) {
  const latitude = alert.latitude ?? alert.lat;
  const markerRef = useRef(null);
  const longitude = alert.longitude ?? alert.lng;
  const position = operationalCoordinatePair(latitude, longitude);
  useEffect(() => {
    if (isSelected) markerRef.current?.openPopup();
  }, [isSelected]);

  if (!position) return null;
  return (
    <Marker
      ref={markerRef} position={position}
      icon={createMapIcon({ color: MAP_STATUS_COLORS[normalizeStatus(alert.alert_level)], glyph: "!" })}
      eventHandlers={{ click: () => onSelect?.({ type: "alert", item: alert }) }}
    >
      <Popup>
        <MapPopup title={alert.zone_name || alert.district || "Flood alert"} subtitle="Active alert">
          <p><strong>Level:</strong> {statusLabel(alert.alert_level)}</p>
          <p><strong>Triggered:</strong> {formatMapDate(alert.triggered_at)}</p>
          {alert.message ? <p className="mt-1">{alert.message}</p> : null}
        </MapPopup>
      </Popup>
    </Marker>
  );
}
