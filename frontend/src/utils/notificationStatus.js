export const NOTIFICATION_POLL_INTERVAL_MS = 12_000;

const PRESENTATIONS = {
  disabled: {
    label: "Disabled",
    message: "Email notifications are disabled.",
    badgeClass: "bg-slate-100 text-slate-700",
    actions: ["enable"],
  },
  pending: {
    label: "Pending confirmation",
    message: "Check your email and confirm the AWS SNS subscription.",
    badgeClass: "bg-amber-100 text-amber-800",
    actions: ["check", "disable"],
  },
  confirmed: {
    label: "Confirmed & Active",
    message: "Email notifications are active.",
    badgeClass: "bg-emerald-100 text-emerald-800",
    actions: ["disable"],
  },
};

export function getNotificationPresentation(status) {
  return PRESENTATIONS[status] || PRESENTATIONS.disabled;
}

export function shouldPollNotificationStatus(notificationStatus) {
  return [notificationStatus?.flood_alerts?.status, notificationStatus?.password_recovery?.status]
    .includes("pending");
}
