import { CircleMarker, Popup } from "react-leaflet";
import MapPopup from "./MapPopup";
import { MAP_STATUS_COLORS } from "./mapConfig";
import { formatMapDate, normalizeStatus, statusLabel } from "./mapUtils";

export default function ZoneLayer({ zones = [], onSelect }) {
  return zones.map((zone) => {
    const latitude = zone.latitude ?? zone.lat;
    const longitude = zone.longitude ?? zone.lng;
    const status = normalizeStatus(zone.alert_level || zone.status);
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;

    return (
      <CircleMarker
        key={`zone-${zone.id ?? zone.district}`}
        center={[Number(latitude), Number(longitude)]}
        radius={10}
        pathOptions={{ color: MAP_STATUS_COLORS[status], fillColor: MAP_STATUS_COLORS[status], fillOpacity: 0.72, weight: 2 }}
        eventHandlers={{ click: () => onSelect?.({ type: "zone", item: zone }) }}
      >
        <Popup>
          <MapPopup title={zone.district || "Alert zone"} subtitle="Flood alert zone">
            <p><strong>Level:</strong> {statusLabel(status)}</p>
            <p><strong>Updated:</strong> {formatMapDate(zone.updated_at)}</p>
            <p className="mt-2 text-slate-500">This marker represents the zone centre. A radius or boundary is not configured for this zone.</p>
          </MapPopup>
        </Popup>
      </CircleMarker>
    );
  });
}
