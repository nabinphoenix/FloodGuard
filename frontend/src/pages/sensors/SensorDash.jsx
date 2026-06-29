import { useEffect, useState } from "react";

import { getLiveReadings } from "../../api/sensors";

function statusForStation(station) {
  const level = station.latest_reading?.water_level;

  if (level === null || level === undefined) {
    return {
      label: "NO DATA",
      color: "bg-slate-100 text-slate-700",
      bar: "bg-slate-400",
    };
  }

  if (level >= station.danger_threshold) {
    return {
      label: "DANGER",
      color: "bg-red-100 text-red-800",
      bar: "bg-red-600",
    };
  }

  if (level >= station.warning_threshold) {
    return {
      label: "WARNING",
      color: "bg-yellow-100 text-yellow-800",
      bar: "bg-yellow-500",
    };
  }

  return {
    label: "SAFE",
    color: "bg-green-100 text-green-800",
    bar: "bg-green-600",
  };
}

function StationCard({ station }) {
  const waterLevel = station.latest_reading?.water_level;
  const status = statusForStation(station);
  const percent =
    waterLevel === null || waterLevel === undefined
      ? 0
      : Math.min(100, Math.round((waterLevel / station.danger_threshold) * 100));

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-blue-950">{station.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{station.district}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-7 flex items-end gap-2">
        <span className="text-5xl font-bold text-blue-900">
          {waterLevel === null || waterLevel === undefined ? "--" : waterLevel.toFixed(2)}
        </span>
        <span className="pb-2 text-sm font-semibold text-slate-500">m</span>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-slate-500">
          <span>0 m</span>
          <span>Danger {station.danger_threshold.toFixed(2)} m</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-blue-100">
          <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>Warning {station.warning_threshold.toFixed(2)} m</span>
          <span>{station.latest_reading?.timestamp ? new Date(station.latest_reading.timestamp).toLocaleTimeString() : "Waiting for reading"}</span>
        </div>
      </div>
    </article>
  );
}

export default function SensorDash() {
  const [stations, setStations] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadReadings() {
    try {
      const data = await getLiveReadings();
      setStations(data);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load live sensor readings.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReadings();
    const timer = window.setInterval(loadReadings, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-950">Live Sensor Dashboard</h1>
            <p className="mt-2 text-sm text-blue-700">
              Water level readings refresh automatically every 30 seconds.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-blue-100 bg-white p-8 text-blue-800">
            Loading live readings...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
