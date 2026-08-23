import { useCallback, useEffect, useState } from "react";

import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import {
  disableFloodAlerts,
  disablePasswordRecovery,
  enableFloodAlerts,
  enablePasswordRecovery,
  getNotificationStatus,
  updateProfile,
} from "../../api/auth";
import {
  getNotificationPresentation,
  NOTIFICATION_POLL_INTERVAL_MS,
  shouldPollNotificationStatus,
} from "../../utils/notificationStatus";
import { backendError, validatePhone } from "../../utils/validation";

const DEFAULT_NOTIFICATION_STATUS = {
  flood_alerts: { enabled: false, status: "disabled", label: "Disabled" },
  password_recovery: { enabled: false, status: "disabled", label: "Disabled" },
};

function NotificationSubscriptionCard({ title, description, subscription, section, busyAction, onAction }) {
  const presentation = getNotificationPresentation(subscription?.status);
  const isBusy = (action) => busyAction === `${section}:${action}`;

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 p-4 md:col-span-2">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
      <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span>Status:</span>
        <span className={`rounded-full px-2.5 py-1 ${presentation.badgeClass}`}>{presentation.label}</span>
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{presentation.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {presentation.actions.includes("enable") && (
          <button type="button" onClick={() => onAction(section, "enable")} disabled={isBusy("enable")} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isBusy("enable") ? "Enabling..." : "Enable"}
          </button>
        )}
        {presentation.actions.includes("check") && (
          <button type="button" onClick={() => onAction(section, "check")} disabled={isBusy("check")} className="rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60">
            {isBusy("check") ? "Checking..." : "Check Status"}
          </button>
        )}
        {presentation.actions.includes("disable") && (
          <button type="button" onClick={() => onAction(section, "disable")} disabled={isBusy("disable")} className="rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isBusy("disable") ? "Disabling..." : "Disable"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, setAuthenticatedUser } = useAuth();
  const [formData, setFormData] = useState({ name: "", phone: "", district: "" });
  const [notificationStatus, setNotificationStatus] = useState(DEFAULT_NOTIFICATION_STATUS);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busySubscription, setBusySubscription] = useState("");

  const applyNotificationStatus = useCallback((result) => {
    if (!result?.flood_alerts || !result?.password_recovery) return;
    setNotificationStatus({
      flood_alerts: result.flood_alerts,
      password_recovery: result.password_recovery,
    });
    setAuthenticatedUser((current) => (current ? {
      ...current,
      email_alerts: result.flood_alerts.enabled,
      password_recovery_enabled: result.password_recovery.enabled,
    } : current));
  }, [setAuthenticatedUser]);

  const refreshNotificationStatus = useCallback(async ({ showFeedback = false } = {}) => {
    try {
      const result = await getNotificationStatus();
      applyNotificationStatus(result);
      if (showFeedback) setMessage(result.message || "Subscription status updated.");
      return result;
    } catch (err) {
      if (showFeedback) setError(backendError(err, "Could not check subscription status."));
      return null;
    }
  }, [applyNotificationStatus]);

  useEffect(() => {
    if (user) refreshNotificationStatus();
  }, [refreshNotificationStatus, user?.id]);

  useEffect(() => {
    if (!shouldPollNotificationStatus(notificationStatus)) return undefined;
    const intervalId = window.setInterval(() => {
      refreshNotificationStatus();
    }, NOTIFICATION_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [notificationStatus, refreshNotificationStatus]);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || "",
      phone: user.phone || "",
      district: user.district || "",
    });
  }, [user?.district, user?.id, user?.name, user?.phone]);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setMessage("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleSubscriptionAction(section, action) {
    setError("");
    setMessage("");
    setBusySubscription(`${section}:${action}`);
    try {
      if (action === "check") {
        await refreshNotificationStatus({ showFeedback: true });
        return;
      }

      const request = section === "flood_alerts"
        ? (action === "enable" ? enableFloodAlerts : disableFloodAlerts)
        : (action === "enable" ? enablePasswordRecovery : disablePasswordRecovery);
      const result = await request();
      applyNotificationStatus(result);
      setMessage(result.message || "Subscription settings updated.");
    } catch (err) {
      setError(backendError(err, "Could not update subscription settings."));
    } finally {
      setBusySubscription("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const nextFieldErrors = {};
    if (formData.name.trim().length < 2) nextFieldErrors.name = "Name must be at least 2 characters.";
    const phoneError = validatePhone(formData.phone);
    if (phoneError) nextFieldErrors.phone = phoneError;
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const updated = await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        district: formData.district.trim() || null,
      });
      setAuthenticatedUser(updated.user);
      setMessage(updated.message || "Profile updated.");
    } catch (err) {
      setError(backendError(err, "Could not update your profile."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return <LoadingSpinner message="Loading profile..." />;

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-lg border border-blue-100 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950">Profile</h1>
          <p className="mt-2 text-sm text-blue-700">{user.email}</p>
        </div>

        <FeedbackMessage message={error} />
        <FeedbackMessage message={message} type="success" />

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-blue-950">Full name</label>
            <input id="name" value={formData.name} onChange={(event) => updateField("name", event.target.value)} required minLength={2} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
            {fieldErrors.name && <p className="mt-2 text-sm text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-blue-950">Phone</label>
            <input id="phone" type="text" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" value={formData.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
            {fieldErrors.phone && <p className="mt-2 text-sm text-red-600">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label htmlFor="district" className="block text-sm font-medium text-blue-950">District</label>
            <input id="district" value={formData.district} onChange={(event) => updateField("district", event.target.value)} className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200" />
          </div>

          <NotificationSubscriptionCard
            title="Receive email alerts"
            description="Flood alerts are delivered through the shared FloodGuard-Alerts SNS topic. Enabling sends a confirmation email to your account address."
            subscription={notificationStatus.flood_alerts}
            section="flood_alerts"
            busyAction={busySubscription}
            onAction={handleSubscriptionAction}
          />

          <NotificationSubscriptionCard
            title="Password Recovery Email"
            description="This is separate from flood alerts and uses your private SNS password-recovery subscription for reset links only."
            subscription={notificationStatus.password_recovery}
            section="password_recovery"
            busyAction={busySubscription}
            onAction={handleSubscriptionAction}
          />

          <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 md:col-span-2">
            {isSubmitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </main>
  );
}
