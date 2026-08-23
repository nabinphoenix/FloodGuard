import {
  Activity,
  AlertTriangle,
  Clock,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getSensorDashboard,
} from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import AdminPagination from "../../components/AdminPagination";
import { formatReadingAge, freshnessClass, freshnessLabel } from "../../utils/sensorMonitoring";
import { formatKathmanduTime } from "../../utils/time";

const SENSOR_DASHBOARD_POLL_INTERVAL_MS = 10_000;
const STATIONS_PAGE_SIZE = 8;
const RECENT_READINGS_PAGE_SIZE = 8;

const summaryCards = [
  ["active_stations", "Active Stations", Radio, "bg-blue-100 text-blue-700"],
  ["stations_no_data", "No Readings", Clock, "bg-slate-100 text-slate-700"],
  ["safe_stations", "SAFE", ShieldCheck, "bg-green-100 text-green-700"],
  ["watch_stations", "WATCH", Waves, "bg-yellow-100 text-yellow-700"],
  ["warning_stations", "WARNING", AlertTriangle, "bg-orange-100 text-orange-700"],
  ["emergency_stations", "EMERGENCY", AlertTriangle, "bg-red-100 text-red-700"],
  ["stale_stations", "Stale Stations", Clock, "bg-rose-100 text-rose-700"],
];

function statusClass(status) {
  return {
    safe: "bg-green-100 text-green-800",
    watch: "bg-yellow-100 text-yellow-800",
    warning: "bg-orange-100 text-orange-800",
    emergency: "bg-red-100 text-red-800",
    no_data: "bg-slate-100 text-slate-700",
  }[status] || "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  return status === "no_data" ? "NO DATA" : String(status || "unknown").toUpperCase();
}

export default function SensorDash() {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stationsPage, setStationsPage] = useState(1);
  const [recentReadingsPage, setRecentReadingsPage] = useState(1);

  async function load(manual = false) {
    if (manual) setIsRefreshing(true);
    try {
      setDashboard(await getSensorDashboard());
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load sensor dashboard.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, SENSOR_DASHBOARD_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const summary = dashboard?.summary;
  const stations = dashboard?.stations || [];
  const recent = dashboard?.recent_readings || [];
  const stationsTotalPages = Math.max(1, Math.ceil(stations.length / STATIONS_PAGE_SIZE));
  const recentReadingsTotalPages = Math.max(1, Math.ceil(recent.length / RECENT_READINGS_PAGE_SIZE));
  const paginatedStations = useMemo(
    () => stations.slice((stationsPage - 1) * STATIONS_PAGE_SIZE, stationsPage * STATIONS_PAGE_SIZE),
    [stations, stationsPage],
  );
  const paginatedRecentReadings = useMemo(
    () => recent.slice((recentReadingsPage - 1) * RECENT_READINGS_PAGE_SIZE, recentReadingsPage * RECENT_READINGS_PAGE_SIZE),
    [recent, recentReadingsPage],
  );

  useEffect(() => {
    setStationsPage((current) => Math.min(current, stationsTotalPages));
    setRecentReadingsPage((current) => Math.min(current, recentReadingsTotalPages));
  }, [stationsTotalPages, recentReadingsTotalPages]);

  return (
    <AdminLayout title="Sensor Dashboard">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-primary">Field Officer Dashboard</h1>
            <p className="mt-2 text-ink-secondary">Operational sensor monitoring and recent station telemetry.</p>
            {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last updated: {formatKathmanduTime(lastUpdated)}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/sensors/stations?create=1" className="flex items-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-white hover:bg-brand-gradientEnd"><Plus size={17} /> Add Sensor Station</Link>
            <button type="button" onClick={() => load(true)} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-3 font-semibold shadow-sm hover:border-brand hover:text-brand disabled:opacity-60"><RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {isLoading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading sensor dashboard...</div>
        ) : stations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm"><Activity className="mx-auto text-blue-300" size={38} /><h2 className="mt-4 text-xl font-black text-blue-950">No sensor stations configured.</h2><p className="mx-auto mt-2 max-w-lg text-slate-600">Create a monitoring station to start receiving automatic cloud telemetry.</p><Link to="/sensors/stations?create=1" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-bold text-white"><Plus size={17} /> Add Sensor Station</Link></div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{summaryCards.map(([key, label, Icon, color]) => <article key={key} className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}><Icon size={20} /></div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-blue-950">{summary?.[key] ?? 0}</p></article>)}</div>
            <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-blue-950">Sensor Monitoring</h2><p className="mt-1 text-sm text-slate-600">Latest backend-classified state for every configured station.</p></div><Link to="/sensors/live" className="text-sm font-bold text-brand hover:underline">Live view</Link></div><div className="mt-5 overflow-x-auto"><table className="min-w-[780px] w-full text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-3">Station</th><th className="px-2 py-3">Location</th><th className="px-2 py-3">Latest level</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Freshness</th><th className="px-2 py-3">Last reading</th></tr></thead><tbody className="divide-y divide-slate-100">{paginatedStations.map((station) => { const reading = station.latest_reading; return <tr key={station.id}><td className="px-2 py-4"><p className="font-bold text-blue-950">{station.station_code}</p><p className="text-xs text-slate-500">{station.station_name}</p></td><td className="px-2 py-4 text-slate-600">{station.province} · {station.district}<br /><span className="text-xs">{station.river_name}</span></td><td className="px-2 py-4 font-bold">{reading ? `${Number(reading.water_level).toFixed(2)} m` : "--"}</td><td className="px-2 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(station.status)}`}>{statusLabel(station.status)}</span></td><td className="px-2 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${freshnessClass(station.freshness)}`}>{freshnessLabel(station.freshness)}</span></td><td className="px-2 py-4 text-xs text-slate-500">{reading ? formatReadingAge(reading.timestamp) : "No reading yet"}</td></tr>; })}</tbody></table></div><AdminPagination currentPage={stationsPage} totalPages={stationsTotalPages} totalItems={stations.length} pageSize={STATIONS_PAGE_SIZE} onPageChange={setStationsPage} /></article>
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-blue-950">Recent Sensor Readings</h2><p className="mt-1 text-sm text-slate-600">Most recent telemetry received by the API.</p><div className="mt-5 overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-2">Time</th><th className="pb-2">Station</th><th className="pb-2">Water level</th><th className="pb-2">Status</th><th className="pb-2">Freshness</th></tr></thead><tbody className="divide-y divide-slate-100">{recent.length === 0 ? <tr><td colSpan="5" className="py-4 text-slate-600">No sensor readings are available yet.</td></tr> : paginatedRecentReadings.map((reading) => <tr key={`${reading.station_code}-${reading.timestamp}`}><td className="py-3 text-xs text-slate-600">{formatKathmanduTime(reading.timestamp)}</td><td className="py-3"><p className="font-bold text-blue-950">{reading.station_name || reading.station_code}</p><p className="text-xs text-slate-500">{reading.station_code}</p></td><td className="py-3 font-bold">{Number(reading.water_level).toFixed(2)} m</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(reading.status)}`}>{statusLabel(reading.status)}</span></td><td className="py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${freshnessClass(reading.freshness)}`}>{freshnessLabel(reading.freshness)}</span></td></tr>)}</tbody></table></div><AdminPagination currentPage={recentReadingsPage} totalPages={recentReadingsTotalPages} totalItems={recent.length} pageSize={RECENT_READINGS_PAGE_SIZE} onPageChange={setRecentReadingsPage} /></article>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
