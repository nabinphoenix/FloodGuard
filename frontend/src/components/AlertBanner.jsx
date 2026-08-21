import { AlertTriangle } from "lucide-react";

import { normalizeSeverityLevel } from "../constants/severityColors";

const bannerClasses = {
  safe: "border-flood-safe/20 text-flood-safe",
  watch: "border-flood-watch/20 text-flood-watch",
  warning: "border-flood-warning/20 text-flood-warning",
  emergency: "border-flood-emergency/20 text-flood-emergency",
};

export default function AlertBanner({ level = "watch", title, message }) {
  const normalizedLevel = normalizeSeverityLevel(level);

  return (
    <div
      role="status"
      aria-live={normalizedLevel === "emergency" ? "assertive" : "polite"}
      className={"relative rounded-xl border bg-white px-5 py-4 shadow-sm " + bannerClasses[normalizedLevel]}
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={24} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {message && <p className="mt-1 text-sm leading-5">{message}</p>}
        </div>
      </div>
    </div>
  );
}