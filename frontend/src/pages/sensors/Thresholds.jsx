import { useEffect, useMemo, useState } from "react";

import { getStations, updateThresholds } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import AdminPagination from "../../components/AdminPagination";
import LoadingSpinner from "../../components/LoadingSpinner";
import SensorFilters, { filterStations } from "../../components/SensorFilters";

const STATIONS_PAGE_SIZE = 5;

function validateThresholds(draft) {
  const watch = Number(draft.watch_threshold);
  const warning = Number(draft.warning_threshold);
  const danger = Number(draft.danger_threshold);
  if (![watch, warning, danger].every(Number.isFinite)) return "All thresholds must be valid numbers.";
  if (watch < 0) return "Watch threshold must be at least 0 m.";
  if (watch >= warning) return "Watch threshold must be less than warning threshold.";
  if (warning >= danger) return "Warning threshold must be less than emergency threshold.";
  return "";
}

export default function Thresholds() {
  const [stations, setStations] = useState([]);
  const [filters, setFilters] = useState({ province: "", district: "", river_basin: "", river: "", station: "" });
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function loadStations() {
      try {
        const data = await getStations();
        setStations(data);
        setDrafts(Object.fromEntries(data.map((station) => [
          station.id,
          {
            watch_threshold: station.watch_threshold,
            warning_threshold: station.warning_threshold,
            danger_threshold: station.danger_threshold,
          },
        ])));
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load sensor stations.");
      } finally {
        setIsLoading(false);
      }
    }
    loadStations();
  }, []);

  function handleFilterChange(field, value) {
    const resets = {
      province: { district: "", river_basin: "", river: "", station: "" },
      district: { river_basin: "", river: "", station: "" },
      river_basin: { river: "", station: "" },
      river: { station: "" },
    };
    setFilters((current) => ({ ...current, [field]: value, ...(resets[field] || {}) }));
  }

  function updateDraft(stationId, field, value) {
    setDrafts((current) => ({ ...current, [stationId]: { ...current[stationId], [field]: value } }));
    setError("");
    setMessage("");
  }

  async function handleSave(stationId) {
    const draft = drafts[stationId];
    const validationError = validateThresholds(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingId(stationId);
    setError("");
    setMessage("");
    try {
      const updated = await updateThresholds(stationId, {
        watch_threshold: Number(draft.watch_threshold),
        warning_threshold: Number(draft.warning_threshold),
        danger_threshold: Number(draft.danger_threshold),
      });
      setStations((current) => current.map((station) => station.id === stationId ? updated : station));
      setDrafts((current) => ({ ...current, [stationId]: {
        watch_threshold: updated.watch_threshold,
        warning_threshold: updated.warning_threshold,
        danger_threshold: updated.danger_threshold,
      }}));
      setMessage("Thresholds updated successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update thresholds.");
    } finally {
      setSavingId(null);
    }
  }

  const visibleStations = useMemo(() => filterStations(stations, filters), [stations, filters]);
  const totalPages = Math.max(1, Math.ceil(visibleStations.length / STATIONS_PAGE_SIZE));
  const paginatedStations = useMemo(
    () => visibleStations.slice((currentPage - 1) * STATIONS_PAGE_SIZE, currentPage * STATIONS_PAGE_SIZE),
    [visibleStations, currentPage],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <AdminLayout title="Sensor Thresholds">
      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-blue-950">Sensor Thresholds</h1>
          <p className="mt-2 text-sm text-blue-700">Operational settings for this monitoring station; configure them according to the monitoring site.</p>
        </div>

        <SensorFilters stations={stations} filters={filters} onChange={handleFilterChange} />
        {error && <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}
        {message && <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{message}</div>}

        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>Classification:</strong> SAFE &lt; Watch · WATCH from Watch to below Warning · WARNING from Warning to below Emergency · EMERGENCY at or above Emergency.
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading stations..." />
        ) : (
          <>
          <div className="grid gap-5">
            {paginatedStations.map((station) => {
              const draft = drafts[station.id] || {};
              return (
                <article key={station.id} className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-brand">{station.id}</p>
                      <h2 className="text-xl font-bold text-blue-950">{station.name}</h2>
                      <p className="text-sm text-slate-500">{station.province || "Province not configured"} · {station.district} · {station.river_name || "River not configured"}</p>
                    </div>
                    <span className={"rounded-full px-3 py-1 text-xs font-bold uppercase " + (station.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700")}>
                      {station.is_active ? "active" : "inactive"}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <div>
                      <label className="block text-sm font-medium text-blue-950" htmlFor={station.id + "-watch"}>Watch level (m)</label>
                      <input id={station.id + "-watch"} type="number" min="0" step="0.01" value={draft.watch_threshold ?? ""} onChange={(event) => updateDraft(station.id, "watch_threshold", event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-950" htmlFor={station.id + "-warning"}>Warning level (m)</label>
                      <input id={station.id + "-warning"} type="number" min="0" step="0.01" value={draft.warning_threshold ?? ""} onChange={(event) => updateDraft(station.id, "warning_threshold", event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-950" htmlFor={station.id + "-danger"}>Emergency level (m)</label>
                      <input id={station.id + "-danger"} type="number" min="0" step="0.01" value={draft.danger_threshold ?? ""} onChange={(event) => updateDraft(station.id, "danger_threshold", event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
                    </div>
                    <button type="button" onClick={() => handleSave(station.id)} disabled={savingId === station.id} className="self-end rounded-md bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">
                      {savingId === station.id ? "Saving..." : "Save"}
                    </button>
                  </div>
                </article>
              );
            })}
            {visibleStations.length === 0 && <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-blue-800">{stations.length ? "No stations match the selected geography." : "No sensor stations configured."}</div>}
          </div>
          <AdminPagination currentPage={currentPage} totalPages={totalPages} totalItems={visibleStations.length} pageSize={STATIONS_PAGE_SIZE} onPageChange={setCurrentPage} />
          </>
        )}
      </section>
    </AdminLayout>
  );
}
