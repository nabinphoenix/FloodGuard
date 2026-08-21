import { Database, RefreshCw, Server, Waves, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getSensorHealth } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import LoadingSpinner from "../../components/LoadingSpinner";

function StatusPill({ status }) {
  const healthy = status === "healthy" || status === "active";
  const neutral = status === "not_configured";
  return <span className={"rounded-full px-3 py-1 text-xs font-bold uppercase " + (healthy ? "bg-green-100 text-green-800" : neutral ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800")}>{status || "unknown"}</span>;
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadHealth(manual = false) {
    if (manual) setIsRefreshing(true);
    try {
      setHealth(await getSensorHealth());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load system health.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => { loadHealth(); }, []);

  return (
    <AdminLayout title="System Health">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><h1 className="text-3xl font-black text-blue-950">Sensor System Health</h1><p className="mt-2 text-sm text-blue-700">RDS telemetry, optional existing DynamoDB configuration, SQS delivery and latest ingestion.</p></div>
          <button type="button" onClick={() => loadHealth(true)} disabled={isRefreshing} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-brand-gradientEnd disabled:opacity-60"><RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Refreshing..." : "Refresh"}</button>
        </div>

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {isLoading ? <LoadingSpinner message="Checking sensor systems..." /> : (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-slate-500">Relational Database (RDS)</p><div className="mt-4"><StatusPill status={health?.rds || health?.database} /></div></div><Database className="text-blue-500" size={26} /></div></article>
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-slate-500">Sensor Telemetry Store (DynamoDB)</p><div className="mt-4"><StatusPill status={health?.dynamodb} /></div><p className="mt-3 text-xs text-slate-500">{health?.dynamodb_detail}</p></div><Server className="text-orange-500" size={26} /></div></article>
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-slate-500">Sensor Queue (SQS)</p><div className="mt-4 flex items-center gap-3"><StatusPill status={health?.sqs} /><span className="text-3xl font-black text-blue-950">{health?.sqs_queue_depth ?? "-"}</span></div><p className="mt-3 text-xs text-slate-500">Approximate messages waiting</p></div><Zap className="text-purple-500" size={26} /></div></article>
              <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-slate-500">Latest Sensor Reading</p><p className="mt-4 text-lg font-black text-blue-950">{health?.latest_sensor_reading ? Number(health.latest_sensor_reading.water_level).toFixed(2) + " m" : "No readings found"}</p><p className="mt-2 text-xs text-slate-500">{health?.latest_sensor_reading ? new Date(health.latest_sensor_reading.timestamp).toLocaleString() : "No sensor readings are available yet."}</p></div><Waves className="text-brand" size={26} /></div></article>
            </div>
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900"><p><strong>Last ingestion time:</strong> {health?.last_sensor_reading_time ? new Date(health.last_sensor_reading_time).toLocaleString() : "No readings found"}</p><p className="mt-2">Sensor telemetry is saved before notification delivery is attempted. A failed SNS or SQS call does not remove a saved reading.</p></div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
