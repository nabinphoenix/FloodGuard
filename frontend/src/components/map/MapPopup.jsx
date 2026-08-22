export default function MapPopup({ title, subtitle, children }) {
  return (
    <div className="min-w-[190px] max-w-[280px] text-slate-800">
      <h3 className="mb-0.5 text-sm font-bold text-slate-950">{title}</h3>
      {subtitle ? <p className="mb-2 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="space-y-1 text-xs">{children}</div>
    </div>
  );
}
