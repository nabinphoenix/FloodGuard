import { useState } from "react";
import FloodGuardMap from "./FloodGuardMap";
import { DEFAULT_MAP_CENTER } from "./mapConfig";
import { coordinatePair, isWithinNepalOperationalBounds, operationalCoordinatePair } from "./mapUtils";

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  onClear,
  label = "Select location",
  showCurrentLocation = true,
  className = "",
  zones = [],
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");
  const position = coordinatePair(latitude, longitude);
  const locationOutsideNepal = position && !isWithinNepalOperationalBounds(position[0], position[1]);
  const mapPosition = locationOutsideNepal ? null : position;

  const selectPosition = ({ latitude: nextLatitude, longitude: nextLongitude }) => {
    const nextPosition = operationalCoordinatePair(nextLatitude, nextLongitude);
    if (!nextPosition) {
      setError("FloodGuard currently accepts incident locations within Nepal.");
      return;
    }
    onChange?.({ latitude: formatCoordinate(nextPosition[0]), longitude: formatCoordinate(nextPosition[1]) });
    setError("");
  };

  const clearPosition = () => {
    onClear?.();
    if (!onClear) onChange?.({ latitude: "", longitude: "" });
    setError("");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support location services.");
      return;
    }

    setIsLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        selectPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude });
        setIsLocating(false);
      },
      (positionError) => {
        let message = "Unable to determine your current location.";
        if (positionError?.code === 1) {
          message = "Location permission was denied. Select your location manually on the map.";
        } else if (positionError?.code === 3) {
          message = "Unable to determine your current location.";
        }
        setError(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">Click the map or drag the marker, or use your current location.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showCurrentLocation ? (
            <button type="button" onClick={useCurrentLocation} disabled={isLocating} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
              {isLocating ? "Locating..." : "Use my location"}
            </button>
          ) : null}
          {position ? (
            <button type="button" onClick={clearPosition} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <FloodGuardMap
        center={mapPosition || DEFAULT_MAP_CENTER}
        zoom={mapPosition ? 12 : 7}
        className="h-[280px]"
        interactive
        markerPosition={mapPosition}
        focusPosition={mapPosition}
        markerDraggable
        onMapClick={selectPosition}
        onMarkerDrag={selectPosition}
        zones={zones}
        showStations={false}
        showZones={zones.length > 0}
        showReports={false}
        showAlerts={false}
        showLegend={false}
      />
      {position ? <p className="text-xs font-medium text-teal-700">Selected coordinates: {position[0].toFixed(6)}, {position[1].toFixed(6)}</p> : null}
      {error || locationOutsideNepal ? <p role="alert" className="text-xs font-medium text-red-600">{error || "Saved coordinates are outside Nepal. Select a new location."}</p> : null}
    </div>
  );
}
