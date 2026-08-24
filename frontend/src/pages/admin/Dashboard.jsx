import {
  ArrowRight,
  FileText,
  Map,
  MapPinned,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDashboard } from "../../api/admin";
import AdminLayout from "../../components/AdminLayout";

const metrics = [
  {
    key: "total_users",
    label: "Registered users",
    description: "Accounts with FloodGuard access",
    icon: Users,
    iconClass: "bg-blue-100 text-blue-700",
    accentClass: "bg-blue-500",
  },
  {
    key: "total_zones",
    label: "Flood zones",
    description: "Configured alert coverage areas",
    icon: MapPinned,
    iconClass: "bg-cyan-100 text-cyan-700",
    accentClass: "bg-cyan-500",
  },
  {
    key: "total_reports",
    label: "Incident reports",
    description: "Reports received across the platform",
    icon: FileText,
    iconClass: "bg-violet-100 text-violet-700",
    accentClass: "bg-violet-500",
  },
];

const managementActions = [
  {
    title: "Manage users",
    description: "Review accounts, roles, and access across FloodGuard.",
    to: "/admin/users",
    icon: UsersRound,
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    title: "Manage flood zones",
    description: "Maintain the alert zones used to protect communities.",
    to: "/admin/zones",
    icon: Map,
    iconClass: "bg-cyan-100 text-cyan-700",
  },
];

function MetricCard({ label, value, description, icon: Icon, iconClass, accentClass }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon size={24} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setDashboard(await getDashboard());
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load the admin dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <AdminLayout title="Admin Dashboard">
      <section className="space-y-8 pb-4">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-28 right-24 h-52 w-52 rounded-full border-[28px] border-white/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-blue-50">
                <ShieldCheck size={16} aria-hidden="true" />
                Control center
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Admin Dashboard</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
                Keep FloodGuard’s accounts, alert coverage, and incident data organised from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/users" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-white">
                <Users size={18} aria-hidden="true" />
                Manage users
              </Link>
              <Link to="/admin/zones" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-white">
                <Map size={18} aria-hidden="true" />
                Manage zones
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {["users", "zones", "reports"].map((metric) => (
              <div key={metric} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-5 w-32 rounded bg-slate-200" />
                <div className="mt-5 h-10 w-20 rounded bg-slate-200" />
                <div className="mt-5 h-4 w-48 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <section aria-labelledby="dashboard-overview">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Platform overview</p>
                  <h2 id="dashboard-overview" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Your FloodGuard snapshot</h2>
                </div>
                <p className="hidden text-sm text-slate-500 sm:block">Current platform totals</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => (
                  <MetricCard key={metric.key} {...metric} value={dashboard?.[metric.key] ?? 0} />
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Administration</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Manage FloodGuard</h2>
                  </div>
                  <p className="text-sm text-slate-500">Choose a workspace to continue.</p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {managementActions.map(({ title, description, to, icon: Icon, iconClass }) => (
                    <Link key={to} to={to} className="group rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-blue-600">
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>
                          <Icon size={22} aria-hidden="true" />
                        </div>
                        <ArrowRight className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" size={20} aria-hidden="true" />
                      </div>
                      <h3 className="mt-5 text-base font-bold text-slate-950">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                    </Link>
                  ))}
                </div>
              </div>

              <aside className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-5 sm:p-6" aria-label="Administration summary">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <ShieldCheck size={22} aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">Administration at a glance</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Use the workspaces above to keep access and flood-zone coverage accurate.</p>
                <dl className="mt-6 space-y-3 border-t border-blue-100 pt-5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600">User accounts</dt>
                    <dd className="font-black text-slate-950">{dashboard?.total_users ?? 0}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600">Alert zones</dt>
                    <dd className="font-black text-slate-950">{dashboard?.total_zones ?? 0}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-600">Reports received</dt>
                    <dd className="font-black text-slate-950">{dashboard?.total_reports ?? 0}</dd>
                  </div>
                </dl>
              </aside>
            </section>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
