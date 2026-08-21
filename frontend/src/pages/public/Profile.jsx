import { useEffect, useState } from "react";

import { getMe, updateProfile } from "../../api/auth";
import LoadingSpinner from "../../components/LoadingSpinner";
import FeedbackMessage from "../../components/FeedbackMessage";
import { backendError, validatePhone } from "../../utils/validation";

export default function Profile() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    district: "",
    email_alerts: true,
  });
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = await getMe();
        setUser(currentUser);
        setFormData({
          name: currentUser.name || "",
          phone: currentUser.phone || "",
          district: currentUser.district || "",
          email_alerts: currentUser.email_alerts ?? true,
        });
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load your profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setMessage("");
    setFieldErrors((current) => ({ ...current, [name]: "" }));
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
      });
      setUser(updated.user);
      setMessage(updated.message || "Profile updated.");
    } catch (err) {
      setError(backendError(err, "Could not update your profile."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading profile..." />;

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-lg border border-blue-100 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950">Profile</h1>
          <p className="mt-2 text-sm text-blue-700">{user?.email}</p>
        </div>

        <FeedbackMessage message={error} />
        <FeedbackMessage message={message} type="success" />

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-blue-950">Full name</label>
            <input
              id="name"
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
              minLength={2}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
            {fieldErrors.name && <p className="mt-2 text-sm text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-blue-950">Phone</label>
            <input
              id="phone"
              type="text"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
            {fieldErrors.phone && <p className="mt-2 text-sm text-red-600">{fieldErrors.phone}</p>}
          </div>

          <div>
            <label htmlFor="district" className="block text-sm font-medium text-blue-950">District</label>
            <input
              id="district"
              value={formData.district}
              onChange={(event) => updateField("district", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 md:col-span-2">
            <input
              type="checkbox"
              checked={formData.email_alerts}
              onChange={(event) => updateField("email_alerts", event.target.checked)}
              className="h-4 w-4"
            />
            <span className="ml-2 text-sm font-medium text-slate-800">Receive email alerts</span>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              FloodGuard uses Amazon SNS. Enabling alerts sends a confirmation email; alerts start after you confirm the subscription.
            </p>
            {user?.email_alerts && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Email alerts: Pending confirmation. Check your inbox and confirm the subscription.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 md:col-span-2"
          >
            {isSubmitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>
    </main>
  );
}
