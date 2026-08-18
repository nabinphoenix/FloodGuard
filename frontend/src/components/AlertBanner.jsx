import { AlertTriangle } from "lucide-react";

import { normalizeSeverityLevel } from "../constants/severityColors";

const bannerClasses = {
  safe: "border-flood-safe/20 bg-flood-safe/10 text-flood-safe",
  watch: "border-flood-watch/20 bg-flood-watch/10 text-flood-watch",
  warning: "border-flood-warning/20 bg-flood-warning/10 text-flood-warning",
  emergency: "border-flood-emergency/20 bg-flood-emergency/10 text-flood-emergency",
};

export default function AlertBanner({ level = "watch", title, message }) {
  const normalizedLevel = normalizeSeverityLevel(level);

  return (
    <div className={`sticky top-0 z-30 border px-4 py-3 ${bannerClasses[normalizedLevel]}`}>
      <div className="mx-auto flex max-w-7xl items-start gap-2">
        <AlertTriangle size={24} aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          {message && <p className="text-sm">{message}</p>}
        </div>
      </div>
    </div>
  );
}
