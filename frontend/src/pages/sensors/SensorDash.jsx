import { Activity, Clock, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getLiveReadings } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import SensorFilters, { filterStations } from "../../components/SensorFilters";

function statusColor(status) {
  switch (status) {
    case "safe": return "bg-green-500";
    case "watch": return "bg-yellow-400";
    case "warning": return "bg-orange-500";
    case "emergency": return "bg-red-600";
    default: return "bg-gray-400";
  }
}

function statusLabel(status) {
  return status === "no_data" ? "NO DATA" : String(status || "unknown").toUpperCase();
}

function StationCard({ station }) {
  const waterLevel = station.latest_reading?.water_level;
  const hasReading = waterLevel !== null && waterLevel !== undefined;
  const status = station.status || "no_data";
  const color = statusColor(status);
  const emergency = station.danger_threshold || 1;
  const percent = hasReading ? Math.min(100, Math.round((waterLevel / emergency) * 100)) : 0;
  const lastUpdated = station.latest_reading?.timestamp
    ? new Date(station.latest_reading.timestamp).toLocaleString()
    : "Waiting for reading";

  return (
    <article className="relative overflow-hidden rounded-xl border border-ink-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className={"absolute left-0 right-0 top-0 h-1.5 " + color} />
      <div className="mb-5 flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">{station.station_code || station.id}</p>
          <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-ink-primary">{station.station_name || station.name}</h2>
          <p className="mt-0.5 text-sm text-ink-secondary">{station.province || "Province not configured"} · {station.district}</p>
        </div>
        <span className={"shrink-0 rounded-full px-3 py-1 text-xs font-bold tracking-wider text-white shadow-sm " + color}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="mb-5 flex items-end gap-2">
        <span className="text-5xl font-black tracking-tighter text-ink-primary">{hasReading ? waterLevel.toFixed(2) : "--"}</span>
        <span className="pb-1 text-xl font-bold text-ink-secondary">m</span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-bg p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-secondary">River</p>
          <p className="mt-1 font-semibold text-ink-primary">{station.river_name || "Not configured"}</p>
        </div>
        <div className="rounded-lg bg-surface-bg p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-secondary">Basin</p>
          <p className="mt-1 font-semibold text-ink-primary">{station.river_basin || "Not configured"}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-xs font-semibold text-ink-secondary">
            <span>Level vs emergency</span>
            <span>{hasReading ? percent + "%" : "—"}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div className={"h-full rounded-full transition-all duration-700 " + color} style={{ width: percent + "%" }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-yellow-800">Watch<br /><strong>{station.watch_threshold?.toFixed(2) ?? "—"} m</strong></div>
          <div className="rounded-md border border-orange-200 bg-orange-50 p-2 text-orange-800">Warning<br /><strong>{station.warning_threshold?.toFixed(2) ?? "—"} m</strong></div>
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-red-800">Emergency<br /><strong>{station.danger_threshold?.toFixed(2) ?? "—"} m</strong></div>
        </div>

        <div className="flex items-center gap-1.5 border-t border-gray-100 pt-4 text-xs text-ink-secondary">
          <Clock size={14} />
          <span>{lastUpdated}</span>
        </div>
        {!hasReading && <p className="text-xs font-semibold text-gray-500">Waiting for reading</p>}
      </div>
    </article>
  );
}

export default function SensorDash() {
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({ province: "", district: "", river_basin: "", river: "", station: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(30);

  async function loadReadings(manual = false) {
    if (manual) setIsRefreshing(true);
    try {
      setStations(await getLiveReadings());
      setLastUpdated(new Date());
      setCountdown(30);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load live sensor readings.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadReadings();
    const fetchTimer = window.setInterval(() => loadReadings(), 30000);
    const countdownTimer = window.setInterval(() => setCountdown((value) => (value > 0 ? value - 1 : 30)), 1000);
    return () => {
      window.clearInterval(fetchTimer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  function handleFilterChange(field, value) {
    const resets = {
      province: { district: "", river_basin: "", river: "", station: "" },
      district: { river_basin: "", river: "", station: "" },
      river_basin: { river: "", station: "" },
      river: { station: "" },
    };
    setFilters((current) => ({ ...current, [field]: value, ...(resets[field] || {}) }));
  }

  const visibleStations = useMemo(() => filterStations(stations, filters), [stations, filters]);

  return (
    <AdminLayout title="Sensor Dashboard">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-primary">Live Sensor Dashboard</h1>
          <p className="mt-2 text-ink-secondary">Live readings from active water-level stations. Data refreshes every 30 seconds.</p>
          {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-ink-border bg-white px-4 py-2 text-sm shadow-sm">
            <Activity size={16} className="animate-pulse text-brand" />
            <span className="font-medium text-ink-secondary">Refreshing in <strong className="font-mono text-brand">{countdown}s</strong></span>
          </div>
          <button type="button" onClick={() => loadReadings(true)} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-2 text-sm font-semibold text-ink-primary shadow-sm hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <SensorFilters stations={stations} filters={filters} onChange={handleFilterChange} />
      {error && <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm font-medium text-flood-emergency">{error}</div>}

      {isLoading && !stations.length ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="font-medium text-ink-secondary">Connecting to sensor network...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleStations.map((station) => <StationCard key={station.id} station={station} />)}
          {visibleStations.length === 0 && !isLoading && (
            <div className="col-span-full rounded-xl border border-dashed border-ink-border bg-white p-12 text-center text-ink-secondary">
              {stations.length ? "No stations match the selected geography." : "No sensor stations configured."}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
