import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isConfirming = false,
  danger = false,
  children,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-full p-2 ${danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="confirm-dialog-title" className="text-xl font-bold text-ink-primary">{title}</h2>
              {description && <p className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-ink-secondary hover:bg-slate-100" aria-label="Close confirmation dialog">
            <X size={20} />
          </button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={isConfirming} className="rounded-lg border border-ink-border px-4 py-2.5 font-semibold text-ink-secondary hover:bg-surface-bg disabled:opacity-60">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isConfirming} className={`rounded-lg px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-sky-600"}`}>
            {isConfirming ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
