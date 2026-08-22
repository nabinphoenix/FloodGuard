import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import AlertMarker from "./AlertMarker";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapTileConfig, NEPAL_MAP_BOUNDS } from "./mapConfig";
import MapLegend from "./MapLegend";
import ReportMarker from "./ReportMarker";
import SensorMarker from "./SensorMarker";
import { coordinatePair, createMapIcon, operationalCoordinatePair } from "./mapUtils";
import ZoneLayer from "./ZoneLayer";
import "./map.css";

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function MapViewport({ points = [], focusPosition }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    const focus = focusPosition && operationalCoordinatePair(focusPosition[0], focusPosition[1]);
    if (focus) {
      map.flyTo(focus, Math.max(map.getZoom(), 12), { duration: 0.35 });
      return;
    }

    const validPoints = points.map((point) => operationalCoordinatePair(point[0], point[1])).filter(Boolean);
    if (validPoints.length > 1) {
      map.fitBounds(L.latLngBounds(validPoints), { padding: [28, 28], maxZoom: 12 });
    } else if (validPoints.length === 1) {
      map.flyTo(validPoints[0], Math.max(map.getZoom(), 10), { duration: 0.35 });
    }
  }, [focusPosition, map, points]);

  return null;
}

function LocationMarker({ position, draggable, onDragEnd }) {
  if (!position) return null;

  return (
    <Marker
      position={position}
      draggable={draggable}
      icon={createMapIcon({ color: "#0f766e", glyph: "•" })}
      eventHandlers={
        draggable
          ? {
              dragend(event) {
                const marker = event.target;
                const latlng = marker.getLatLng();
                onDragEnd?.({ latitude: latlng.lat, longitude: latlng.lng });
              },
            }
          : undefined
      }
    />
  );
}

export default function FloodGuardMap({
  stations = [],
  zones = [],
  reports = [],
  alerts = [],
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  className = "h-[520px]",
  interactive = false,
  markerPosition = null,
  markerDraggable = false,
  onMapClick,
  onMarkerDrag,
  focusPosition = null,
  onSelect,
  selectedAlertId = null,
  showStations = true,
  showZones = true,
  showReports = true,
  showAlerts = true,
  showLegend = true,
  children,
}) {
  const tileConfig = getMapTileConfig();
  const safeCenter = coordinatePair(center?.[0], center?.[1]) || DEFAULT_MAP_CENTER;
  const validStations = stations.filter((item) => operationalCoordinatePair(item.latitude ?? item.lat, item.longitude ?? item.lng));
  const validZones = zones.filter((item) => operationalCoordinatePair(item.latitude ?? item.lat, item.longitude ?? item.lng));
  const validReports = reports.filter((item) => operationalCoordinatePair(item.latitude ?? item.lat, item.longitude ?? item.lng));
  const validAlerts = alerts.filter((item) => operationalCoordinatePair(item.latitude ?? item.lat, item.longitude ?? item.lng));
  const points = [
    ...validStations.map((item) => [item.latitude ?? item.lat, item.longitude ?? item.lng]),
    ...validZones.map((item) => [item.latitude ?? item.lat, item.longitude ?? item.lng]),
    ...validReports.map((item) => [item.latitude ?? item.lat, item.longitude ?? item.lng]),
    ...validAlerts.map((item) => [item.latitude ?? item.lat, item.longitude ?? item.lng]),
  ];

  return (
    <div className={`floodguard-map relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm ${className}`}>
      <MapContainer center={safeCenter} zoom={zoom} maxBounds={NEPAL_MAP_BOUNDS} maxBoundsViscosity={0.6} scrollWheelZoom className="h-full w-full">
        <TileLayer url={tileConfig.url} attribution={tileConfig.attribution} />
        <MapViewport points={points} focusPosition={focusPosition} />
        {interactive ? <MapClickHandler onMapClick={onMapClick} /> : null}
        <LocationMarker position={markerPosition} draggable={markerDraggable} onDragEnd={onMarkerDrag} />
        {showStations ? validStations.map((station) => <SensorMarker key={`station-${station.station_code || station.id}`} station={station} onSelect={onSelect} />) : null}
        {showZones ? <ZoneLayer zones={validZones} onSelect={onSelect} /> : null}
        {showReports ? validReports.map((report) => <ReportMarker key={`report-${report.id}`} report={report} onSelect={onSelect} />) : null}
        {showAlerts ? validAlerts.map((alert) => <AlertMarker key={`alert-${alert.id}`} alert={alert} onSelect={onSelect} isSelected={String(alert.id) === String(selectedAlertId)} />) : null}
        {children}
      </MapContainer>
      {showLegend ? <MapLegend /> : null}
    </div>
  );
}
