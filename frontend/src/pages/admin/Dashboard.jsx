import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDashboard } from "../../api/admin";

const navItems = [
  { label: "Dashboard", to: "/admin" },
  { label: "Reports", to: "/admin/reports" },
  { label: "Create Alert", to: "/admin/create-alert" },
  { label: "Zones", to: "/admin/zones" },
  { label: "Users", to: "/admin/users" },
];

function AdminShell({ children }) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-blue-100 bg-white px-5 py-6 lg:block">
          <h1 className="text-xl font-bold text-blue-900">FloodGuard Admin</h1>
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-800"
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
    <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-blue-900">{value}</p>
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
          <h2 className="text-2xl font-bold text-slate-950">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">Monitor reports, users, and active flood alerts.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/reports"
            className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
          >
            Go to Reports
          </Link>
          <Link
            to="/admin/create-alert"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Create Alert
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-blue-100 bg-white p-8 text-blue-800">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Reports" value={dashboard?.total_reports ?? 0} />
            <StatCard label="Pending Approval" value={dashboard?.pending_reports ?? 0} />
            <StatCard label="Active Alerts" value={dashboard?.active_alerts ?? 0} />
            <StatCard label="Total Users" value={dashboard?.total_users ?? 0} />
          </div>

          <section className="mt-8 rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-50 px-5 py-4">
              <h3 className="font-semibold text-slate-950">Recent Alerts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-50 text-sm">
                <thead className="bg-blue-50 text-left text-xs uppercase tracking-wide text-blue-900">
                  <tr>
                    <th className="px-5 py-3">District</th>
                    <th className="px-5 py-3">Level</th>
                    <th className="px-5 py-3">Message</th>
                    <th className="px-5 py-3">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {(dashboard?.recent_alerts || []).map((alert) => (
                    <tr key={alert.id}>
                      <td className="px-5 py-4 font-medium text-slate-900">{alert.district}</td>
                      <td className="px-5 py-4 capitalize text-blue-800">{alert.alert_level}</td>
                      <td className="max-w-xl px-5 py-4 text-slate-600">{alert.message}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(alert.triggered_at)}</td>
                    </tr>
                  ))}
                  {(dashboard?.recent_alerts || []).length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-500">
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
