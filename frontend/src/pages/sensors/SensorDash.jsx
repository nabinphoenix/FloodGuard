import { Activity, Clock, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { getLiveReadings } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";

function statusForStation(station) {
  const level = station.latest_reading?.water_level;

  if (level === null || level === undefined) {
    return "no_data";
  }

  if (level >= station.danger_threshold) return "emergency";
  if (level >= station.warning_threshold) return "warning";
  return "safe";
}

function getStatusColor(status) {
  switch (status) {
    case "safe":
      return "bg-green-500";
    case "warning":
      return "bg-orange-500";
    case "emergency":
      return "bg-red-600";
    case "no_data":
    default:
      return "bg-gray-400";
  }
}

function StationCard({ station }) {
  const waterLevel = station.latest_reading?.water_level;
  const level = statusForStation(station);
  const color = getStatusColor(level);
  const hasReading = waterLevel !== null && waterLevel !== undefined;
  const percent = hasReading
    ? Math.min(100, Math.round((waterLevel / station.danger_threshold) * 100))
    : 0;
  const lastUpdated = station.latest_reading?.timestamp
    ? new Date(station.latest_reading.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Waiting for reading";

  return (
    <article className="relative overflow-hidden rounded-xl border border-ink-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className={`absolute left-0 right-0 top-0 h-1.5 ${color}`} />

      <div className="mb-6 flex items-start justify-between gap-4 pt-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink-primary">{station.name}</h2>
          <p className="mt-0.5 text-sm text-ink-secondary">{station.district}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm ${color}`}>
          {level === "no_data" ? "NO DATA" : level}
        </span>
      </div>

      <div className="mb-6 flex items-end gap-2">
        <span className="text-5xl font-black tracking-tighter text-ink-primary">
          {hasReading ? waterLevel.toFixed(2) : "--"}
        </span>
        <span className="pb-1 text-xl font-bold text-ink-secondary">m</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-xs font-semibold text-ink-secondary">
            <span>Level vs danger</span>
            <span>{hasReading ? `${percent}%` : "—"}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
            <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-medium text-gray-400">
            <span>0 m</span>
            <span className="text-orange-500">Warning {station.warning_threshold.toFixed(1)} m</span>
            <span className="text-red-500">Danger {station.danger_threshold.toFixed(1)} m</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <Clock size={14} className="opacity-70" />
            <span className="font-mono">{lastUpdated}</span>
          </div>
          {!hasReading && <span className="text-xs font-semibold text-gray-500">Waiting for reading</span>}
        </div>
      </div>
    </article>
  );
}

export default function SensorDash() {
  const [stations, setStations] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(30);

  async function loadReadings(manual = false) {
    if (manual) setIsRefreshing(true);

    try {
      const data = await getLiveReadings();
      setStations(data);
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
    const countdownTimer = window.setInterval(() => {
      setCountdown((previous) => (previous > 0 ? previous - 1 : 30));
    }, 1000);

    return () => {
      window.clearInterval(fetchTimer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  return (
    <AdminLayout title="Sensor Dashboard">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-primary">Live Sensor Dashboard</h1>
          <p className="mt-2 text-ink-secondary">Live readings from active water-level monitoring stations. Data refreshes every 30 seconds.</p>
          {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-ink-border bg-white px-4 py-2 text-sm shadow-sm">
            <Activity size={16} className="animate-pulse text-brand" />
            <span className="font-medium text-ink-secondary">Refreshing in <span className="font-mono font-bold text-brand">{countdown}s</span></span>
          </div>
          <button type="button" onClick={() => loadReadings(true)} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-2 text-sm font-semibold text-ink-primary shadow-sm hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm font-medium text-flood-emergency">{error}</div>}

      {isLoading && !stations.length ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="font-medium text-ink-secondary">Connecting to sensor network...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {stations.map((station) => <StationCard key={station.id} station={station} />)}
          {stations.length === 0 && !isLoading && (
            <div className="col-span-full rounded-xl border border-dashed border-ink-border bg-white p-12 text-center text-ink-secondary">
              No sensor stations configured.
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
