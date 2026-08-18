import { useEffect, useState } from "react";

import { getLiveReadings } from "../../api/sensors";
import SensorCard from "../../components/SensorCard";

function statusForStation(station) {
  const level = station.latest_reading?.water_level;

  if (level === null || level === undefined) {
    return "watch";
  }

  if (level >= station.danger_threshold) {
    return "emergency";
  }

  if (level >= station.warning_threshold) {
    return "warning";
  }

  return "safe";
}

function StationCard({ station }) {
  const waterLevel = station.latest_reading?.water_level;
  const level = statusForStation(station);
  const percent =
    waterLevel === null || waterLevel === undefined
      ? 0
      : Math.min(100, Math.round((waterLevel / station.danger_threshold) * 100));
  const lastUpdated = station.latest_reading?.timestamp
    ? new Date(station.latest_reading.timestamp).toLocaleTimeString()
    : "Waiting for reading";

  return (
      <SensorCard
        stationName={station.name}
        value={waterLevel}
        unit="m"
        level={level}
        lastUpdated={`${station.district} / ${lastUpdated}`}
      >
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-ink-secondary">
            <span>0 m</span>
            <span>Danger {station.danger_threshold.toFixed(2)} m</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-ink-border">
            <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-secondary">
            <span>Warning {station.warning_threshold.toFixed(2)} m</span>
            <span>{lastUpdated}</span>
          </div>
        </div>
      </SensorCard>
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
    <main className="min-h-screen bg-surface-bg px-4 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand">Live Sensor Dashboard</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Water level readings refresh automatically every 30 seconds.
            </p>
          </div>
          <div className="text-sm text-ink-secondary">
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-ink-border bg-surface-card p-8 text-brand shadow-sm">
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
