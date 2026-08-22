import { Eye, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { VIEW_MODE_LABELS } from "../utils/roles";
import ViewAsSwitcher from "./ViewAsSwitcher";

export default function AdminViewBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, viewAs, setViewAs } = useAuth();

  const isOperationalLayout = ["/admin", "/authority", "/sensors"].some((path) => location.pathname.startsWith(path));
  if (user?.role !== "admin" || viewAs === "admin" || isOperationalLayout) return null;

  function returnToAdmin() {
    setViewAs("admin");
    navigate("/admin");
  }

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-blue-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white"><Eye size={16} /></span>
          <span><strong>Viewing as {VIEW_MODE_LABELS[viewAs] || "Citizen"}</strong><span className="ml-2 hidden text-blue-700 sm:inline">Admin privileges remain active</span></span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-200"><ShieldCheck size={12} /> Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <ViewAsSwitcher value={viewAs} />
          <button type="button" onClick={returnToAdmin} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-800">Return to Admin</button>
        </div>
      </div>
    </div>
  );
}
