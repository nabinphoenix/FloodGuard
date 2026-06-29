import { useEffect, useState } from "react";

import { getSensorHealth } from "../../api/sensors";
import LoadingSpinner from "../../components/LoadingSpinner";

function StatusPill({ status }) {
  const healthy = status === "healthy";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${healthy ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      {status || "unknown"}
    </span>
  );
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadHealth() {
    try {
      setHealth(await getSensorHealth());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load system health.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-950">Sensor System Health</h1>
            <p className="mt-2 text-sm text-blue-700">Backend, DynamoDB, and queue status for sensor ingestion.</p>
          </div>
          <button type="button" onClick={loadHealth} className="rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Refresh
          </button>
        </div>

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {isLoading ? (
          <LoadingSpinner message="Checking sensor systems..." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Database</p>
              <div className="mt-4"><StatusPill status={health?.database} /></div>
            </article>
            <article className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">DynamoDB</p>
              <div className="mt-4"><StatusPill status={health?.dynamodb} /></div>
            </article>
            <article className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">SQS queue depth</p>
              <p className="mt-4 text-4xl font-bold text-blue-950">{health?.sqs_queue_depth ?? "-"}</p>
            </article>
            <article className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Last sensor reading</p>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                {health?.last_sensor_reading_time ? new Date(health.last_sensor_reading_time).toLocaleString() : "No readings found"}
              </p>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
