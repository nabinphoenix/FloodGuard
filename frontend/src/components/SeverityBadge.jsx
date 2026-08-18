import { AlertTriangle } from "lucide-react";

import { normalizeSeverityLevel, severityLabels } from "../constants/severityColors";

const severityClasses = {
  safe: "bg-flood-safe/10 text-flood-safe",
  watch: "bg-flood-watch/10 text-flood-watch",
  warning: "bg-flood-warning/10 text-flood-warning",
  emergency: "bg-flood-emergency/10 text-flood-emergency",
};

export default function SeverityBadge({ level = "safe" }) {
  const normalizedLevel = normalizeSeverityLevel(level);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${severityClasses[normalizedLevel]}`}
    >
      <AlertTriangle size={14} aria-hidden="true" />
      <span>{severityLabels[normalizedLevel]}</span>
    </span>
  );
}
