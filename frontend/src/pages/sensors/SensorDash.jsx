import { useEffect, useState } from "react";
import { Activity, Clock } from "lucide-react";

import { getLiveReadings } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";

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

function getStatusColor(status) {
  switch (status) {
    case 'safe': return 'bg-green-500';
    case 'watch': return 'bg-yellow-400';
    case 'warning': return 'bg-orange-500';
    case 'emergency': return 'bg-red-600';
    default: return 'bg-gray-400';
  }
}

function StationCard({ station }) {
  const waterLevel = station.latest_reading?.water_level;
  const level = statusForStation(station);
  const color = getStatusColor(level);
  
  const percent =
    waterLevel === null || waterLevel === undefined
      ? 0
      : Math.min(100, Math.round((waterLevel / station.danger_threshold) * 100));
      
  const lastUpdated = station.latest_reading?.timestamp
    ? new Date(station.latest_reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : "Waiting for reading";

  return (
    <div className="rounded-xl border border-ink-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Decorative top border */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${color}`} />
      
      <div className="flex justify-between items-start mb-6 pt-2">
        <div>
          <h3 className="text-xl font-bold text-ink-primary tracking-tight">{station.name}</h3>
          <p className="text-sm text-ink-secondary mt-0.5">{station.district}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider ${color} shadow-sm`}>
          {level}
        </div>
      </div>
      
      <div className="flex items-end gap-2 mb-6">
        <span className="text-5xl font-black text-ink-primary tracking-tighter">
          {waterLevel !== null && waterLevel !== undefined ? waterLevel.toFixed(2) : "--"}
        </span>
        <span className="text-xl font-bold text-ink-secondary pb-1">m</span>
      </div>
      
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-ink-secondary mb-2">
            <span>Level vs Danger</span>
            <span>{percent}%</span>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} 
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-1">
            <span>0m</span>
            <span className="text-orange-500">Warn {station.warning_threshold.toFixed(1)}</span>
            <span className="text-red-500">Danger {station.danger_threshold.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <Clock size={14} className="opacity-70" />
            <span className="font-mono">{lastUpdated}</span>
          </div>
          
          {/* Mini Sparkline placeholder (can be enhanced with real small chart later) */}
          <div className="flex items-end gap-1 h-6 opacity-60">
             <div className="w-1.5 h-3 bg-brand/40 rounded-t-sm"></div>
             <div className="w-1.5 h-4 bg-brand/60 rounded-t-sm"></div>
             <div className="w-1.5 h-5 bg-brand/80 rounded-t-sm"></div>
             <div className="w-1.5 h-full bg-brand rounded-t-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SensorDash() {
  const [stations, setStations] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(30);

  async function loadReadings() {
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
    }
  }

  useEffect(() => {
    loadReadings();
    
    // Interval for fetching data
    const fetchTimer = window.setInterval(loadReadings, 30000);
    
    // Interval for countdown
    const countdownTimer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 30));
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
          <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Live Sensor Dashboard</h1>
          <p className="mt-2 text-ink-secondary">
            Real-time telemetry from active water level monitoring stations.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-ink-border shadow-sm text-sm">
          <Activity size={16} className="text-brand animate-pulse" />
          <div className="flex flex-col">
            <span className="text-ink-secondary font-medium">Refreshing in <span className="font-mono text-brand font-bold">{countdown}s</span></span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">
          {error}
        </div>
      )}

      {isLoading && !stations.length ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
          <p className="text-ink-secondary font-medium">Connecting to sensor network...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {stations.map((station) => (
            <StationCard key={station.id} station={station} />
          ))}
          {stations.length === 0 && !isLoading && (
            <div className="col-span-full py-12 text-center text-ink-secondary">
              No active sensor stations found.
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
