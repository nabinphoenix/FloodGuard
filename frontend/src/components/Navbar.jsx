import { Menu, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { getMe, logout } from "../api/auth";

const TOKEN_KEY = "floodguard_token";

function navClass({ isActive }) {
  return [
    "rounded-md px-3 py-2 text-sm font-semibold transition",
    isActive ? "bg-white text-[#0A2342]" : "text-white/85 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export default function Navbar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

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
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    setIsOpen(false);
    navigate("/");
  }

  const links = [
    { label: "Home", to: "/" },
    { label: "Alerts", to: "/alerts" },
    { label: "Map", to: "/map" },
    { label: "Report Flood", to: "/reports/submit" },
    { label: "Community", to: "/reports/community" },
  ];

  if (user?.role === "admin") {
    links.push({ label: "Admin", to: "/admin" });
  }

  if (user?.role === "authority") {
    links.push({ label: "Sensor Dashboard", to: "/sensors" });
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0A2342] text-white shadow-lg shadow-blue-950/20">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-[#0A2342]">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </span>
          <span className="text-xl font-bold tracking-wide">FloodGuard</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <span className="max-w-[180px] truncate text-sm font-semibold text-white/90">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#0A2342] hover:bg-blue-50"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-white hover:bg-white/10 lg:hidden"
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isOpen && (
        <div className="border-t border-white/10 px-4 pb-4 lg:hidden">
          <div className="flex flex-col gap-1">
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

          <div className="mt-4 border-t border-white/10 pt-4">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold">{user.name}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-white/30 px-4 py-2 text-center text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-[#0A2342]"
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
