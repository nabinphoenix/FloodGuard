import { Activity, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getLiveReadings } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import SensorFilters, { filterStations } from "../../components/SensorFilters";

function statusClass(status) {
  return {
    safe: "bg-green-100 text-green-800",
    watch: "bg-yellow-100 text-yellow-800",
    warning: "bg-orange-100 text-orange-800",
    emergency: "bg-red-100 text-red-800",
    no_data: "bg-slate-100 text-slate-700",
  }[status] || "bg-slate-100 text-slate-700";
}

function formatReadingAge(timestamp) {
  const timestampMs = Date.parse(timestamp);
  if (Number.isNaN(timestampMs)) return "Unknown age";
  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (ageSeconds < 60) return `${ageSeconds} second${ageSeconds === 1 ? "" : "s"} ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  const staleLabel = ageMinutes >= 5 ? " (STALE)" : "";
  return `${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago${staleLabel}`;
}

function statusLabel(status) {
  return status === "no_data" ? "NO DATA" : String(status || "unknown").toUpperCase();
}

export default function LiveWaterLevels() {
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({ province: "", district: "", river_basin: "", river: "", station: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load(manual = false) {
    if (manual) setIsRefreshing(true);
    try {
      setStations(await getLiveReadings());
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load live water levels.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  function changeFilter(field, value) {
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
    <AdminLayout title="Live Water Levels">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-primary">Live Water Levels</h1>
            <p className="mt-2 text-ink-secondary">Current telemetry from active stations. Status is calculated by the backend thresholds.</p>
            {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
          </div>
          <button type="button" onClick={() => load(true)} disabled={isRefreshing} className="flex items-center justify-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-3 font-semibold shadow-sm hover:border-brand hover:text-brand disabled:opacity-60"><RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Refreshing..." : "Refresh"}</button>
        </div>

        <SensorFilters stations={stations} filters={filters} onChange={changeFilter} />
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {isLoading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading live water levels...</div>
        ) : visibleStations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
            <Activity className="mx-auto text-blue-300" size={34} />
            <h2 className="mt-3 text-xl font-black text-blue-950">{stations.length ? "No stations match the selected filters." : "No sensor stations configured."}</h2>
            <p className="mt-2 text-slate-600">{stations.length ? "Change the filters to view another active station." : "Create a monitoring station before sending telemetry."}</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleStations.map((station) => {
              const reading = station.latest_reading;
              return (
                <article key={station.id} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-brand">{station.station_code}</p>
                      <h2 className="mt-1 text-2xl font-black text-blue-950">{station.station_name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{station.province} · {station.district} · {station.river_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{station.river_basin}</p>
                    </div>
                    <span className={"w-fit rounded-full px-3 py-1 text-xs font-black tracking-wide " + statusClass(station.status)}>{statusLabel(station.status)}</span>
                  </div>
                  <div className="mt-7 flex items-end gap-2">
                    <span className="text-5xl font-black tracking-tight text-blue-950">{reading ? Number(reading.water_level).toFixed(2) : "--"}</span>
                    <span className="pb-1 text-xl font-bold text-slate-500">m</span>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900"><p className="text-xs font-bold uppercase">Watch</p><strong>{station.watch_threshold?.toFixed(2)} m</strong></div>
                    <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900"><p className="text-xs font-bold uppercase">Warning</p><strong>{station.warning_threshold?.toFixed(2)} m</strong></div>
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900"><p className="text-xs font-bold uppercase">Emergency</p><strong>{station.danger_threshold?.toFixed(2)} m</strong></div>
                  </div>
                  <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">{reading ? "Last reading " + formatReadingAge(reading.timestamp) + " · " + new Date(reading.timestamp).toLocaleString() : "Station configured. Waiting for first sensor reading."}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}
