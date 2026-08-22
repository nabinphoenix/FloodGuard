import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDashboard } from "../../api/admin";
import SeverityBadge from "../../components/SeverityBadge";
import AdminLayout from "../../components/AdminLayout";
import { FileText, Map, Users } from "lucide-react";

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
    <AdminLayout title="Dashboard">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-ink-primary tracking-tight">Dashboard Overview</h2>
          <p className="mt-2 text-ink-secondary">Monitor users, zones, and system configuration.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/users"
            className="rounded-lg border-2 border-brand px-6 py-2.5 text-sm font-semibold text-brand hover:bg-brand/5 transition-colors"
          >
            Manage Users
          </Link>
          <Link
            to="/admin/zones"
            className="rounded-lg bg-gradient-to-r from-brand to-brand-gradientEnd px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
          >
            Manage Zones
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
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total Users" value={dashboard?.total_users ?? 0} icon={Users} colorClass="from-cyan-500 to-cyan-600" />
            <StatCard label="Total Zones" value={dashboard?.total_zones ?? 0} icon={Map} colorClass="from-blue-500 to-blue-600" />
            <StatCard label="Total Reports" value={dashboard?.total_reports ?? 0} icon={FileText} colorClass="from-purple-500 to-purple-600" />
          </div>


        </>
      )}
    </AdminLayout>
  );
}
