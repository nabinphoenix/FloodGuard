import { AlertTriangle, CheckCircle, X } from "lucide-react";

export default function FeedbackMessage({ message, type = "error", onDismiss }) {
  if (!message) return null;

  const isSuccess = type === "success";
  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
        isSuccess
          ? "border-flood-safe/20 bg-flood-safe/10 text-flood-safe"
          : "border-flood-emergency/20 bg-flood-emergency/10 text-flood-emergency"
      }`}
    >
      {isSuccess ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100" aria-label="Dismiss message">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
