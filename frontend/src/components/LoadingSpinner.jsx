const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-9 w-9 border-4",
  lg: "h-12 w-12 border-4",
};

export default function LoadingSpinner({ size = "md", message = "Loading..." }) {
  const spinnerSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-blue-900">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-blue-200 border-t-blue-800`}
        role="status"
        aria-label={message}
      />
      {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
    </div>
  );
}
