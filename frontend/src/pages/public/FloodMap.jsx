import { useEffect, useMemo, useState } from "react";

import { getMapZones } from "../../api/public";
import AlertBadge from "../../components/AlertBadge";
import LoadingSpinner from "../../components/LoadingSpinner";

const levelStyles = {
  safe: "bg-green-500",
  watch: "bg-yellow-500",
  warning: "bg-orange-500",
  emergency: "bg-red-600",
};

function boundsForZones(zones) {
  const latitudes = zones.map((zone) => Number(zone.latitude)).filter(Number.isFinite);
  const longitudes = zones.map((zone) => Number(zone.longitude)).filter(Number.isFinite);
  if (latitudes.length === 0 || longitudes.length === 0) return null;

  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

export default function FloodMap() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadZones() {
      try {
        const data = await getMapZones();
        setZones(data);
        setSelectedZone(data[0] || null);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load flood map zones.");
      } finally {
        setIsLoading(false);
      }
    }

    loadZones();
  }, []);

  const bounds = useMemo(() => boundsForZones(zones), [zones]);

  function markerPosition(zone) {
    if (!bounds) return { left: "50%", top: "50%" };
    const latRange = bounds.maxLat - bounds.minLat || 1;
    const lngRange = bounds.maxLng - bounds.minLng || 1;
    const left = ((Number(zone.longitude) - bounds.minLng) / lngRange) * 76 + 12;
    const top = (1 - (Number(zone.latitude) - bounds.minLat) / latRange) * 70 + 15;
    return { left: `${left}%`, top: `${top}%` };
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 md:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0A2342]">Flood Map</h1>
          <p className="mt-2 text-sm text-slate-600">District alert zones plotted from backend coordinates.</p>
        </div>

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {isLoading ? (
          <LoadingSpinner message="Loading flood map..." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="relative min-h-[540px] overflow-hidden rounded-lg border border-blue-100 bg-sky-50 shadow-sm">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(59,130,246,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
              <div className="absolute inset-6 rounded-lg border border-blue-200/70 bg-white/45" />
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setSelectedZone(zone)}
                  className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ring-4 ring-white/60 ${levelStyles[zone.alert_level] || levelStyles.safe}`}
                  style={markerPosition(zone)}
                  aria-label={`Select ${zone.district}`}
                />
              ))}
            </div>

            <aside className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Selected Zone</h2>
              {selectedZone ? (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-slate-900">{selectedZone.district}</span>
                    <AlertBadge level={selectedZone.alert_level} />
                  </div>
                  <dl className="grid gap-3 text-sm">
                    <div className="rounded-md bg-blue-50 p-3">
                      <dt className="font-semibold text-blue-950">Latitude</dt>
                      <dd className="mt-1 text-slate-700">{Number(selectedZone.latitude).toFixed(6)}</dd>
                    </div>
                    <div className="rounded-md bg-blue-50 p-3">
                      <dt className="font-semibold text-blue-950">Longitude</dt>
                      <dd className="mt-1 text-slate-700">{Number(selectedZone.longitude).toFixed(6)}</dd>
                    </div>
                    <div className="rounded-md bg-blue-50 p-3">
                      <dt className="font-semibold text-blue-950">Last update</dt>
                      <dd className="mt-1 text-slate-700">
                        {selectedZone.updated_at ? new Date(selectedZone.updated_at).toLocaleString() : "-"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No zones are available yet.</p>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
