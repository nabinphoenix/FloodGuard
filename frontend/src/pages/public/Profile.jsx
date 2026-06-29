import { useEffect, useState } from "react";

import { getMe, updateProfile } from "../../api/auth";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function Profile() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    district: "",
    email_alerts: true,
    sms_alerts: false,
  });
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
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
          sms_alerts: currentUser.sms_alerts ?? false,
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
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const updated = await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        district: formData.district.trim() || null,
        email_alerts: formData.email_alerts,
        sms_alerts: formData.sms_alerts,
      });
      setUser(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update your profile.");
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

        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

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
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-blue-950">Phone</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            />
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

          <label className="flex items-center gap-3 rounded-md border border-blue-100 p-4">
            <input
              type="checkbox"
              checked={formData.email_alerts}
              onChange={(event) => updateField("email_alerts", event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-800">Receive email alerts</span>
          </label>

          <label className="flex items-center gap-3 rounded-md border border-blue-100 p-4">
            <input
              type="checkbox"
              checked={formData.sms_alerts}
              onChange={(event) => updateField("sms_alerts", event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-800">Receive SMS alerts</span>
          </label>

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
