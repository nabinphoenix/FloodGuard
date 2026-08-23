import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Activity, Play, Square, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";

import { generateSimulatorReading, getStationHistory, getStations } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import { formatReadingAge, freshnessClass, freshnessLabel } from "../../utils/sensorMonitoring";
import {
  READER_DURATION_OPTIONS,
  READER_INTERVAL_OPTIONS,
  createReaderSession,
  readerControlState,
  readerSessionTiming,
} from "../../utils/sensorReaderSession";
import { formatKathmanduTime } from "../../utils/time";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const PATTERNS = [
  ["rising", "Rising"],
  ["falling", "Falling"],
  ["mixed", "Mixed / Random Walk"],
];

function statusClass(status) {
  return {
    safe: "bg-green-100 text-green-800",
    watch: "bg-yellow-100 text-yellow-800",
    warning: "bg-orange-100 text-orange-800",
    emergency: "bg-red-100 text-red-800",
  }[status] || "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  return String(status || "no data").replace("_", " ").toUpperCase();
}

function secondsLabel(seconds) {
  const wholeSeconds = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(wholeSeconds / 60)}m ${wholeSeconds % 60}s`;
}

function thresholdLine(label, value, color, length) {
  return {
    label,
    data: Array.from({ length }, () => value),
    borderColor: color,
    borderDash: [6, 6],
    borderWidth: 2,
    pointRadius: 0,
    tension: 0,
  };
}

export default function SensorReader() {
  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [pattern, setPattern] = useState("rising");
  const [session, setSession] = useState(null);
  const [readings, setReadings] = useState([]);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const requestInFlight = useRef(false);

  const selectedStation = useMemo(
    () => stations.find((station) => String(station.id) === String(selectedStationId)),
    [stations, selectedStationId],
  );
  const isRunning = Boolean(session);
  const controls = readerControlState({
    isRunning,
    hasStation: Boolean(selectedStation),
    isSending,
  });
  const timing = session ? readerSessionTiming(session, now) : null;
  const latestReading = readings.at(-1) || null;
  const previousReading = readings.length > 1 ? readings.at(-2) : null;

  useEffect(() => {
    let ignore = false;
    getStations()
      .then((data) => {
        if (ignore) return;
        const activeStations = data.filter((station) => station.is_active);
        setStations(activeStations);
        setSelectedStationId((current) => current || activeStations[0]?.id || "");
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.detail || "Could not load sensor stations.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!selectedStationId) {
      setReadings([]);
      return undefined;
    }
    let ignore = false;
    getStationHistory(selectedStationId, 30)
      .then((data) => {
        if (!ignore) setReadings(data.readings || []);
      })
      .catch((err) => {
        if (!ignore) setError(err.response?.data?.detail || "Could not load station reading history.");
      });
    return () => { ignore = true; };
  }, [selectedStationId]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    let firstRequest = true;

    async function generateOne() {
      if (!active || requestInFlight.current) return;
      requestInFlight.current = true;
      setIsSending(true);
      try {
        const response = await generateSimulatorReading({
          station_id: session.stationId,
          pattern: session.pattern,
        });
        if (!active) return;
        const reading = {
          id: `${response.station_id}-${response.recorded_at}`,
          station_id: response.station_id,
          water_level: response.water_level,
          status: response.status,
          previous_status: response.previous_status,
          timestamp: response.recorded_at,
          freshness: response.freshness,
        };
        setReadings((current) => [...current, reading].slice(-30));
        setTotalGenerated((current) => current + 1);
        setError("");
        if (firstRequest) {
          setMessage("Interactive Sensor Reader is running.");
          firstRequest = false;
        }
      } catch (err) {
        if (active) setError(err.response?.data?.detail || "Could not generate a sensor reading.");
      } finally {
        requestInFlight.current = false;
        setIsSending(false);
      }
    }

    generateOne();
    const readingTimer = window.setInterval(generateOne, session.intervalSeconds * 1000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    const stopTimer = window.setTimeout(() => {
      active = false;
      setSession(null);
      setMessage("Sensor Reader stopped after the selected duration.");
    }, session.durationSeconds * 1000);

    return () => {
      active = false;
      window.clearInterval(readingTimer);
      window.clearInterval(clockTimer);
      window.clearTimeout(stopTimer);
    };
  }, [session]);

  function startReader() {
    if (session || !selectedStation) return;
    setError("");
    setMessage("");
    setTotalGenerated(0);
    const startedAt = Date.now();
    setNow(startedAt);
    setSession(createReaderSession({
      now: startedAt,
      stationId: selectedStation.id,
      pattern,
      durationSeconds: Number(durationSeconds),
      intervalSeconds: Number(intervalSeconds),
    }));
  }

  function stopReader() {
    if (!session) return;
    setSession(null);
    setMessage("Sensor Reader stopped.");
  }

  const chartData = useMemo(() => {
    const labels = readings.map((reading) => formatKathmanduTime(reading.timestamp, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }));
    const datasets = [{
      label: "Water level (m)",
      data: readings.map((reading) => reading.water_level),
      borderColor: "#0EA5E9",
      backgroundColor: "rgba(14, 165, 233, 0.12)",
      borderWidth: 3,
      pointRadius: 4,
      pointBackgroundColor: "#0EA5E9",
      tension: 0.32,
      fill: true,
    }];
    if (selectedStation && labels.length) {
      datasets.push(
        thresholdLine("Watch threshold", selectedStation.watch_threshold, "#EAB308", labels.length),
        thresholdLine("Warning threshold", selectedStation.warning_threshold, "#F97316", labels.length),
        thresholdLine("Emergency threshold", selectedStation.danger_threshold, "#EF4444", labels.length),
      );
    }
    return { labels, datasets };
  }, [readings, selectedStation]);

  const recentRows = useMemo(() => readings.map((reading, index) => ({
    ...reading,
    change: index ? reading.water_level - readings[index - 1].water_level : null,
  })).slice(-12).reverse(), [readings]);

  return (
    <AdminLayout title="Interactive Sensor Reader">
      <section>
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-ink-primary">Interactive Sensor Reader</h1>
          <p className="mt-2 text-ink-secondary">Generate one controlled reading at a time through FloodGuard’s protected backend and sensor event pipeline.</p>
        </div>

        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {message && <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}

        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="text-sm font-bold text-slate-700">Station
              <select value={selectedStationId} onChange={(event) => setSelectedStationId(event.target.value)} disabled={isRunning || isLoading} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-60">
                {stations.length === 0 && <option value="">No active stations</option>}
                {stations.map((station) => <option key={station.id} value={station.id}>{station.station_name} ({station.station_code})</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Duration
              <select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} disabled={isRunning} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-60">
                {READER_DURATION_OPTIONS.map((value) => <option key={value} value={value}>{value / 60} minute{value === 60 ? "" : "s"}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Interval
              <select value={intervalSeconds} onChange={(event) => setIntervalSeconds(Number(event.target.value))} disabled={isRunning} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-60">
                {READER_INTERVAL_OPTIONS.map((value) => <option key={value} value={value}>{value} seconds</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Simulation Pattern
              <select value={pattern} onChange={(event) => setPattern(event.target.value)} disabled={isRunning} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-60">
                {PATTERNS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={startReader} disabled={controls.startDisabled} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Play size={16} /> {isSending && !isRunning ? "Starting..." : "Start Reading"}</button>
            <button type="button" onClick={stopReader} disabled={controls.stopDisabled} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"><Square size={15} /> Stop</button>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${isRunning ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>Simulation: {isRunning ? "RUNNING" : "STOPPED"}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-bold uppercase text-sky-800">Station</p><p className="mt-1 font-bold">{selectedStation?.station_name || "--"}</p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-bold uppercase text-sky-800">Elapsed time</p><p className="mt-1 font-bold">{timing ? secondsLabel(timing.elapsedSeconds) : "0m 0s"}</p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-bold uppercase text-sky-800">Remaining time</p><p className="mt-1 font-bold">{timing ? secondsLabel(timing.remainingSeconds) : "--"}</p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-bold uppercase text-sky-800">Next reading in</p><p className="mt-1 font-bold">{timing ? secondsLabel(timing.nextReadingInSeconds) : "--"}</p></div>
            <div className="rounded-lg bg-white/80 p-3"><p className="text-xs font-bold uppercase text-sky-800">Generated readings</p><p className="mt-1 font-bold">{totalGenerated}</p></div>
          </div>
        </article>

        {selectedStation && <article className="mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-brand">{selectedStation.station_code}</p><h2 className="mt-1 text-xl font-black text-blue-950">{selectedStation.station_name}</h2><p className="mt-1 text-sm text-slate-600">{selectedStation.river_name} · {selectedStation.district}</p></div><Waves className="text-brand" size={30} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div><p className="text-xs font-bold uppercase text-slate-500">Current water level</p><p className="mt-1 text-xl font-black text-blue-950">{latestReading ? `${Number(latestReading.water_level).toFixed(2)} m` : "--"}</p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Current status</p><p className="mt-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(latestReading?.status)}`}>{statusLabel(latestReading?.status)}</span></p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Previous status</p><p className="mt-1 font-bold">{statusLabel(latestReading?.previous_status || previousReading?.status)}</p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Trend</p><p className="mt-1 font-bold">{!latestReading || !previousReading ? "--" : latestReading.water_level > previousReading.water_level ? "↑ Rising" : latestReading.water_level < previousReading.water_level ? "↓ Falling" : "→ Steady"}</p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Last reading</p><p className="mt-1 font-bold">{formatReadingAge(latestReading?.timestamp)}</p></div>
            <div><p className="text-xs font-bold uppercase text-slate-500">Freshness</p><p className="mt-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${freshnessClass(latestReading?.freshness)}`}>{freshnessLabel(latestReading?.freshness)}</span></p></div>
          </div>
        </article>}

        {selectedStation && <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-blue-950">Live water-level chart</h2><p className="mt-1 text-sm text-slate-600">New interactive readings append to the chart. Threshold lines use the selected station’s actual configuration.</p><div className="mt-5 h-[360px]"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: { beginAtZero: true, title: { display: true, text: "Water level (m)" } }, x: { ticks: { maxTicksLimit: 10 } } } }} /></div></article>
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-blue-950">Station thresholds</h2><p className="mt-1 text-sm text-slate-600">Classification is calculated by the backend.</p><div className="mt-5 space-y-3 text-sm"><div className="rounded-lg bg-green-50 p-3 text-green-900"><strong>SAFE</strong><br />Below {Number(selectedStation.watch_threshold).toFixed(2)} m</div><div className="rounded-lg bg-yellow-50 p-3 text-yellow-900"><strong>WATCH</strong><br />At or above {Number(selectedStation.watch_threshold).toFixed(2)} m</div><div className="rounded-lg bg-orange-50 p-3 text-orange-900"><strong>WARNING</strong><br />At or above {Number(selectedStation.warning_threshold).toFixed(2)} m</div><div className="rounded-lg bg-red-50 p-3 text-red-900"><strong>EMERGENCY</strong><br />At or above {Number(selectedStation.danger_threshold).toFixed(2)} m</div></div></article>
        </section>}

        <article className="mt-6 overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm"><div className="border-b border-blue-100 px-6 py-5"><h2 className="text-xl font-black text-blue-950">Recent readings</h2></div><table className="min-w-[620px] w-full text-left text-sm"><thead className="bg-blue-50 text-xs uppercase tracking-wide text-blue-900"><tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Level</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Change</th></tr></thead><tbody className="divide-y divide-blue-50">{recentRows.length === 0 ? <tr><td colSpan="4" className="px-5 py-5 text-slate-600">Start a session to generate readings for the selected station.</td></tr> : recentRows.map((reading) => <tr key={reading.id || reading.timestamp}><td className="px-5 py-3 text-slate-600">{formatKathmanduTime(reading.timestamp)}</td><td className="px-5 py-3 font-bold text-blue-950">{Number(reading.water_level).toFixed(2)} m</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(reading.status)}`}>{statusLabel(reading.status)}</span></td><td className={`px-5 py-3 font-bold ${reading.change > 0 ? "text-emerald-700" : reading.change < 0 ? "text-rose-700" : "text-slate-500"}`}>{reading.change == null ? "--" : `${reading.change >= 0 ? "+" : ""}${reading.change.toFixed(2)} m`}</td></tr>)}</tbody></table></article>
      </section>
    </AdminLayout>
  );
}
