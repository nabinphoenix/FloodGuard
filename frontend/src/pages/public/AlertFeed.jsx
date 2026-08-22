import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Filter, MapPin, RefreshCw } from "lucide-react";

import { getAlertZones } from "../../api/public";
import AlertBanner from "../../components/AlertBanner";
import { isWithinNepalOperationalBounds } from "../../components/map/mapUtils";

function formatUpdated(value) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const dateLabel = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return dateLabel + ", " + timeLabel;
}

function formatDistrictName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function mapHrefForZone(zone) {
  if (!isWithinNepalOperationalBounds(zone.latitude, zone.longitude)) return "";
  return zone.alert_id ? "/map?alert=" + zone.alert_id : "/map?zone=" + zone.id;
}

function getLevelColor(level) {
  switch (level) {
    case "safe":
      return "border-green-500";
    case "watch":
      return "border-yellow-400";
    case "warning":
      return "border-orange-500";
    case "emergency":
      return "border-red-600";
    default:
      return "border-gray-300";
  }
}

export default function AlertFeed() {
  const [zones, setZones] = useState([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [spinRefresh, setSpinRefresh] = useState(false);

  async function loadAlerts() {
    setSpinRefresh(true);

    try {
      const data = await getAlertZones();
      setZones(data);
      setLastRefresh(new Date());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load alert zones.");
    } finally {
      setIsLoading(false);
      window.setTimeout(() => setSpinRefresh(false), 500);
    }
  }

  useEffect(() => {
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const districts = useMemo(
    () => Array.from(new Set(zones.map((zone) => zone.district))).sort(),
    [zones]
  );

  const filteredZones = useMemo(() => {
    let result = zones;

    if (districtFilter) {
      result = result.filter((zone) => zone.district === districtFilter);
    }

    if (levelFilter) {
      result = result.filter((zone) => zone.alert_level === levelFilter);
    }

    return result;
  }, [zones, districtFilter, levelFilter]);

  const hasEmergency = zones.some((zone) => zone.alert_level === "emergency");

  return (
    <main className="min-h-screen bg-surface-bg pb-16 font-sans">
      <div className="bg-gradient-to-r from-brand to-brand-gradientEnd px-6 pb-14 pt-10 sm:pb-16 sm:pt-12">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Active Alert Feed</h1>
          <p className="mt-3 max-w-3xl text-lg font-medium text-blue-100">
            Real-time flood status across all monitored districts. Auto-refreshes every 60 seconds.
          </p>
        </div>
      </div>

        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Flood safety guide</p>
            <h2 className="mt-1 text-lg font-black text-blue-950">Know what to do during a flood</h2>
            <p className="mt-1 text-sm text-blue-900">Prepare early and keep life-safety guidance close at hand.</p>
          </div>
          <Link to="/safety" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-800">View Flood Safety Guide</Link>
        </div>

      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
        {hasEmergency && (
          <div className="mb-6">
            <AlertBanner
              level="emergency"
              title="Emergency flood alert active"
              message="At least one monitored district is currently marked as emergency. Please follow authority instructions."
            />
          </div>
        )}

        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-ink-border bg-white p-4 shadow-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-2 text-ink-secondary">
              <Filter size={18} aria-hidden="true" />
              <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
            </div>

            <div className="relative w-full shrink-0 sm:w-56">
              <select
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="w-full appearance-none rounded-lg border border-ink-border bg-surface-bg px-4 py-2.5 text-sm font-semibold text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">All Districts</option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {formatDistrictName(district)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ink-secondary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 overflow-x-auto rounded-lg border border-ink-border bg-surface-bg p-1">
              {["", "safe", "watch", "warning", "emergency"].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  className={
                    "flex-shrink-0 whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold capitalize transition-all " +
                    (levelFilter === level
                      ? "border border-gray-200 bg-white text-brand shadow-sm"
                      : "border border-transparent text-ink-secondary hover:bg-gray-100 hover:text-ink-primary")
                  }
                >
                  {level || "All Levels"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-between gap-4 lg:w-auto lg:justify-end">
            <span className="whitespace-nowrap text-xs font-semibold text-ink-secondary">
              Updated:{" "}
              {lastRefresh
                ? lastRefresh.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--"}
            </span>
            <button
              type="button"
              onClick={loadAlerts}
              disabled={spinRefresh}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-ink-border bg-surface-bg px-4 py-2 text-sm font-bold text-ink-primary shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw size={16} className={spinRefresh ? "animate-spin text-brand" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-flood-emergency/20 bg-flood-emergency/10 px-6 py-4 text-sm font-medium text-flood-emergency" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            <p className="font-bold text-ink-secondary">Connecting to alert network...</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredZones.map((zone) => (
              <article
                key={zone.id}
                className={
                  "group relative flex min-h-[190px] h-full flex-col overflow-hidden rounded-xl border-y border-r border-y-ink-border border-r-ink-border border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md " +
                  getLevelColor(zone.alert_level)
                }
              >
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex min-h-16 items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 break-words pr-1 text-xl font-black leading-tight tracking-tight text-ink-primary sm:text-2xl">
                      {zone.name || formatDistrictName(zone.district)}
                      <span className="mt-1 block text-xs font-semibold text-ink-secondary">{formatDistrictName(zone.district)}</span>
                    </h2>
                    <div
                      className={
                        "shrink-0 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest " +
                        (zone.alert_level === "safe"
                          ? "bg-green-100 text-green-700"
                          : zone.alert_level === "watch"
                            ? "bg-yellow-100 text-yellow-700"
                            : zone.alert_level === "warning"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700")
                      }
                    >
                      {zone.alert_level}
                    </div>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-8">
                    {mapHrefForZone(zone) ? (
                      <Link to={mapHrefForZone(zone)} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-brand/20 bg-brand/5 px-2.5 py-1.5 text-xs font-bold text-brand transition hover:border-brand/40 hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand/30" aria-label="View alert on map">
                        <MapPin size={14} aria-hidden="true" />
                        View Map
                      </Link>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-400">
                        <MapPin size={14} aria-hidden="true" />
                        Map location unavailable
                      </span>
                    )}
                    <p className="text-right text-[11px] font-bold leading-5 text-gray-400">
                      {formatUpdated(zone.updated_at)}
                    </p>
                  </div>
                </div>
              </article>
            ))}

            {filteredZones.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-border bg-white p-12 text-center md:col-span-2 lg:col-span-3 xl:col-span-4">
                <Filter size={40} className="mb-4 text-gray-300" aria-hidden="true" />
                <h3 className="text-xl font-bold text-ink-primary">No zones found</h3>
                <p className="mt-2 text-ink-secondary">Try adjusting your district or severity filters.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}