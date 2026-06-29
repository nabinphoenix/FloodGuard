import { useEffect, useState } from "react";

import { getStations, updateThresholds } from "../../api/sensors";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function Thresholds() {
  const [stations, setStations] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    async function loadStations() {
      try {
        const data = await getStations();
        setStations(data);
        setDrafts(
          Object.fromEntries(
            data.map((station) => [
              station.id,
              {
                warning_threshold: station.warning_threshold,
                danger_threshold: station.danger_threshold,
              },
            ])
          )
        );
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load sensor stations.");
      } finally {
        setIsLoading(false);
      }
    }

    loadStations();
  }, []);

  function updateDraft(stationId, field, value) {
    setDrafts((current) => ({
      ...current,
      [stationId]: {
        ...current[stationId],
        [field]: value,
      },
    }));
    setMessage("");
  }

  async function handleSave(stationId) {
    setSavingId(stationId);
    setError("");
    setMessage("");

    try {
      const payload = {
        warning_threshold: Number(drafts[stationId].warning_threshold),
        danger_threshold: Number(drafts[stationId].danger_threshold),
      };
      const updated = await updateThresholds(stationId, payload);
      setStations((current) => current.map((station) => (station.id === stationId ? updated : station)));
      setMessage("Thresholds updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update thresholds.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950">Sensor Thresholds</h1>
          <p className="mt-2 text-sm text-blue-700">Adjust warning and danger water-level limits by station.</p>
        </div>

        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

        {isLoading ? (
          <LoadingSpinner message="Loading stations..." />
        ) : (
          <div className="grid gap-5">
            {stations.map((station) => (
              <article key={station.id} className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-blue-950">{station.name}</h2>
                    <p className="text-sm text-slate-500">{station.id} / {station.district}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${station.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                    {station.is_active ? "active" : "inactive"}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="block text-sm font-medium text-blue-950" htmlFor={`${station.id}-warning`}>Warning threshold (m)</label>
                    <input
                      id={`${station.id}-warning`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[station.id]?.warning_threshold ?? ""}
                      onChange={(event) => updateDraft(station.id, "warning_threshold", event.target.value)}
                      className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-950" htmlFor={`${station.id}-danger`}>Danger threshold (m)</label>
                    <input
                      id={`${station.id}-danger`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[station.id]?.danger_threshold ?? ""}
                      onChange={(event) => updateDraft(station.id, "danger_threshold", event.target.value)}
                      className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSave(station.id)}
                    disabled={savingId === station.id}
                    className="self-end rounded-md bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {savingId === station.id ? "Saving..." : "Save"}
                  </button>
                </div>
              </article>
            ))}
            {stations.length === 0 && (
              <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-blue-800">No stations found.</div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
