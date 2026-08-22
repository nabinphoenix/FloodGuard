import {
  Bell,
  FileText,
  Map,
  MapPin,
  MessageSquare,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

const actions = [
  { title: "Flood Alerts", description: "View the latest flood warnings and safety alerts.", to: "/alerts", icon: Bell },
  { title: "Flood Map", description: "View flood zones and affected locations on the map.", to: "/map", icon: Map },
  { title: "Report Flood", description: "Submit a flood incident report from your area.", to: "/reports/submit", icon: TriangleAlert },
  { title: "My Reports", description: "Track the flood reports you have submitted.", to: "/reports/my", icon: FileText },
  { title: "Community", description: "View verified reports shared by the community.", to: "/reports/community", icon: MessageSquare },
  { title: "Profile & Alerts", description: "Manage your profile and notification preferences.", to: "/profile", icon: Settings },
];

export default function PublicDashboard() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 p-8 text-white shadow-lg">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-blue-100">
                <ShieldCheck size={20} />
                <span className="text-sm font-semibold">Public User Dashboard</span>
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">Welcome{user?.name ? `, ${user.name}` : ""}</h1>
              <p className="mt-2 max-w-2xl text-blue-100">Monitor flood information, submit incident reports, and manage alerts for your area.</p>
            </div>
            {user?.district && (
              <div className="flex items-center gap-3 rounded-xl bg-white/10 px-5 py-4 backdrop-blur-sm">
                <MapPin size={22} />
                <div>
                  <p className="text-xs text-blue-100">Your district</p>
                  <p className="font-semibold">{user.district}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Account</p>
            <p className="mt-1 font-semibold text-slate-900">Public User</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Email alerts</p>
            <p className="mt-1 font-semibold text-slate-900">
              {user?.email_alert_status === "confirmed" ? "Confirmed" : user?.email_alert_status === "pending" ? "Pending confirmation" : "Disabled"}
            </p>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-blue-950">Quick Actions</h2>
            <p className="mt-1 text-sm text-slate-600">Access the main FloodGuard services from your dashboard.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {actions.filter((action) => (
              user?.role === "public" || !["/reports/submit", "/reports/my"].includes(action.to)
            )).map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.to} to={action.to} className="group rounded-xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><Icon size={24} /></div>
                  <h3 className="mt-4 text-lg font-bold text-blue-950">{action.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
