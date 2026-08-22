import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { VIEW_MODES, VIEW_MODE_LABELS, viewModePath } from "../utils/roles";

export default function ViewAsSwitcher({ value }) {
  const navigate = useNavigate();
  const { user, viewAs, setViewAs } = useAuth();

  if (user?.role !== "admin") return null;

  const selectedView = value || viewAs || "admin";

  function handleChange(event) {
    const nextView = event.target.value;
    setViewAs(nextView);
    navigate(viewModePath(nextView));
  }

  return (
    <label className="block text-xs font-bold uppercase tracking-[0.14em] text-white/70">
      <span className="mb-2 flex items-center gap-2"><Eye size={14} /> View as</span>
      <select
        value={selectedView}
        onChange={handleChange}
        className="w-full rounded-lg border border-white/20 bg-white/15 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-white outline-none transition hover:bg-white/20 focus:border-white/50 focus:ring-2 focus:ring-white/20"
        aria-label="Choose Admin view mode"
      >
        {VIEW_MODES.map((mode) => <option key={mode} value={mode} className="bg-brand text-white">{VIEW_MODE_LABELS[mode]}</option>)}
      </select>
    </label>
  );
}
