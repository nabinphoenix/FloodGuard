import { LoaderCircle } from "lucide-react";
import { forwardRef } from "react";

const variants = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-gradientEnd",
  secondary: "border border-ink-border bg-white text-ink-primary hover:border-brand/40 hover:bg-brand/5",
  success: "bg-flood-safe text-white shadow-sm hover:bg-green-600",
  danger: "bg-flood-emergency text-white shadow-sm hover:bg-red-700",
  outline: "border border-brand/30 bg-white text-brand hover:bg-brand/5",
};

/**
 * Shared action button for the main user-facing flows. The fixed minimum height
 * and loading treatment keep actions stable and prevent repeat submissions.
 */
const Button = forwardRef(function Button({
  children,
  className = "",
  variant = "primary",
  isLoading = false,
  loadingLabel,
  type = "button",
  disabled = false,
  ...props
}, ref) {
  const label = isLoading ? (loadingLabel || children) : children;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {isLoading ? <LoaderCircle size={17} className="shrink-0 animate-spin" aria-hidden="true" /> : null}
      {label}
    </button>
  );
});

export default Button;
