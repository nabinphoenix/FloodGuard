import { ChevronDown, LogOut, Menu, ShieldCheck, UserCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

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
  const { user, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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
    signOut();
    setIsOpen(false);
    setDropdownOpen(false);
    navigate("/", { replace: true });
  }

  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/sensors") ||
    location.pathname.startsWith("/authority")
  ) {
    return null;
  }

  const links = [
    { label: "Home", to: "/" },
    { label: "Alerts", to: "/alerts" },
    { label: "Map", to: "/map" },
    { label: "Report Flood", to: "/reports/submit" },
    { label: "Community", to: "/reports/community" },
  ];

  if (user?.role === "public") links.push({ label: "Dashboard", to: "/dashboard" });
  if (user?.role === "admin") links.push({ label: "Admin Dashboard", to: "/admin" });
  if (user?.role === "authority") links.push({ label: "Authority Dashboard", to: "/authority" });
  if (user?.role === "field_officer" || user?.role === "admin") {
    links.push({ label: "Sensor Dashboard", to: "/sensors" });
  }

  function renderLinks() {
    return links.map((link) => (
      <NavLink key={link.to} to={link.to} className={navClass} onClick={() => setIsOpen(false)}>
        {link.label}
      </NavLink>
    ));
  }

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-brand to-brand-gradientEnd text-white shadow-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="group flex items-center gap-2" onClick={() => setIsOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm transition-all group-hover:bg-white/30">
            <ShieldCheck size={24} strokeWidth={2.5} />
          </span>
          <span className="text-2xl font-bold tracking-tight">FloodGuard</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">{renderLinks()}</div>

        <div className="relative hidden items-center gap-4 lg:flex" ref={dropdownRef}>
          {isLoading ? (
            <span className="text-sm text-white/80">Checking session...</span>
          ) : user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20"
                aria-expanded={dropdownOpen}
              >
                <span className="max-w-[150px] truncate">{user.name}</span>
                <ChevronDown size={16} className={dropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  {user.role === "public" && (
                    <Link to="/profile" onClick={() => setDropdownOpen(false)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50">
                      <UserCircle size={16} />
                      Profile & Alerts
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="rounded-full border border-white/80 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white/10">Login</Link>
              <Link to="/register" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand shadow-sm transition-all hover:bg-blue-50">Register</Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-white transition-colors hover:bg-white/20 lg:hidden"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-t border-white/10 bg-gradient-to-b from-transparent to-black/10 px-6 pb-6 pt-4 lg:hidden">
          <div className="flex flex-col gap-2">{renderLinks()}</div>
          <div className="mt-6 border-t border-white/10 pt-6">
            {isLoading ? (
              <p className="px-3 text-sm text-white/80">Checking session...</p>
            ) : user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 px-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 font-bold text-white">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-white/70">{user.email}</p>
                  </div>
                </div>
                {user.role === "public" && (
                  <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                    <UserCircle size={18} />
                    Profile & Alerts
                  </Link>
                )}
                <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Link to="/login" onClick={() => setIsOpen(false)} className="rounded-xl border border-white/80 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/10">Login</Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-blue-50">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
