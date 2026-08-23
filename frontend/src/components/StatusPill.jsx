const statusConfig = {
  pending: {
    label: "Pending Review",
    className: "bg-brand/10 text-brand",
  },
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800",
  },
  resolved: {
    label: "Resolved",
    className: "bg-slate-100 text-slate-700",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800",
  },
  healthy: {
    label: "Healthy",
    className: "bg-emerald-100 text-emerald-800",
  },
  unhealthy: {
    label: "Unhealthy",
    className: "bg-slate-100 text-slate-700",
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800",
  },
  inactive: {
    label: "Inactive",
    className: "bg-slate-100 text-slate-700",
  },
};

export default function StatusPill({ status = "pending" }) {
  const normalizedStatus = String(status || "pending").toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    label: normalizedStatus,
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${config.className}`}>
      {config.label}
    </span>
  );
}
