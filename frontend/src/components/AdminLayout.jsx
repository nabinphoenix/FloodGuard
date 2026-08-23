import {
  AlertTriangle,

  Activity,


  FileText,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import floodGuardLogo from "../FloodGuard.png";
import LoadingSpinner from "./LoadingSpinner";
import ViewAsSwitcher from "./ViewAsSwitcher";
import { VIEW_MODE_LABELS } from "../utils/roles";

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
  ],
  authority: [
    { label: "Dashboard", to: "/authority", icon: <LayoutDashboard size={20} />, end: true },
    { label: "Reports", to: "/authority/reports", icon: <FileText size={20} /> },
    { label: "Create Alert", to: "/authority/create-alert", icon: <AlertTriangle size={20} /> },
  ],
  field_officer: [
    { label: "Dashboard", to: "/sensors", icon: <LayoutDashboard size={20} />, end: true },

    { label: "Sensor Reader", to: "/sensors/reader", icon: <Activity size={20} /> },
    { label: "Sensor Stations", to: "/sensors/stations", icon: <Settings2 size={20} /> },
    { label: "Live Water Levels", to: "/sensors/live", icon: <FileText size={20} /> },
    { label: "Water Level History", to: "/sensors/history", icon: <FileText size={20} /> },


    { label: "Thresholds", to: "/sensors/thresholds", icon: <Settings2 size={20} /> },
  ],
};

const titlesByRole = {
  admin: "Admin Panel",
  authority: "Authority Console",
  field_officer: "Sensor Operations",
};

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, signOut, viewAs } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  if (isLoading) {
    return <LoadingSpinner message="Loading account..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const routeView = location.pathname.startsWith("/authority")
    ? "authority"
    : location.pathname.startsWith("/sensors")
      ? "field_officer"
      : location.pathname.startsWith("/admin")
        ? "admin"
        : null;
  const activeView = user.role === "admin" ? (routeView || viewAs || "admin") : user.role;
  const activeRole = activeView === "citizen" ? "public" : activeView;
  const links = linksByRole[activeRole] || linksByRole[user.role] || [];
  const panelTitle = title || titlesByRole[activeRole] || "FloodGuard";
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
            <img
              src={floodGuardLogo}
              alt="FloodGuard logo"
              className="h-10 w-10 rounded-xl object-contain shadow-sm transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold tracking-tight">FloodGuard</span>
          </Link>
          <div className="mt-8 text-sm font-semibold uppercase tracking-wider text-white/70">
            {panelTitle}
            {user.role === "admin" && activeView !== "admin" && (
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                Admin preview - {VIEW_MODE_LABELS[activeView]}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-2 px-4" aria-label="Dashboard navigation">
          {renderLinks()}
        </nav>

        <div className="border-t border-white/10 p-4">
          {user.role === "admin" && (
            <div className="mb-4 px-2">
              <ViewAsSwitcher value={activeView} />
            </div>
          )}
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

      <main className="flex min-h-screen flex-1 flex-col overflow-hidden md:h-screen">
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
            <Link to="/" className="flex items-center gap-2 font-bold" aria-label="FloodGuard home" onClick={() => setMenuOpen(false)}>
              <img src={floodGuardLogo} alt="FloodGuard logo" className="h-8 w-8 rounded-lg object-contain shadow-sm" />
              <span>FloodGuard</span>
            </Link>
          </div>
          <span className="max-w-[42vw] truncate text-sm font-semibold text-white/80">{panelTitle}</span>
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/45 md:hidden" onClick={() => setMenuOpen(false)}>
            <aside className="flex h-[100dvh] w-[min(20rem,86vw)] flex-col overflow-y-auto bg-gradient-to-b from-brand to-brand-gradientEnd p-4 text-white shadow-2xl" aria-label="Dashboard navigation" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <span className="font-bold">{panelTitle}</span>
                <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-2 hover:bg-white/20" aria-label="Close navigation menu"><X size={22} /></button>
              </div>
              <nav className="space-y-2" aria-label="Mobile dashboard navigation">
                {renderLinks()}
              </nav>
              <div className="mt-auto border-t border-white/20 pt-4">
                {user.role === "admin" && (
                  <div className="mb-4">
                    <ViewAsSwitcher value={activeView} />
                  </div>
                )}
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
            </aside>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
