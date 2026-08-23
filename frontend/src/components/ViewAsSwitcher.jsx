import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { VIEW_MODES, VIEW_MODE_LABELS, viewModePath } from "../utils/roles";

export default function ViewAsSwitcher({ value, variant = "dark" }) {
  const navigate = useNavigate();
  const { user, viewAs, setViewAs } = useAuth();

  if (user?.role !== "admin") return null;

  const selectedView = value || viewAs || "admin";
  const isLightVariant = variant === "light";
  const lightLabelStyle = isLightVariant ? { color: "#1e3a8a" } : undefined;
  const lightSelectStyle = isLightVariant ? { backgroundColor: "#ffffff", color: "#172554" } : undefined;
  const lightOptionStyle = isLightVariant ? { backgroundColor: "#ffffff", color: "#172554" } : undefined;

  function handleChange(event) {
    const nextView = event.target.value;
    setViewAs(nextView);
    navigate(viewModePath(nextView));
  }

  return (
    <label className={isLightVariant ? "admin-view-switcher--light block text-xs font-bold uppercase tracking-[0.14em] text-blue-800" : "block text-xs font-bold uppercase tracking-[0.14em] text-white/70"} style={lightLabelStyle}>
      <span className="mb-2 flex items-center gap-2"><Eye size={14} /> View as</span>
      <select
        value={selectedView}
        style={lightSelectStyle}
        onChange={handleChange}
        className={
          "w-full rounded-lg border px-3 py-2.5 text-sm font-semibold normal-case tracking-normal outline-none transition " +
          (isLightVariant
            ? "border-blue-300 bg-white text-blue-950 shadow-sm hover:bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            : "border-white/20 bg-white/15 text-white hover:bg-white/20 focus:border-white/50 focus:ring-2 focus:ring-white/20")
        }
        aria-label="Choose Admin view mode"
      >
        {VIEW_MODES.map((mode) => <option key={mode} value={mode} className={isLightVariant ? "bg-white text-blue-950" : "bg-brand text-white"} style={lightOptionStyle}>{VIEW_MODE_LABELS[mode]}</option>)}
      </select>
    </label>
  );
}
