import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { useSearchParams } from "react-router-dom";

import { getPublicGeography } from "../../api/public";
import { getStationHistory, getStations } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import SensorFilters, { filterStations } from "../../components/SensorFilters";
import { freshnessClass, freshnessLabel } from "../../utils/sensorMonitoring";
import { formatKathmanduDateTime } from "../../utils/time";

const HISTORY_REFRESH_INTERVAL_MS = 10_000;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

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

function statusLabel(status) {
  return status === "no_data" ? "NO DATA" : String(status || "unknown").toUpperCase();
}

export default function WaterLevelChart() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stations, setStations] = useState([]);
  const [geography, setGeography] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(() => searchParams.get("station") || "");
  const [filters, setFilters] = useState({ province: "", district: "", river_basin: "", river: "", station: "" });
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const visibleStations = useMemo(() => filterStations(stations, filters), [stations, filters]);
  const selectedStation = useMemo(
    () => stations.find((station) => String(station.id) === String(selectedStationId)),
    [stations, selectedStationId],
  );

  useEffect(() => {
    async function loadStations() {
      try {
        setStations(await getStations());
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load sensor stations.");
      } finally {
        setIsLoadingStations(false);
      }
    }
    loadStations();
  }, []);

  useEffect(() => {
    const stationId = searchParams.get("station");
    const station = stations.find((item) => String(item.id) === String(stationId));
    if (!station) return;
    setSelectedStationId(station.id);
    setFilters({
      province: station.province || "",
      district: station.district || "",
      river_basin: station.river_basin || "",
      river: station.river_name || "",
      station: station.id,
    });
  }, [searchParams, stations]);

  useEffect(() => {
    let ignore = false;

    getPublicGeography()
      .then((data) => {
        if (!ignore) setGeography(data);
      })
      .catch(() => {
        // Keep station-derived filters available if geography cannot load.
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStationId) {
      setHistory([]);
      setIsLoadingHistory(false);
      return undefined;
    }

    let ignore = false;
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const data = await getStationHistory(selectedStationId, 48);
        if (!ignore) {
          setHistory(data.readings || []);
          setError("");
        }
      } catch (err) {
        if (!ignore) setError(err.response?.data?.detail || "Could not load station history.");
      } finally {
        if (!ignore) setIsLoadingHistory(false);
      }
    }
    loadHistory();
    const timer = window.setInterval(loadHistory, HISTORY_REFRESH_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [selectedStationId]);

  function changeFilter(field, value) {
    const resets = {
      province: { district: "", river_basin: "", river: "", station: "" },
      district: { river_basin: "", river: "", station: "" },
      river_basin: { river: "", station: "" },
      river: { station: "" },
    };
    const next = { ...filters, [field]: value, ...(resets[field] || {}) };
    setFilters(next);
    if (field !== "station") setSelectedStationId("");
    if (field === "station") {
      setSelectedStationId(value);
      setSearchParams(value ? { station: value } : {});
    }
  }

  const chartData = useMemo(() => {
    const labels = history.map((reading) => formatKathmanduDateTime(reading.timestamp, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }));
    const datasets = [{
      label: "Water level (m)",
      data: history.map((reading) => reading.water_level),
      borderColor: "#0EA5E9",
      backgroundColor: "rgba(14, 165, 233, 0.1)",
      borderWidth: 3,
      pointRadius: 4,
      pointBackgroundColor: "#0EA5E9",
      tension: 0.4,
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
  }, [history, selectedStation]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8 } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Water level (m)" } },
      x: { ticks: { maxTicksLimit: 12 } },
    },
  };

  return (
    <AdminLayout title="Water Level History">
      <section>
        <div className="mb-7">
          <h1 className="text-3xl font-black tracking-tight text-ink-primary">Water Level History</h1>
          <p className="mt-2 text-ink-secondary">Sensor telemetry history, separate from the public Nepal flood research page.</p>
        </div>

        <SensorFilters stations={stations} filters={filters} onChange={changeFilter} geography={geography} />
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {isLoadingStations ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading sensor stations...</div>
        ) : !selectedStationId ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
            <Activity className="mx-auto text-blue-300" size={36} />
            <h2 className="mt-3 text-xl font-black text-blue-950">Select a sensor station to view its water-level history.</h2>
            <p className="mt-2 text-slate-600">Use the Station filter above after narrowing the geography.</p>
          </div>
        ) : isLoadingHistory ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading station telemetry...</div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-black text-blue-950">No sensor readings are available for this station yet.</h2>
            <p className="mt-2 text-slate-600">The deployed cloud sensor pipeline has not recorded telemetry for this station yet.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black uppercase tracking-widest text-brand">{selectedStation?.station_code}</p><h2 className="text-xl font-black text-blue-950">{selectedStation?.station_name}</h2></div>
                <p className="text-sm text-slate-600">{selectedStation?.province} · {selectedStation?.district} · {selectedStation?.river_name}</p>
              </div>
              <div className="h-[420px] w-full"><Line data={chartData} options={options} /></div>
            </div>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm">
              <table className="min-w-[650px] w-full text-left text-sm">
                <thead className="bg-blue-50 text-xs uppercase tracking-wide text-blue-900"><tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Water level</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Freshness</th></tr></thead>
                <tbody className="divide-y divide-blue-50">{[...history].reverse().map((reading) => <tr key={reading.id + reading.timestamp}><td className="px-4 py-3 text-slate-600">{formatKathmanduDateTime(reading.timestamp)}</td><td className="px-4 py-3 font-bold text-blue-950">{Number(reading.water_level).toFixed(2)} m</td><td className="px-4 py-3 font-bold">{statusLabel(reading.status)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${freshnessClass(reading.freshness)}`}>{freshnessLabel(reading.freshness)}</span></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
