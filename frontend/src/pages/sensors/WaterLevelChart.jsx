import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";

import { getStationHistory, getStations } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import { Activity } from "lucide-react";

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

export default function WaterLevelChart() {
  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selectedStation = useMemo(
    () => stations.find((station) => String(station.id) === String(selectedStationId)),
    [stations, selectedStationId]
  );

  useEffect(() => {
    async function loadStations() {
      try {
        const data = await getStations();
        setStations(data);
        if (data.length > 0) {
          setSelectedStationId(data[0].id);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load sensor stations.");
        setIsLoading(false);
      }
    }

    loadStations();
  }, []);

  useEffect(() => {
    if (!selectedStationId) {
      return undefined;
    }

    let ignore = false;

    async function loadHistory() {
      try {
        const data = await getStationHistory(selectedStationId, 48);
        if (!ignore) {
          setHistory(data.readings || []);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.detail || "Could not load station history.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();
    const timer = window.setInterval(loadHistory, 60000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [selectedStationId]);

  const chartData = useMemo(() => {
    const labels = history.map((reading) =>
      new Date(reading.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    const datasets = [
      {
        label: "Water level (m)",
        data: history.map((reading) => reading.water_level),
        borderColor: "#0EA5E9",
        backgroundColor: "rgba(14, 165, 233, 0.1)",
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: "#0EA5E9",
        tension: 0.4,
        fill: true,
      },
    ];

    if (selectedStation) {
      datasets.push(
        thresholdLine("Watch threshold", selectedStation.watch_threshold, "#EAB308", labels.length),
        thresholdLine("Warning threshold", selectedStation.warning_threshold, "#F97316", labels.length),
        thresholdLine("Emergency threshold", selectedStation.danger_threshold, "#EF4444", labels.length)
      );
    }

    return { labels, datasets };
  }, [history, selectedStation]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: {
            family: "Inter, sans-serif",
            weight: "600",
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: "Inter, sans-serif", size: 13 },
        bodyFont: { family: "Inter, sans-serif", size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
          drawBorder: false,
        },
        title: {
          display: true,
          text: "Water level (m)",
          font: { family: "Inter, sans-serif", weight: "600" }
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 12,
        }
      },
    },
  };

  return (
    <AdminLayout title="Water Level Chart">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Historical Water Levels</h1>
          <p className="mt-2 text-ink-secondary">
            View live station history with watch, warning, and emergency thresholds.
          </p>
        </div>
        <div className="relative md:w-72">
          <select
            value={selectedStationId}
            onChange={(event) => setSelectedStationId(event.target.value)}
            className="w-full rounded-lg border border-ink-border bg-white px-4 py-3 text-ink-primary font-medium outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm appearance-none"
          >
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} ({station.district})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ink-secondary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-ink-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity size={20} className="text-brand" />
          <h3 className="font-bold text-ink-primary text-lg">Station Telemetry</h3>
        </div>
        
        {isLoading ? (
          <div className="flex h-[500px] flex-col items-center justify-center gap-4">
             <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
             <p className="text-ink-secondary font-medium">Loading telemetry data...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-[500px] flex-col items-center justify-center text-ink-secondary bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <Activity size={32} className="text-gray-300 mb-2" />
            <p className="font-medium">No readings available for this station yet.</p>
          </div>
        ) : (
          <div className="h-[500px] w-full">
            <Line data={chartData} options={options} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
