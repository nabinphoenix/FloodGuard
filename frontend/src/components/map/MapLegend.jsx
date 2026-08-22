import { MAP_STATUS_COLORS } from "./mapConfig";
import { statusLabel } from "./mapUtils";

const DEFAULT_ITEMS = ["safe", "watch", "warning", "emergency", "no_data"];

export default function MapLegend({ items = DEFAULT_ITEMS }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Map legend</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MAP_STATUS_COLORS[item] || MAP_STATUS_COLORS.report }} />
            {statusLabel(item)}
          </span>
        ))}
      </div>
    </div>
  );
}
