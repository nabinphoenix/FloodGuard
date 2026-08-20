import { useEffect, useState } from "react";
import { PlusCircle, MapPin, Map } from "lucide-react";

import { createZone, getZones } from "../../api/admin";
import AlertBadge from "../../components/AlertBadge";
import AdminLayout from "../../components/AdminLayout";

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
      setMessage("Alert zone created successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create alert zone.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Manage Zones">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Monitored Zones</h1>
        <p className="mt-2 text-ink-secondary">Create and manage districts actively monitored by FloodGuard.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* Create Zone Form */}
        <aside>
          <form onSubmit={handleSubmit} className="sticky top-6 rounded-xl border border-ink-border bg-surface-card p-6 shadow-sm">
            <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2 mb-6">
              <PlusCircle className="text-brand" size={20} />
              Add New Zone
            </h2>

            {error && <div className="mb-4 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm text-flood-emergency font-medium">{error}</div>}
            {message && <div className="mb-4 rounded-lg border border-flood-safe/20 bg-flood-safe/10 px-4 py-3 text-sm text-flood-safe font-medium">{message}</div>}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-ink-primary mb-1.5" htmlFor="district">District Name</label>
                <input
                  id="district"
                  value={formData.district}
                  onChange={(event) => updateField("district", event.target.value)}
                  required
                  minLength={2}
                  className="w-full rounded-lg border border-ink-border px-4 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
                  placeholder="e.g. Petaling Jaya"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-primary mb-1.5" htmlFor="alert_level">Initial Alert Level</label>
                <div className="relative">
                  <select
                    id="alert_level"
                    value={formData.alert_level}
                    onChange={(event) => updateField("alert_level", event.target.value)}
                    className="w-full rounded-lg border border-ink-border bg-white px-4 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm appearance-none capitalize font-medium"
                  >
                    {levels.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ink-secondary">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-ink-primary mb-1.5" htmlFor="latitude">Latitude</label>
                  <input
                    id="latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={formData.latitude}
                    onChange={(event) => updateField("latitude", event.target.value)}
                    required
                    className="w-full rounded-lg border border-ink-border px-4 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm font-mono text-sm"
                    placeholder="3.1415"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-primary mb-1.5" htmlFor="longitude">Longitude</label>
                  <input
                    id="longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={formData.longitude}
                    onChange={(event) => updateField("longitude", event.target.value)}
                    required
                    className="w-full rounded-lg border border-ink-border px-4 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm font-mono text-sm"
                    placeholder="101.6865"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full rounded-lg bg-gradient-to-r from-brand to-brand-gradientEnd px-4 py-3 font-bold text-white shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 transition-all"
            >
              {isSubmitting ? "Creating Zone..." : "Add Monitored Zone"}
            </button>
          </form>
        </aside>

        {/* Zones List */}
        <div className="rounded-xl border border-ink-border bg-surface-card shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-ink-border bg-surface-bg px-6 py-5 flex items-center justify-between">
            <h2 className="font-bold text-ink-primary flex items-center gap-2 text-lg">
              <Map className="text-brand" size={20} />
              Active Monitored Zones
            </h2>
            <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-xs font-bold">
              {zones.length} Zones
            </span>
          </div>
          
          <div className="p-6 bg-surface-bg flex-1">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {isLoading ? (
                <div className="col-span-full py-12 flex justify-center">
                  <div className="animate-pulse flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-brand border-t-transparent animate-spin"></div>
                    <p className="text-ink-secondary font-medium">Loading zones...</p>
                  </div>
                </div>
              ) : zones.length === 0 ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <MapPin size={24} className="text-gray-300" />
                  </div>
                  <p className="text-lg font-medium text-ink-primary">No zones created yet.</p>
                  <p className="text-ink-secondary mt-1">Use the form to add your first monitored zone.</p>
                </div>
              ) : (
                zones.map((zone) => (
                  <article key={zone.id} className="group rounded-xl border border-ink-border bg-white p-5 shadow-sm hover:shadow-md hover:border-brand/30 transition-all">
                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-ink-primary text-lg truncate pr-2">{zone.district}</h3>
                        <div className="flex-shrink-0">
                          <AlertBadge level={zone.alert_level} />
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 mt-auto">
                        <div className="flex items-center gap-1.5 text-sm text-ink-secondary font-mono bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100">
                          <MapPin size={14} className="text-gray-400" />
                          <span>{Number(zone.latitude).toFixed(4)}, {Number(zone.longitude).toFixed(4)}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium px-1">
                          Updated {zone.updated_at ? new Date(zone.updated_at).toLocaleString() : "Never"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
