import { useEffect, useMemo, useState } from "react";

import { getAlertZones } from "../../api/public";
import AlertBanner from "../../components/AlertBanner";
import LoadingSpinner from "../../components/LoadingSpinner";
import SeverityBadge from "../../components/SeverityBadge";

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
    <main className="min-h-screen bg-surface-bg px-4 py-10 md:px-6">
      <section className="mx-auto max-w-7xl">
        {zones.some((zone) => zone.alert_level === "emergency") && (
          <AlertBanner
            level="emergency"
            title="Emergency flood alert active"
            message="At least one monitored district is currently marked as emergency."
          />
        )}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand">Flood Alert Feed</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Current flood alert levels by district. This page refreshes every 60 seconds.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={districtFilter}
              onChange={(event) => setDistrictFilter(event.target.value)}
              className="rounded-md border border-ink-border bg-surface-card px-4 py-3 text-sm text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              className="rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-light"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-ink-border bg-surface-card p-4 text-sm text-ink-secondary shadow-sm">
          Last refreshed: {lastRefresh ? lastRefresh.toLocaleTimeString() : "--"}
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency">
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
                className="rounded-lg border border-ink-border bg-surface-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-ink-primary">{zone.district}</h2>
                    <p className="mt-1 text-sm text-ink-secondary">
                      Lat {Number(zone.latitude).toFixed(4)}, Lng {Number(zone.longitude).toFixed(4)}
                    </p>
                  </div>
                  <SeverityBadge level={zone.alert_level} />
                </div>
                <div className="mt-6 rounded-md bg-surface-bg px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink-primary">
                    {formatUpdated(zone.updated_at)}
                  </p>
                </div>
              </article>
            ))}
            {filteredZones.length === 0 && (
              <div className="rounded-lg border border-ink-border bg-surface-card p-8 text-center text-ink-secondary md:col-span-2 xl:col-span-3">
                No alert zones match this filter.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
