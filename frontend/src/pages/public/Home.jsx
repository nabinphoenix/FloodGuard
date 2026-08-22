import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getFloodSummary } from "../../api/history";
import { getAlertZones, getPublicStats } from "../../api/public";
import AlertBadge from "../../components/AlertBadge";
import CloudShader from "../../components/CloudShader";
import FloodFooter from "../../components/FloodFooter";
import HomeShowcase from "../../components/HomeShowcase";
import WaterfallRain from "../../components/WaterfallRain";

export default function Home() {
  const [zones, setZones] = useState([]);
  const [stats, setStats] = useState(null);
  const [historySummary, setHistorySummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [zoneData, statsData] = await Promise.all([
          getAlertZones(),
          getPublicStats(),
        ]);
        setZones(zoneData);
        setStats(statsData);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load FloodGuard data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, []);

  useEffect(() => {
    getFloodSummary().then(setHistorySummary).catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-surface-bg font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden text-white pt-20 pb-32">
        <CloudShader
          cloudColor="#eff6ff"
          skyTopColor="#2563eb"
          skyBottomColor="#075985"
        />
        <WaterfallRain
          showWaterfall={false}
          showSplash={false}
          showMist={false}
          showRain={true}
          rainCount={70}
        />

        {/* Background Decorative Circles */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl" style={{ zIndex: 1 }}></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-white opacity-10 rounded-full blur-2xl" style={{ zIndex: 1 }}></div>

        <div className="relative mx-auto max-w-7xl px-6 flex flex-col items-center text-center" style={{ zIndex: 2 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-sm font-semibold mb-8 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            Live Monitoring Active
          </div>
          
          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl">
            Real-time Flood Intelligence
          </h1>
          <p className="mt-6 max-w-2xl text-xl text-blue-100 font-medium">
            Protecting communities with live data, early warnings, and crowdsourced incident reports.
          </p>
          
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center w-full sm:w-auto">
            <Link
              to="/alerts"
              className="rounded-full bg-white px-8 py-4 text-center font-bold text-brand hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              View Alerts
            </Link>
            <Link
              to="/reports/submit"
              className="hero-liquid-button rounded-full border-2 border-white/80 px-8 py-4 text-center font-bold text-brand transition-all"
            >
              <span className="hero-liquid-button__label">Report Flood</span>
              <span className="hero-liquid-button__liquid" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Animated Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-10 transform translate-y-1">
          <svg className="relative block w-full h-[60px] md:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.15,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" className="fill-surface-bg"></path>
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-51.4V0Z" opacity=".5" className="fill-surface-bg"></path>
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" className="fill-surface-bg"></path>
          </svg>
        </div>
      </section>

      <HomeShowcase stats={stats} zones={zones} />

      {error && (
        <div className="mx-auto max-w-7xl px-6 mb-10">
          <div className="rounded-xl border border-flood-emergency/20 bg-flood-emergency/10 px-6 py-4 text-sm font-medium text-flood-emergency">
            {error}
          </div>
        </div>
      )}

      {/* Live Alert Zones */}
      {!isLoading && zones.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-ink-primary tracking-tight">Live Alert Zones</h2>
            <Link to="/alerts" className="text-sm font-bold text-brand hover:text-brand-gradientEnd transition-colors">
              View all zones &rarr;
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {zones.slice(0, 8).map((zone) => (
              <div key={zone.id} className="bg-white rounded-xl shadow-sm hover:shadow-md border border-ink-border p-5 transition-shadow flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h3 className="font-bold text-ink-primary text-lg truncate" title={zone.district}>{zone.district}</h3>
                  <AlertBadge level={zone.alert_level} />
                </div>
                <div className="text-xs text-ink-secondary font-medium">
                  Updated: {zone.updated_at ? new Date(zone.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recently'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {historySummary && (
        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 p-8 text-white shadow-lg">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-200"><BookOpen size={20} /><span className="text-sm font-bold uppercase tracking-wide">Flood History in Nepal</span></div>
                <h2 className="mt-3 text-3xl font-black">Documented flood impacts, 2011–2023</h2>
                <p className="mt-2 max-w-2xl text-blue-100">Explore historical flood incidents, impacts, affected regions and major river systems across Nepal. Historical figures are separate from live sensor data.</p>
              </div>
              <Link to="/history" className="shrink-0 rounded-full bg-white px-5 py-3 text-center font-bold text-blue-800 hover:bg-blue-50">Explore Flood History →</Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Flood incidents", historySummary.flood_incidents],
                ["Deaths", historySummary.deaths],
                ["Missing", historySummary.missing],
                ["Affected families", historySummary.affected_families],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/10 p-4">
                  <p className="text-2xl font-black">{new Intl.NumberFormat("en-NP").format(value)}</p>
                  <p className="mt-1 text-sm text-blue-100">{label}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-200">2011–2023 national series</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <FloodFooter />
    </main>
  );
}
