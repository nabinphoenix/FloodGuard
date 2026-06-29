import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { broadcastAlert, getZones } from "../../api/admin";

const levels = [
  { value: "safe", label: "Safe", color: "bg-green-500" },
  { value: "watch", label: "Watch", color: "bg-yellow-500" },
  { value: "warning", label: "Warning", color: "bg-orange-500" },
  { value: "emergency", label: "Emergency", color: "bg-red-600" },
];

export default function CreateAlert() {
  const [zones, setZones] = useState([]);
  const [formData, setFormData] = useState({
    zone_id: "",
    alert_level: "watch",
    message: "",
  });
  const [messageId, setMessageId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadZones() {
      try {
        const data = await getZones();
        setZones(data);
        if (data.length > 0) {
          setFormData((current) => ({ ...current, zone_id: String(data[0].id) }));
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load alert zones.");
      }
    }

    loadZones();
  }, []);

  const selectedZone = useMemo(
    () => zones.find((zone) => String(zone.id) === String(formData.zone_id)),
    [zones, formData.zone_id]
  );

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setMessageId("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessageId("");
    setIsSubmitting(true);

    try {
      const result = await broadcastAlert({
        zone_id: Number(formData.zone_id),
        alert_level: formData.alert_level,
        message: formData.message.trim(),
      });
      setMessageId(result.sns_message_id);
      setFormData((current) => ({ ...current, message: "" }));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not broadcast alert.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Create Alert</h1>
            <p className="mt-1 text-sm text-slate-600">Broadcast an SNS flood alert and update the zone level.</p>
          </div>
          <Link to="/admin" className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">
            Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {messageId && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Alert broadcast successfully. SNS Message ID: <span className="font-semibold">{messageId}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
            <label htmlFor="zone" className="block text-sm font-medium text-blue-950">Alert Zone</label>
            <select
              id="zone"
              value={formData.zone_id}
              onChange={(event) => updateField("zone_id", event.target.value)}
              required
              className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.district}</option>
              ))}
            </select>

            <div className="mt-6">
              <span className="block text-sm font-medium text-blue-950">Alert Level</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-4">
                {levels.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => updateField("alert_level", level.value)}
                    className={`rounded-md border px-3 py-3 text-left text-sm font-semibold transition ${
                      formData.alert_level === level.value
                        ? "border-blue-700 bg-blue-50 text-blue-900"
                        : "border-blue-100 bg-white text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className={`mr-2 inline-block h-3 w-3 rounded-full ${level.color}`} />
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <label htmlFor="message" className="mt-6 block text-sm font-medium text-blue-950">Message</label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(event) => updateField("message", event.target.value)}
              required
              rows={7}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="Describe the flood risk, affected roads, safety actions, and official instructions."
            />

            <button
              type="submit"
              disabled={isSubmitting || !formData.zone_id || formData.message.trim().length < 5}
              className="mt-6 w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting ? "Broadcasting..." : "Broadcast Alert"}
            </button>
          </form>

          <aside className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-950">SNS Email Preview</h2>
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm">
              <p className="font-semibold text-blue-950">
                FloodGuard {formData.alert_level.toUpperCase()} Alert - {selectedZone?.district || "Selected District"}
              </p>
              <div className="mt-4 space-y-2 text-slate-700">
                <p>FloodGuard Early Warning Alert</p>
                <p>District: {selectedZone?.district || "-"}</p>
                <p>Alert level: {formData.alert_level.toUpperCase()}</p>
                <p className="whitespace-pre-wrap">{formData.message || "Your alert message will appear here."}</p>
                <p>Please follow local authority instructions and stay safe.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
