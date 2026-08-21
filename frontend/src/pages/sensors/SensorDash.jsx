import { Activity, AlertTriangle, Clock, Plus, Radio, RefreshCw, ShieldCheck, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getSensorDashboard } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";

const summaryCards = [
  ["total_stations", "Total Stations", Radio, "bg-blue-100 text-blue-700"],
  ["active_stations", "Active Stations", ShieldCheck, "bg-green-100 text-green-700"],
  ["stations_no_data", "Stations with No Data", Clock, "bg-slate-100 text-slate-700"],
  ["safe_stations", "SAFE", ShieldCheck, "bg-green-100 text-green-700"],
  ["watch_stations", "WATCH", Waves, "bg-yellow-100 text-yellow-700"],
  ["warning_stations", "WARNING", AlertTriangle, "bg-orange-100 text-orange-700"],
  ["emergency_stations", "EMERGENCY", AlertTriangle, "bg-red-100 text-red-700"],
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
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = dashboard?.summary;
  const stations = dashboard?.stations || [];
  const recent = dashboard?.recent_readings || [];

  return (
    <AdminLayout title="Sensor Dashboard">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-primary">Field Officer Dashboard</h1>
            <p className="mt-2 text-ink-secondary">Operational sensor monitoring and recent station telemetry.</p>
            {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last refreshed {lastUpdated.toLocaleTimeString()}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/sensors/stations?create=1" className="flex items-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-white hover:bg-brand-gradientEnd"><Plus size={17} /> Add Sensor Station</Link>
            <button type="button" onClick={() => load(true)} disabled={isRefreshing} className="flex items-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-3 font-semibold shadow-sm hover:border-brand hover:text-brand disabled:opacity-60"><RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} /> Refresh</button>
          </div>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {isLoading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading sensor dashboard...</div>
        ) : stations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
            <Activity className="mx-auto text-blue-300" size={38} />
            <h2 className="mt-4 text-xl font-black text-blue-950">No sensor stations configured.</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-600">Create your first monitoring station to start collecting water-level data.</p>
            <Link to="/sensors/stations?create=1" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-bold text-white"><Plus size={17} /> Add Sensor Station</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map(([key, label, Icon, color]) => (
                <article key={key} className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                  <div className={"mb-4 flex h-10 w-10 items-center justify-center rounded-lg " + color}><Icon size={20} /></div>
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-black text-blue-950">{summary?.[key] ?? 0}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-blue-100 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm"><strong className="text-blue-950">Latest reading time:</strong> {summary?.latest_reading_time ? new Date(summary.latest_reading_time).toLocaleString() : "No readings found"}</div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-blue-950">Station status</h2><p className="mt-1 text-sm text-slate-600">Latest backend-classified state for every configured station.</p></div><Link to="/sensors/live" className="text-sm font-bold text-brand hover:underline">Live view</Link></div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[700px] w-full text-left text-sm">
                    <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-3">Station</th><th className="px-2 py-3">Location</th><th className="px-2 py-3">Latest level</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Last updated</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {stations.map((station) => {
                        const reading = station.latest_reading;
                        return <tr key={station.id}><td className="px-2 py-4"><p className="font-bold text-blue-950">{station.station_code}</p><p className="text-xs text-slate-500">{station.station_name}</p></td><td className="px-2 py-4 text-slate-600">{station.province} · {station.district}<br /><span className="text-xs">{station.river_name}</span></td><td className="px-2 py-4 font-bold">{reading ? Number(reading.water_level).toFixed(2) + " m" : "--"}</td><td className="px-2 py-4"><span className={"rounded-full px-2.5 py-1 text-xs font-bold " + statusClass(station.status)}>{statusLabel(station.status)}</span></td><td className="px-2 py-4 text-xs text-slate-500">{reading ? new Date(reading.timestamp).toLocaleString() : "Station configured. Waiting for first sensor reading."}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-black text-blue-950">Recent readings</h2>
                <p className="mt-1 text-sm text-slate-600">Most recent telemetry points received by the API.</p>
                <div className="mt-5 space-y-3">
                  {recent.length === 0 ? <p className="rounded-lg bg-blue-50 p-4 text-sm font-semibold text-blue-800">No sensor readings are available yet.</p> : recent.map((reading) => <div key={reading.station_code + reading.timestamp} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="font-bold text-blue-950">{reading.station_code} · {Number(reading.water_level).toFixed(2)} m</p><span className={"rounded-full px-2 py-1 text-[11px] font-bold " + statusClass(reading.status)}>{statusLabel(reading.status)}</span></div><p className="mt-1 text-xs text-slate-500">{reading.station_name} · {new Date(reading.timestamp).toLocaleString()}</p></div>)}
                </div>
              </article>
            </div>
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900"><h2 className="font-black">Sensor Demo</h2><p className="mt-2">Run <code className="font-mono font-bold">scripts/simulate_water_level.py</code> after creating a station. It sends authenticated readings through the API and demonstrates each threshold state without exposing credentials in the browser.</p></div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
