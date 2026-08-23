import { Marker, Popup } from "react-leaflet";
import { FileWarning } from "lucide-react";
import MapPopup from "./MapPopup";
import { MAP_STATUS_COLORS } from "./mapConfig";
import { createMapIcon, formatMapDate, operationalCoordinatePair } from "./mapUtils";

export default function ReportMarker({ report, onSelect }) {
  const latitude = report.latitude ?? report.lat;
  const longitude = report.longitude ?? report.lng;
  const position = operationalCoordinatePair(latitude, longitude);
  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={createMapIcon({ color: MAP_STATUS_COLORS.report, icon: FileWarning })}
      eventHandlers={{ click: () => onSelect?.({ type: "report", item: report }) }}
    >
      <Popup>
        <MapPopup title={`Community report #${report.id}`} subtitle={report.district || "FloodGuard report"}>
          <p><strong>Severity:</strong> {report.severity}/5</p>
          <p><strong>Submitted:</strong> {formatMapDate(report.created_at)}</p>
          {report.description ? <p className="mt-1 line-clamp-4">{report.description}</p> : null}
          {report.image_url ? <img className="mt-2 max-h-28 w-full rounded-lg object-cover" src={report.image_url} alt="Community report" /> : null}
        </MapPopup>
      </Popup>
    </Marker>
  );
}
