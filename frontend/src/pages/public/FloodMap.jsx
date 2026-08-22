import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers3, MapPin, Radio, RefreshCw, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import FloodFooter from "../../components/FloodFooter";
import FloodGuardMap from "../../components/map/FloodGuardMap";
import Navbar from "../../components/Navbar";
import { getPublicMapOverview } from "../../api/publicMap";
import { normalizeStatus, statusLabel } from "../../components/map/mapUtils";

const EMPTY_MAP = { sensors: [], zones: [], alerts: [], reports: [] };

function StatusChip({ status }) {
  const normalized = normalizeStatus(status);
  const styles = {
    safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    watch: "bg-amber-50 text-amber-700 ring-amber-200",
    warning: "bg-orange-50 text-orange-700 ring-orange-200",
    emergency: "bg-red-50 text-red-700 ring-red-200",
    no_data: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${styles[normalized]}`}>{statusLabel(normalized)}</span>;
}

function LayerToggle({ label, checked, onChange, count }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand/40">
      <span className="flex items-center gap-2"><Layers3 size={15} className="text-slate-400" />{label}<span className="text-xs font-normal text-slate-400">({count})</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-brand" />
    </label>
  );
}

export default function FloodMap() {
  const [searchParams] = useSearchParams();
  const [mapData, setMapData] = useState(EMPTY_MAP);
  const [selected, setSelected] = useState(null);
  const [district, setDistrict] = useState("all");
  const [province, setProvince] = useState("all");
  const [basin, setBasin] = useState("all");
  const [status, setStatus] = useState("all");
  const [layers, setLayers] = useState({ sensors: true, zones: true, alerts: true, reports: true });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadMap = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const next = await getPublicMapOverview();
      setMapData({
        sensors: Array.isArray(next?.sensors) ? next.sensors : [],
        zones: Array.isArray(next?.zones) ? next.zones : [],
        alerts: Array.isArray(next?.alerts) ? next.alerts : [],
        reports: Array.isArray(next?.reports) ? next.reports : [],
      });
      setError("");
    } catch (loadError) {
      setError(loadError?.response?.data?.detail || "The public map data could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMap();
    const interval = window.setInterval(() => loadMap(), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const options = useMemo(() => {
    const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      districts: unique(mapData.sensors.map((item) => item.district)),
      provinces: unique(mapData.sensors.map((item) => item.province)),
      basins: unique(mapData.sensors.map((item) => item.river_basin)),
    };
  }, [mapData.sensors]);

  const filteredSensors = useMemo(
    () => mapData.sensors.filter((item) => (
      (district === "all" || item.district === district) &&
      (province === "all" || item.province === province) &&
      (basin === "all" || item.river_basin === basin) &&
      (status === "all" || normalizeStatus(item.status) === status)
    )),
    [basin, district, mapData.sensors, province, status],
  );

  const filteredZones = useMemo(
    () => mapData.zones.filter((item) => district === "all" || item.district === district),
    [district, mapData.zones],
  );
  const filteredAlerts = useMemo(
    () => mapData.alerts.filter((item) => district === "all" || item.district === district),
    [district, mapData.alerts],
  );
  const filteredReports = useMemo(
    () => mapData.reports.filter((item) => district === "all" || item.district === district),
    [district, mapData.reports],
  );

  useEffect(() => {
    const requestedStation = searchParams.get("station");
    if (!requestedStation || !mapData.sensors.length) return;
    const station = mapData.sensors.find((item) => (item.station_code || item.id) === requestedStation);
    if (station) setSelected({ type: "station", item: station });
  }, [mapData.sensors, searchParams]);

  const focusPosition = selected?.item
    ? [selected.item.latitude ?? selected.item.lat, selected.item.longitude ?? selected.item.lng]
    : null;

  const clearFilters = () => {
    setDistrict("all");
    setProvince("all");
    setBasin("all");
    setStatus("all");
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand">Live flood intelligence</p>
            <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">FloodGuard map</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">Explore active flood zones, public sensor readings, community reports and alerts across Nepal.</p>
          </div>
          <button type="button" onClick={() => loadMap(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-gradientEnd disabled:opacity-60">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing?" : "Refresh map"}
          </button>
        </div>

        {error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Sensors", mapData.sensors.length, Radio],
            ["Active zones", mapData.zones.filter((item) => normalizeStatus(item.alert_level) !== "safe").length, ShieldCheck],
            ["Active alerts", mapData.alerts.length, AlertTriangle],
            ["Reports on map", mapData.reports.length, MapPin],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><Icon size={17} className="text-brand" /></div>
              <p className="mt-2 text-2xl font-black text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-black text-ink">Filters</h2>
                <button type="button" onClick={clearFilters} className="text-xs font-bold text-brand hover:underline">Clear</button>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Province<select value={province} onChange={(event) => setProvince(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><option value="all">All provinces</option>{options.provinces.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">District<select value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><option value="all">All districts</option>{options.districts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">River basin<select value={basin} onChange={(event) => setBasin(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><option value="all">All river basins</option>{options.basins.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Sensor status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"><option value="all">All statuses</option>{["safe", "watch", "warning", "emergency", "no_data"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-black text-ink">Layers</h2>
              <div className="space-y-2">
                <LayerToggle label="Sensor stations" count={filteredSensors.length} checked={layers.sensors} onChange={() => setLayers((current) => ({ ...current, sensors: !current.sensors }))} />
                <LayerToggle label="Alert zones" count={filteredZones.length} checked={layers.zones} onChange={() => setLayers((current) => ({ ...current, zones: !current.zones }))} />
                <LayerToggle label="Active alerts" count={filteredAlerts.length} checked={layers.alerts} onChange={() => setLayers((current) => ({ ...current, alerts: !current.alerts }))} />
                <LayerToggle label="Community reports" count={filteredReports.length} checked={layers.reports} onChange={() => setLayers((current) => ({ ...current, reports: !current.reports }))} />
              </div>
            </section>

            <section className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
              <p className="text-sm font-bold text-brand">Need to report flooding?</p>
              <p className="mt-1 text-xs leading-5 text-ink-secondary">Submit a verified community report and optionally pin its location on the map.</p>
              <a href="/reports/submit" className="mt-3 inline-flex text-sm font-black text-brand hover:underline">Submit report ?</a>
            </section>
          </aside>

          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-secondary">{loading ? "Loading live map data?" : `${filteredSensors.length} sensors ? ${filteredZones.length} zones ? ${filteredReports.length} reports`}</p>
              <p className="text-xs text-slate-500">Auto-refreshes every 60 seconds</p>
            </div>
            <FloodGuardMap
              stations={layers.sensors ? filteredSensors : []}
              zones={layers.zones ? filteredZones : []}
              alerts={layers.alerts ? filteredAlerts : []}
              reports={layers.reports ? filteredReports : []}
              focusPosition={focusPosition}
              onSelect={setSelected}
              className="h-[620px] lg:h-[680px]"
            />
            {!loading && !mapData.sensors.length && !mapData.zones.length && !mapData.reports.length ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No public map data is available yet.</div>
            ) : null}
          </section>
        </div>

        {selected ? (
          <section className="mt-5 rounded-2xl border border-brand/20 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand">Selected {selected.type}</p>
                <h2 className="mt-1 text-xl font-black text-ink">{selected.item.name || selected.item.district || `Report #${selected.item.id}`}</h2>
                {selected.type === "station" ? <div className="mt-2 flex flex-wrap items-center gap-2"><StatusChip status={selected.item.status} /><span className="text-sm text-ink-secondary">Water level: {selected.item.latest_water_level ?? "No data"}</span></div> : null}
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-slate-500 hover:text-ink">Close</button>
            </div>
          </section>
        ) : null}
      </main>
      <FloodFooter />
    </div>
  );
}
