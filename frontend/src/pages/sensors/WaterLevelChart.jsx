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
    () => stations.find((station) => station.id === selectedStationId),
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
        borderColor: "#1d4ed8",
        backgroundColor: "#bfdbfe",
        borderWidth: 3,
        pointRadius: 3,
        tension: 0.35,
      },
    ];

    if (selectedStation) {
      datasets.push(
        thresholdLine("Warning threshold", selectedStation.warning_threshold, "#eab308", labels.length),
        thresholdLine("Danger threshold", selectedStation.danger_threshold, "#dc2626", labels.length)
      );
    }

    return { labels, datasets };
  }, [history, selectedStation]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Water level (m)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Time",
        },
      },
    },
  };

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-950">Water Level Chart</h1>
            <p className="mt-2 text-sm text-blue-700">
              View the latest 48 readings with warning and danger thresholds.
            </p>
          </div>
          <select
            value={selectedStationId}
            onChange={(event) => setSelectedStationId(event.target.value)}
            className="rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100">
          {isLoading ? (
            <div className="flex h-[420px] items-center justify-center text-blue-800">
              Loading chart...
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center text-slate-500">
              No readings available for this station yet.
            </div>
          ) : (
            <div className="h-[420px]">
              <Line data={chartData} options={options} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
