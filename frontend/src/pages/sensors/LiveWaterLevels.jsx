import { Activity, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getPublicGeography } from "../../api/public";
import { getLiveReadings } from "../../api/sensors";
import AdminLayout from "../../components/AdminLayout";
import AdminPagination from "../../components/AdminPagination";
import SensorFilters, { filterStations } from "../../components/SensorFilters";
import { formatReadingAge, freshnessClass, freshnessLabel, trendLabel } from "../../utils/sensorMonitoring";
import { formatKathmanduDateTime, formatKathmanduTime } from "../../utils/time";

export const LIVE_REFRESH_INTERVAL_MS = 10_000;
const STATIONS_PAGE_SIZE = 6;

function statusClass(status) {
  return {
    safe: "bg-green-100 text-green-800",
    watch: "bg-yellow-100 text-yellow-800",
    warning: "bg-orange-100 text-orange-800",
    emergency: "bg-red-100 text-red-800",
    no_data: "bg-slate-100 text-slate-700",
  }[status] || "bg-slate-100 text-slate-700";
}

function statusLabel(status) {
  return status === "no_data" ? "NO DATA" : String(status || "unknown").toUpperCase();
}

function Threshold({ label, value, color }) {
  return <div className={`rounded-lg p-3 text-sm ${color}`}><p className="text-xs font-bold uppercase">{label}</p><strong>{Number(value).toFixed(2)} m</strong></div>;
}

export default function LiveWaterLevels() {
  const [stations, setStations] = useState([]);
  const [geography, setGeography] = useState(null);
  const [filters, setFilters] = useState({ province: "", district: "", river_basin: "", river: "", station: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function load(manual = false) {
    if (manual) setIsRefreshing(true);
    try {
      setStations(await getLiveReadings());
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load live water levels.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, LIVE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    getPublicGeography().then((data) => {
      if (!ignore) setGeography(data);
    }).catch(() => {
      // Station-derived options remain available if geography cannot load.
    });
    return () => { ignore = true; };
  }, []);

  function changeFilter(field, value) {
    const resets = {
      province: { district: "", river_basin: "", river: "", station: "" },
      district: { river_basin: "", river: "", station: "" },
      river_basin: { river: "", station: "" },
      river: { station: "" },
    };
    setFilters((current) => ({ ...current, [field]: value, ...(resets[field] || {}) }));
  }

  const visibleStations = useMemo(() => filterStations(stations, filters), [stations, filters]);
  const totalPages = Math.max(1, Math.ceil(visibleStations.length / STATIONS_PAGE_SIZE));
  const paginatedStations = useMemo(
    () => visibleStations.slice((currentPage - 1) * STATIONS_PAGE_SIZE, currentPage * STATIONS_PAGE_SIZE),
    [visibleStations, currentPage],
  );
  const selectedStation = useMemo(
    () => stations.find((station) => String(station.id) === String(filters.station)),
    [filters.station, stations],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <AdminLayout title="Live Water Levels">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-primary">Live Water Levels</h1>
            <p className="mt-2 text-ink-secondary">Current RDS telemetry from active stations. Flood status and reading freshness are shown separately.</p>
            {lastUpdated && <p className="mt-1 text-xs text-ink-secondary">Last updated: {formatKathmanduTime(lastUpdated)}</p>}
          </div>
          <button type="button" onClick={() => load(true)} disabled={isRefreshing} className="flex items-center justify-center gap-2 rounded-lg border border-ink-border bg-white px-4 py-3 font-semibold shadow-sm hover:border-brand hover:text-brand disabled:opacity-60"><RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Refreshing..." : "Refresh"}</button>
        </div>

        <SensorFilters stations={stations} filters={filters} onChange={changeFilter} geography={geography} />
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {selectedStation && (
          <article className="mb-6 rounded-2xl border border-brand/20 bg-blue-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-black uppercase tracking-widest text-brand">{selectedStation.station_code}</p><h2 className="mt-1 text-xl font-black text-blue-950">{selectedStation.station_name}</h2><p className="mt-1 text-sm text-slate-600">{selectedStation.river_name} · {selectedStation.district}</p></div>
              <div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(selectedStation.status)}`}>{statusLabel(selectedStation.status)}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${freshnessClass(selectedStation.freshness)}`}>{freshnessLabel(selectedStation.freshness)}</span></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div><p className="text-xs font-bold uppercase text-slate-500">Current level</p><p className="mt-1 text-lg font-black text-blue-950">{selectedStation.latest_reading ? `${Number(selectedStation.latest_reading.water_level).toFixed(2)} m` : "--"}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Last reading</p><p className="mt-1 font-semibold text-slate-700">{formatReadingAge(selectedStation.latest_reading?.timestamp)}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Watch</p><p className="mt-1 font-semibold text-slate-700">{Number(selectedStation.watch_threshold).toFixed(2)} m</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Warning</p><p className="mt-1 font-semibold text-slate-700">{Number(selectedStation.warning_threshold).toFixed(2)} m</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Emergency</p><p className="mt-1 font-semibold text-slate-700">{Number(selectedStation.danger_threshold).toFixed(2)} m</p></div>
            </div>
          </article>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading live water levels...</div>
        ) : visibleStations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm"><Activity className="mx-auto text-blue-300" size={34} /><h2 className="mt-3 text-xl font-black text-blue-950">{stations.length ? "No stations match the selected filters." : "No sensor stations configured."}</h2><p className="mt-2 text-slate-600">{stations.length ? "Change the filters to view another active station." : "Create a monitoring station before sending telemetry."}</p></div>
        ) : (
          <>
          <div className="grid gap-5 lg:grid-cols-2">
            {paginatedStations.map((station) => {
              const reading = station.latest_reading;
              return (
                <article key={station.id} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-brand">{station.station_code}</p><h2 className="mt-1 text-2xl font-black text-blue-950">{station.station_name}</h2><p className="mt-1 text-sm text-slate-600">{station.river_name} · {station.district}</p><p className="mt-1 text-xs text-slate-500">{station.river_basin}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-black tracking-wide ${statusClass(station.status)}`}>{statusLabel(station.status)}</span></div>
                  <div className="mt-7 flex items-end gap-2"><span className="text-5xl font-black tracking-tight text-blue-950">{reading ? Number(reading.water_level).toFixed(2) : "--"}</span><span className="pb-1 text-xl font-bold text-slate-500">m</span></div>
                  <div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${freshnessClass(station.freshness)}`}>{freshnessLabel(station.freshness)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Trend: {trendLabel(station.trend)}</span></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3"><Threshold label="Watch" value={station.watch_threshold} color="bg-yellow-50 text-yellow-900" /><Threshold label="Warning" value={station.warning_threshold} color="bg-orange-50 text-orange-900" /><Threshold label="Emergency" value={station.danger_threshold} color="bg-red-50 text-red-900" /></div>
                  <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">{reading ? `Last reading ${formatReadingAge(reading.timestamp)} · ${formatKathmanduDateTime(reading.timestamp)}` : "Station configured. Waiting for its first sensor reading."}</p>
                </article>
              );
            })}
          </div>
          <AdminPagination currentPage={currentPage} totalPages={totalPages} totalItems={visibleStations.length} pageSize={STATIONS_PAGE_SIZE} onPageChange={setCurrentPage} />
          </>
        )}
      </section>
    </AdminLayout>
  );
}
