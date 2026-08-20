import { Menu, ShieldCheck, X, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";

import { getMe, logout } from "../api/auth";

const TOKEN_KEY = "floodguard_token";

function navClass({ isActive }) {
  return [
    "rounded-md px-3 py-2 text-sm font-semibold transition-all duration-200",
    isActive
      ? "bg-white/20 text-white"
      : "text-white/90 hover:text-white hover:underline hover:underline-offset-4 hover:decoration-2",
  ].join(" ");
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(null);
      return undefined;
    }

    async function loadUser() {
      try {
        const currentUser = await getMe();
        if (!ignore) {
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (!ignore) {
          setUser(null);
        }
      }
    }

    loadUser();

    return () => {
      ignore = true;
    };
  }, [location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    setIsOpen(false);
    setDropdownOpen(false);
    navigate("/");
  }

  // Do not show the top navbar on admin routes to use the Sidebar instead
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/sensors') || location.pathname.startsWith('/authority')) {
    return null;
  }

  const links = [
    { label: "Home", to: "/" },
    { label: "Alerts", to: "/alerts" },
    { label: "Map", to: "/map" },
    { label: "Report Flood", to: "/reports/submit" },
    { label: "Community", to: "/reports/community" },
  ];

  if (user?.role === "public") {
    links.push({ label: "Dashboard", to: "/dashboard" });
  }

  if (user?.role === "admin") {
    links.push({ label: "Admin Dashboard", to: "/admin" });
  }

  if (user?.role === "authority") {
    links.push({ label: "Authority Dashboard", to: "/authority" });
  }

  if (user?.role === "field_officer" || user?.role === "admin") {
    links.push({ label: "Sensor Dashboard", to: "/sensors" });
  }

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-brand to-brand-gradientEnd text-white shadow-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group" onClick={() => setIsOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white group-hover:bg-white/30 transition-all duration-200 shadow-sm">
            <ShieldCheck size={24} strokeWidth={2.5} />
          </span>
          <span className="text-2xl font-bold tracking-tight">FloodGuard</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-4 lg:flex relative">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all duration-200"
              >
                <span className="max-w-[150px] truncate">{user.name}</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full border border-white/80 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-all duration-200"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand hover:bg-blue-50 shadow-sm transition-all duration-200"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-white hover:bg-white/20 lg:hidden transition-colors"
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-t border-white/10 px-6 pb-6 pt-4 lg:hidden bg-gradient-to-b from-transparent to-black/10">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={navClass}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            {user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-white/70">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-white/80 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10 transition-all"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-blue-50 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
