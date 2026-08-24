import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAuthorityDashboard } from "../../api/authority";
import SeverityBadge from "../../components/SeverityBadge";
import AdminLayout from "../../components/AdminLayout";
import { FileText, AlertTriangle, Activity, Users } from "lucide-react";
import { formatKathmanduDateTime } from "../../utils/time";

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className={`rounded-xl border border-white/20 p-6 shadow-lg bg-gradient-to-br ${colorClass} text-white`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-white/80">{label}</p>
          <p className="mt-2 text-4xl font-bold">{value}</p>
        </div>
        <div className="p-3 bg-white/20 rounded-lg">
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return formatKathmanduDateTime(value);
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getAuthorityDashboard();
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
    <AdminLayout title="Authority Dashboard">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink-primary">Authority Dashboard</h1>
          <p className="mt-2 text-ink-secondary">Monitor reports, users, and active flood alerts.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/authority/reports"
            className="rounded-lg border-2 border-brand px-6 py-2.5 text-sm font-semibold text-brand hover:bg-brand/5 transition-colors"
          >
            Go to Reports
          </Link>
          <Link
            to="/authority/create-alert"
            className="rounded-lg bg-gradient-to-r from-brand to-brand-gradientEnd px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
          >
            Create Alert
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-ink-border bg-surface-card p-12 text-center shadow-sm">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-1/4 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-2">
            <StatCard label="Pending Approval" value={dashboard?.pending_reports ?? 0} icon={Activity} colorClass="from-orange-400 to-orange-500" />
            <StatCard label="Active Alerts" value={dashboard?.active_alerts ?? 0} icon={AlertTriangle} colorClass="from-red-500 to-red-600" />
          </div>

          <section className="mt-10 min-w-0 rounded-xl border border-ink-border bg-surface-card shadow-sm overflow-hidden">
            <div className="border-b border-ink-border px-6 py-5 bg-gray-50/50">
              <h3 className="text-lg font-bold text-ink-primary">Recent Alerts</h3>
            </div>
            <div className="min-w-0 overflow-x-auto">
              <table className="min-w-[720px] w-full divide-y divide-ink-border text-sm">
                <thead className="bg-surface-bg text-left text-xs uppercase tracking-wider text-ink-secondary font-semibold">
                  <tr>
                    <th className="px-6 py-4">District</th>
                    <th className="px-6 py-4">Level</th>
                    <th className="px-6 py-4">Message</th>
                    <th className="px-6 py-4">Triggered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-border bg-white">
                  {(dashboard?.recent_alerts || []).map((alert) => (
                    <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-ink-primary whitespace-nowrap">{alert.district}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><SeverityBadge level={alert.alert_level} /></td>
                      <td className="max-w-md px-6 py-4 text-ink-secondary truncate">{alert.message}</td>
                      <td className="px-6 py-4 text-ink-secondary whitespace-nowrap">{formatDate(alert.triggered_at)}</td>
                    </tr>
                  ))}
                  {(dashboard?.recent_alerts || []).length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-ink-secondary">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <AlertTriangle size={32} className="text-gray-300" />
                          <p>No alerts broadcast yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  );
}
