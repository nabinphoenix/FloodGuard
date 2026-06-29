import { Activity, BellRing, FileWarning } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getAlertZones, getPublicStats } from "../../api/public";
import { getCommunityReports } from "../../api/reports";
import AlertBadge from "../../components/AlertBadge";
import LoadingSpinner from "../../components/LoadingSpinner";

const featureCards = [
  {
    title: "Report Floods",
    description: "Submit field reports with photos, location, severity, and context for admin review.",
    icon: FileWarning,
  },
  {
    title: "Get Alerts",
    description: "Track zone-level flood status and receive timely warnings from official broadcasts.",
    icon: BellRing,
  },
  {
    title: "Live Monitoring",
    description: "Monitor river sensor readings and threshold changes across active stations.",
    icon: Activity,
  },
];

const severityRank = {
  emergency: 4,
  warning: 3,
  watch: 2,
  safe: 1,
};

function timeAgo(dateString) {
  if (!dateString) return "recently";
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Home() {
  const [zones, setZones] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [zoneData, reportData, statsData] = await Promise.all([
          getAlertZones(),
          getCommunityReports({ page: 1, limit: 3 }),
          getPublicStats(),
        ]);
        setZones(zoneData);
        setReports(reportData);
        setStats(statsData);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load FloodGuard data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, []);

  const highestAlert = useMemo(() => {
    if (zones.length === 0) return "safe";
    return zones.reduce((highest, zone) =>
      severityRank[zone.alert_level] > severityRank[highest] ? zone.alert_level : highest
    , "safe");
  }, [zones]);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-[#0A2342] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <AlertBadge level={highestAlert} />
            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              Real-time Flood Intelligence
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
              FloodGuard combines public incident reports, alert zones, and river sensor monitoring
              to help communities act before flooding becomes critical.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/alerts"
                className="rounded-md bg-white px-5 py-3 text-center font-semibold text-[#0A2342] hover:bg-blue-50"
              >
                View Alerts
              </Link>
              <Link
                to="/reports/submit"
                className="rounded-md border border-white/40 px-5 py-3 text-center font-semibold text-white hover:bg-white/10"
              >
                Report Flood
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
              Network Overview
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-3xl font-bold">{stats?.total_zones ?? zones.length}</p>
                <p className="mt-1 text-sm text-blue-100">Zones</p>
              </div>
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-3xl font-bold">{stats?.active_alerts ?? 0}</p>
                <p className="mt-1 text-sm text-blue-100">Active Alerts</p>
              </div>
              <div className="rounded-md bg-white/10 p-4">
                <p className="text-3xl font-bold">{stats?.total_reports ?? 0}</p>
                <p className="mt-1 text-sm text-blue-100">Reports</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {zones.slice(0, 4).map((zone) => (
                <div key={zone.id} className="flex items-center justify-between rounded-md bg-white p-3 text-slate-900">
                  <span className="font-semibold">{zone.district}</span>
                  <AlertBadge level={zone.alert_level} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-4 md:px-6">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex min-w-[220px] items-center justify-between rounded-md border border-blue-100 px-4 py-3"
            >
              <span className="text-sm font-semibold text-slate-800">{zone.district}</span>
              <AlertBadge level={zone.alert_level} />
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="mx-auto mt-8 max-w-7xl px-4 md:px-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner message="Loading FloodGuard overview..." />
      ) : (
        <>
          <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <div className="grid gap-6 md:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 text-[#0A2342]">
                      <Icon size={24} />
                    </div>
                    <h2 className="mt-5 text-xl font-bold text-slate-950">{feature.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-14 md:px-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-950">Latest Community Reports</h2>
              <Link to="/reports/community" className="text-sm font-semibold text-blue-800 hover:text-blue-950">
                View all
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {reports.map((report) => (
                <article key={report.id} className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
                  {report.image_url ? (
                    <img src={report.image_url} alt={report.district} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-blue-50 text-sm font-semibold text-blue-700">
                      No photo provided
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {report.district}
                      </span>
                      <span className="text-xs text-slate-500">{timeAgo(report.created_at)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {report.description.length > 120
                        ? `${report.description.slice(0, 120)}...`
                        : report.description}
                    </p>
                  </div>
                </article>
              ))}
              {reports.length === 0 && (
                <div className="rounded-lg border border-blue-100 bg-white p-8 text-center text-slate-500 md:col-span-3">
                  No approved community reports yet.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
