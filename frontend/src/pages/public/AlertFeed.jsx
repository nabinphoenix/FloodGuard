import { useEffect, useMemo, useState } from "react";

import { getAlertZones } from "../../api/public";
import AlertBadge from "../../components/AlertBadge";
import LoadingSpinner from "../../components/LoadingSpinner";

const cardStyles = {
  safe: "border-green-200 bg-green-50",
  watch: "border-yellow-200 bg-yellow-50",
  warning: "border-orange-200 bg-orange-50",
  emergency: "border-red-200 bg-red-50",
};

function formatUpdated(value) {
  if (!value) return "No update time";
  return new Date(value).toLocaleString();
}

export default function AlertFeed() {
  const [zones, setZones] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  async function loadAlerts() {
    try {
      const data = await getAlertZones();
      setZones(data);
      setLastRefresh(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load alert zones.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const districts = useMemo(
    () => Array.from(new Set(zones.map((zone) => zone.district))).sort(),
    [zones]
  );

  const filteredZones = useMemo(() => {
    if (!districtFilter) return zones;
    return zones.filter((zone) => zone.district === districtFilter);
  }, [zones, districtFilter]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 md:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342]">Flood Alert Feed</h1>
            <p className="mt-2 text-sm text-slate-600">
              Current flood alert levels by district. This page refreshes every 60 seconds.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
              className="rounded-md border border-blue-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadAlerts}
              className="rounded-md bg-[#0A2342] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-950"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-blue-100 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Last refreshed: {lastRefresh ? lastRefresh.toLocaleTimeString() : "--"}
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner message="Loading alert feed..." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredZones.map((zone) => (
              <article
                key={zone.id}
                className={`rounded-lg border p-5 shadow-sm ${cardStyles[zone.alert_level] || cardStyles.safe}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">{zone.district}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Lat {Number(zone.latitude).toFixed(4)}, Lng {Number(zone.longitude).toFixed(4)}
                    </p>
                  </div>
                  <AlertBadge level={zone.alert_level} />
                </div>
                <div className="mt-6 rounded-md bg-white/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatUpdated(zone.updated_at)}
                  </p>
                </div>
              </article>
            ))}
            {filteredZones.length === 0 && (
              <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-slate-500 md:col-span-2 xl:col-span-3">
                No alert zones match this filter.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
