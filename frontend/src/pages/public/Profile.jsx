import { useEffect, useState } from "react";

import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";
import { checkPasswordRecoveryStatus, updateProfile } from "../../api/auth";
import { backendError, validatePhone } from "../../utils/validation";

export default function Profile() {
  const { user, setAuthenticatedUser } = useAuth();
  const [formData, setFormData] = useState({ name: "", phone: "", district: "", email_alerts: true, password_recovery_enabled: false });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || "",
      phone: user.phone || "",
      district: user.district || "",
      email_alerts: user.email_alerts ?? true,
      password_recovery_enabled: user.password_recovery_enabled ?? false,
    });
  }, [user]);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setMessage("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function handleCheckStatus() {
    setError("");
    setMessage("");
    setIsCheckingStatus(true);
    try {
      const updated = await checkPasswordRecoveryStatus();
      setAuthenticatedUser(updated.user);
      setFormData((current) => ({
        ...current,
        password_recovery_enabled: updated.user.password_recovery_enabled ?? false,
      }));
      setMessage(updated.message || "Password recovery status updated.");
    } catch (err) {
      setError(backendError(err, "Could not check password recovery status."));
    } finally {
      setIsCheckingStatus(false);
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
        email_alerts: formData.email_alerts,
        password_recovery_enabled: formData.password_recovery_enabled,
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

  const recoveryStatus = user.password_recovery_status || (user.password_recovery_enabled ? "pending" : "disabled");
  const recoveryStatusLabel = { disabled: "Disabled", pending: "Pending Confirmation", confirmed: "Confirmed" }[recoveryStatus] || "Disabled";
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

          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 md:col-span-2">
            <input type="checkbox" checked={formData.email_alerts} onChange={(event) => updateField("email_alerts", event.target.checked)} className="h-4 w-4" />
            <span className="ml-2 text-sm font-medium text-slate-800">Receive email alerts</span>
            <p className="mt-2 text-xs leading-5 text-slate-600">FloodGuard uses Amazon SNS. Enabling alerts sends a confirmation email; alerts start after you confirm the subscription.</p>
            {user.email_alerts && <p className="mt-2 text-xs font-semibold text-amber-700">Email alerts: Pending confirmation. Check your inbox and confirm the subscription.</p>}
          </div>

          <div className="rounded-md border border-indigo-100 bg-indigo-50 p-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <input id="password-recovery" type="checkbox" checked={formData.password_recovery_enabled} onChange={(event) => updateField("password_recovery_enabled", event.target.checked)} className="h-4 w-4" />
              <label htmlFor="password-recovery" className="text-sm font-medium text-slate-800">Password Recovery Email</label>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Enable this separately from flood alerts to receive password reset links through your private SNS subscription.</p>
            <p className="mt-2 text-xs font-semibold text-indigo-700">Status: {recoveryStatusLabel}</p>
            {formData.password_recovery_enabled && <button type="button" onClick={handleCheckStatus} disabled={isCheckingStatus} className="mt-3 rounded-md border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">{isCheckingStatus ? "Checking..." : "Check Status"}</button>}
          </div>

          <button type="submit" disabled={isSubmitting} className="rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 md:col-span-2">
            {isSubmitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </main>
  );
}
