import { useEffect, useMemo, useState } from "react";
import { Filter, RefreshCw, MapPin } from "lucide-react";

import { getAlertZones } from "../../api/public";
import AlertBanner from "../../components/AlertBanner";
import LoadingSpinner from "../../components/LoadingSpinner";

function formatUpdated(value) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString();
}

function getLevelColor(level) {
  switch (level) {
    case 'safe': return 'border-green-500';
    case 'watch': return 'border-yellow-400';
    case 'warning': return 'border-orange-500';
    case 'emergency': return 'border-red-600';
    default: return 'border-gray-300';
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
      setTimeout(() => setSpinRefresh(false), 500);
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

  return (
    <main className="min-h-screen bg-surface-bg font-sans pb-16">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-brand to-brand-gradientEnd pt-12 pb-20 px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Active Alert Feed</h1>
          <p className="mt-3 text-lg text-blue-100 font-medium max-w-2xl">
            Real-time flood status across all monitored districts. Auto-refreshes every 60 seconds.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 -mt-10 relative z-10">
        {zones.some((zone) => zone.alert_level === "emergency") && (
          <div className="mb-6 shadow-lg rounded-xl overflow-hidden">
            <AlertBanner
              level="emergency"
              title="Emergency flood alert active"
              message="At least one monitored district is currently marked as emergency. Please follow authority instructions."
            />
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-md border border-ink-border p-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-ink-secondary w-full md:w-auto">
              <Filter size={18} />
              <span className="font-bold text-sm uppercase tracking-wider">Filters</span>
            </div>
            
            <div className="w-full md:w-64 relative">
              <select
                value={districtFilter}
                onChange={(event) => setDistrictFilter(event.target.value)}
                className="w-full rounded-lg border border-ink-border bg-surface-bg px-4 py-2.5 text-sm font-semibold text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 appearance-none"
              >
                <option value="">All Districts</option>
                {districts.map((district) => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ink-secondary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

            <div className="flex bg-surface-bg p-1 rounded-lg border border-ink-border w-full md:w-auto overflow-x-auto">
              {['', 'safe', 'watch', 'warning', 'emergency'].map(level => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-4 py-2 text-sm font-bold rounded-md capitalize transition-all flex-shrink-0 ${
                    levelFilter === level 
                      ? 'bg-white shadow-sm text-brand border border-gray-200' 
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  {level || 'All Levels'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
            <span className="text-xs font-semibold text-ink-secondary">
              Updated: {lastRefresh ? lastRefresh.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--"}
            </span>
            <button
              onClick={loadAlerts}
              className="flex items-center gap-2 rounded-lg bg-surface-bg border border-ink-border px-4 py-2 text-sm font-bold text-ink-primary hover:bg-gray-100 transition-colors shadow-sm"
            >
              <RefreshCw size={16} className={spinRefresh ? 'animate-spin text-brand' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-flood-emergency/20 bg-flood-emergency/10 px-6 py-4 text-sm font-medium text-flood-emergency">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
             <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent mb-4"></div>
             <p className="text-ink-secondary font-bold">Connecting to alert network...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredZones.map((zone) => (
              <article
                key={zone.id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 ${getLevelColor(zone.alert_level)} border-y border-r border-y-ink-border border-r-ink-border overflow-hidden flex flex-col h-full relative group`}
              >
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-black text-ink-primary leading-tight tracking-tight pr-2">{zone.district}</h2>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
                        zone.alert_level === 'safe' ? 'bg-green-100 text-green-700' :
                        zone.alert_level === 'watch' ? 'bg-yellow-100 text-yellow-700' :
                        zone.alert_level === 'warning' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {zone.alert_level}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-ink-secondary font-medium bg-surface-bg px-2.5 py-1.5 rounded-md border border-gray-100">
                      <MapPin size={14} className="text-brand/60" />
                      Map view
                    </div>
                    <p className="text-[11px] font-bold text-gray-400">
                      {formatUpdated(zone.updated_at)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
            {filteredZones.length === 0 && (
              <div className="rounded-xl border border-dashed border-ink-border bg-white p-12 text-center flex flex-col items-center justify-center md:col-span-2 lg:col-span-3 xl:col-span-4">
                <Filter size={40} className="text-gray-300 mb-4" />
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
