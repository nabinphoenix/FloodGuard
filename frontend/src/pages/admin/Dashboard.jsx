import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDashboard } from "../../api/admin";
import SeverityBadge from "../../components/SeverityBadge";

const navItems = [
  { label: "Dashboard", to: "/admin" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Create Alert", to: "/admin/create-alert" },
  { label: "Zones", to: "/admin/zones" },
  { label: "Users", to: "/admin/users" },
];

function AdminShell({ children }) {
  return (
    <main className="min-h-screen bg-surface-bg text-ink-primary">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-ink-border bg-surface-card px-5 py-6 lg:block">
          <h1 className="text-xl font-bold text-brand">FloodGuard Admin</h1>
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block rounded-md px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-brand/10 hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="flex-1 px-4 py-6 md:px-8">{children}</section>
      </div>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-ink-border bg-surface-card p-4 shadow-sm">
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
      <p className="mt-3 text-3xl font-bold text-brand">{value}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getDashboard();
        setDashboard(data);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load admin dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-primary">Dashboard</h2>
          <p className="mt-1 text-sm text-ink-secondary">Monitor reports, users, and active flood alerts.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/reports"
            className="rounded-md border border-ink-border bg-surface-card px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10"
          >
            Go to Reports
          </Link>
          <Link
            to="/admin/create-alert"
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
          >
            Create Alert
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-ink-border bg-surface-card p-8 text-brand shadow-sm">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Reports" value={dashboard?.total_reports ?? 0} />
            <StatCard label="Pending Approval" value={dashboard?.pending_reports ?? 0} />
            <StatCard label="Active Alerts" value={dashboard?.active_alerts ?? 0} />
            <StatCard label="Total Users" value={dashboard?.total_users ?? 0} />
          </div>

          <section className="mt-8 rounded-lg border border-ink-border bg-surface-card p-4 shadow-sm">
            <div className="border-b border-ink-border pb-4">
              <h3 className="font-semibold text-ink-primary">Recent Alerts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ink-border text-sm">
                <thead className="bg-surface-bg text-left text-xs uppercase tracking-wide text-brand">
                  <tr>
                    <th className="px-5 py-3">District</th>
                    <th className="px-5 py-3">Level</th>
                    <th className="px-5 py-3">Message</th>
                    <th className="px-5 py-3">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-border">
                  {(dashboard?.recent_alerts || []).map((alert) => (
                    <tr key={alert.id}>
                      <td className="px-5 py-4 font-medium text-ink-primary">{alert.district}</td>
                      <td className="px-5 py-4"><SeverityBadge level={alert.alert_level} /></td>
                      <td className="max-w-xl px-5 py-4 text-ink-secondary">{alert.message}</td>
                      <td className="px-5 py-4 text-ink-secondary">{formatDate(alert.triggered_at)}</td>
                    </tr>
                  ))}
                  {(dashboard?.recent_alerts || []).length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-ink-secondary">
                        No alerts broadcast yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
