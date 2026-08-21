import {
  AlertTriangle,
  FileText,
  House,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

function linkClass({ isActive }) {
  return `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? "bg-white/20 text-white shadow-sm"
      : "text-white/80 hover:bg-white/10 hover:text-white"
  }`;
}

const linksByRole = {
  admin: [
    { label: "Dashboard", to: "/admin", icon: <LayoutDashboard size={20} />, end: true },
    { label: "Zones", to: "/admin/zones", icon: <Map size={20} /> },
    { label: "Users", to: "/admin/users", icon: <Users size={20} /> },
    { label: "Home", to: "/", icon: <House size={20} />, end: true },
  ],
  authority: [
    { label: "Dashboard", to: "/authority", icon: <LayoutDashboard size={20} />, end: true },
    { label: "Reports", to: "/authority/reports", icon: <FileText size={20} /> },
    { label: "Create Alert", to: "/authority/create-alert", icon: <AlertTriangle size={20} /> },
    { label: "Home", to: "/", icon: <House size={20} />, end: true },
  ],
  field_officer: [
    { label: "Dashboard", to: "/sensors", icon: <LayoutDashboard size={20} />, end: true },
    { label: "Water Levels", to: "/sensors/chart", icon: <FileText size={20} /> },
    { label: "Thresholds", to: "/sensors/thresholds", icon: <Settings2 size={20} /> },
    { label: "System Health", to: "/sensors/health", icon: <ShieldCheck size={20} /> },
    { label: "Home", to: "/", icon: <House size={20} />, end: true },
  ],
};

const titlesByRole = {
  admin: "Admin Panel",
  authority: "Authority Console",
  field_officer: "Sensor Operations",
};

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const { user, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return <LoadingSpinner message="Loading account..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const links = linksByRole[user.role] || [];
  const panelTitle = title || titlesByRole[user.role] || "FloodGuard";
  const initial = user.name?.charAt(0).toUpperCase();

  function handleLogout() {
    signOut();
    setMenuOpen(false);
    navigate("/", { replace: true });
  }

  function renderLinks() {
    return links.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        onClick={() => setMenuOpen(false)}
        className={linkClass}
      >
        {link.icon}
        {link.label}
      </NavLink>
    ));
  }

  return (
    <div className="flex min-h-screen bg-surface-bg font-sans text-ink-primary">
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-gradient-to-b from-brand to-brand-gradientEnd text-white shadow-xl md:flex">
        <div className="p-6">
          <Link to="/" className="group flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white transition-all group-hover:bg-white/30">
              <ShieldCheck size={24} strokeWidth={2.5} />
            </span>
            <span className="text-xl font-bold tracking-tight">FloodGuard</span>
          </Link>
          <div className="mt-8 text-sm font-semibold uppercase tracking-wider text-white/70">
            {panelTitle}
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4" aria-label="Dashboard navigation">
          {renderLinks()}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold text-white">
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-white/70">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/10"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between bg-gradient-to-r from-brand to-brand-gradientEnd p-4 text-white shadow-md md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-lg p-2 hover:bg-white/20"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="font-bold">{panelTitle}</span>
          </div>
          <Link to="/" aria-label="FloodGuard home" onClick={() => setMenuOpen(false)}>
            <ShieldCheck size={24} />
          </Link>
        </div>

        {menuOpen && (
          <div className="border-b border-blue-100 bg-gradient-to-b from-brand to-brand-gradientEnd p-4 text-white md:hidden">
            <nav className="space-y-2" aria-label="Mobile dashboard navigation">
              {renderLinks()}
            </nav>
            <div className="mt-3 border-t border-white/20 pt-3">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-white/70">{user.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
