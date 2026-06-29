import { useEffect, useState } from "react";

import { createZone, getZones } from "../../api/admin";
import AlertBadge from "../../components/AlertBadge";

const levels = ["safe", "watch", "warning", "emergency"];

export default function ManageZones() {
  const [zones, setZones] = useState([]);
  const [formData, setFormData] = useState({
    district: "",
    alert_level: "safe",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadZones() {
    try {
      setZones(await getZones());
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load alert zones.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadZones();
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
      const zone = await createZone({
        district: formData.district.trim(),
        alert_level: formData.alert_level,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
      });
      setZones((current) => [...current, zone].sort((a, b) => a.district.localeCompare(b.district)));
      setFormData({ district: "", alert_level: "safe", latitude: "", longitude: "" });
      setMessage("Alert zone created.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create alert zone.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[390px_1fr]">
        <form onSubmit={handleSubmit} className="h-fit rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Manage Zones</h1>
          <p className="mt-1 text-sm text-slate-600">Create districts monitored by FloodGuard alerts.</p>

          {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

          <label className="mt-5 block text-sm font-medium text-blue-950" htmlFor="district">District</label>
          <input
            id="district"
            value={formData.district}
            onChange={(event) => updateField("district", event.target.value)}
            required
            minLength={2}
            className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          />

          <label className="mt-5 block text-sm font-medium text-blue-950" htmlFor="alert_level">Initial alert level</label>
          <select
            id="alert_level"
            value={formData.alert_level}
            onChange={(event) => updateField("alert_level", event.target.value)}
            className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            {levels.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-blue-950" htmlFor="latitude">Latitude</label>
              <input
                id="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={formData.latitude}
                onChange={(event) => updateField("latitude", event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-950" htmlFor="longitude">Longitude</label>
              <input
                id="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={formData.longitude}
                onChange={(event) => updateField("longitude", event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSubmitting ? "Creating..." : "Create zone"}
          </button>
        </form>

        <div className="rounded-lg border border-blue-100 bg-white shadow-sm">
          <div className="border-b border-blue-50 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Alert Zones</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading zones...</p>
            ) : zones.length === 0 ? (
              <p className="text-sm text-slate-500">No zones created yet.</p>
            ) : (
              zones.map((zone) => (
                <article key={zone.id} className="rounded-md border border-blue-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-slate-950">{zone.district}</h3>
                    <AlertBadge level={zone.alert_level} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {Number(zone.latitude).toFixed(4)}, {Number(zone.longitude).toFixed(4)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {zone.updated_at ? new Date(zone.updated_at).toLocaleString() : "-"}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
