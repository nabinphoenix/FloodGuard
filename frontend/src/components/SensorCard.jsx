import { normalizeSeverityLevel } from "../constants/severityColors";
import SeverityBadge from "./SeverityBadge";

const meterClasses = {
  safe: "bg-flood-safe",
  watch: "bg-flood-watch",
  warning: "bg-flood-warning",
  emergency: "bg-flood-emergency",
};

export default function SensorCard({ stationName, value, unit = "m", level = "safe", lastUpdated, children }) {
  const displayValue = value === null || value === undefined ? "--" : Number(value).toFixed(2);
  const normalizedLevel = normalizeSeverityLevel(level);

  return (
    <article className="rounded-lg border border-ink-border bg-surface-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink-primary">{stationName}</h2>
          <p className="mt-1 text-sm text-ink-secondary">{lastUpdated || "Waiting for reading"}</p>
        </div>
        <SeverityBadge level={normalizedLevel} />
      </div>

      <div className="mt-6 flex items-end gap-2">
        <span className="text-5xl font-bold text-brand" style={{ fontVariantNumeric: "tabular-nums" }}>
          {displayValue}
        </span>
        <span className="pb-2 text-sm font-semibold text-ink-secondary">{unit}</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-border">
        <div className={`h-full rounded-full ${meterClasses[normalizedLevel] || meterClasses.safe}`} />
      </div>
      {children}
    </article>
  );
}
