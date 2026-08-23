import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import Button from "./Button";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isConfirming = false,
  confirmingLabel,
  danger = false,
  children,
}) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isConfirming) onCancel();
      if (event.key !== "Tab") return;

      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])];
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirming, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby={description ? "confirm-dialog-description" : undefined}>
      <div ref={dialogRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 rounded-full p-2 ${danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
              <AlertTriangle size={20} />
            </span>
            <div>
              <h2 id="confirm-dialog-title" className="text-xl font-bold text-ink-primary">{title}</h2>
              {description && <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={isConfirming} className="rounded-lg p-2 text-ink-secondary hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close confirmation dialog">
            <X size={20} />
          </button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <Button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={isConfirming} variant="secondary">
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} isLoading={isConfirming} loadingLabel={confirmingLabel || "Working..."} variant={danger ? "danger" : "primary"} className="min-w-[8.5rem]">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
