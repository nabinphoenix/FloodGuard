import { NavLink, Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, LayoutDashboard, FileText, AlertTriangle, Map, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getMe, logout } from "../../api/auth";

const TOKEN_KEY = "floodguard_token";

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      }
    }
    loadUser();
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const adminLinks = [
    { label: "Dashboard", to: "/admin", icon: <LayoutDashboard size={20} />, exact: true },
    { label: "Reports", to: "/admin/reports", icon: <FileText size={20} /> },
    { label: "Create Alert", to: "/admin/create-alert", icon: <AlertTriangle size={20} /> },
    { label: "Zones", to: "/admin/zones", icon: <Map size={20} /> },
    { label: "Users", to: "/admin/users", icon: <Users size={20} /> },
  ];

  const authorityLinks = [
    { label: "Sensor Dash", to: "/sensors", icon: <LayoutDashboard size={20} />, exact: true },
    { label: "Water Levels", to: "/sensors/chart", icon: <FileText size={20} /> },
  ];

  const links = user?.role === "authority" ? authorityLinks : adminLinks;

  return (
    <div className="flex min-h-screen bg-surface-bg text-ink-primary font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-brand to-brand-gradientEnd text-white shadow-xl hidden md:flex flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white group-hover:bg-white/30 transition-all duration-200">
              <ShieldCheck size={24} strokeWidth={2.5} />
            </span>
            <span className="text-xl font-bold tracking-tight">FloodGuard</span>
          </Link>
          <div className="mt-8 text-sm font-semibold text-white/70 uppercase tracking-wider">
            {title || "Admin Panel"}
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user?.name || "Admin"}</p>
              <p className="text-xs text-white/70 truncate">{user?.email || "admin@example.com"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden h-screen">
        {/* Mobile Header */}
        <div className="md:hidden bg-gradient-to-r from-brand to-brand-gradientEnd p-4 flex justify-between items-center text-white shadow-md flex-shrink-0">
          <span className="font-bold">{title || "Admin Panel"}</span>
          <Link to="/" className="text-white hover:text-white/80">
            <ShieldCheck size={24} />
          </Link>
        </div>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
