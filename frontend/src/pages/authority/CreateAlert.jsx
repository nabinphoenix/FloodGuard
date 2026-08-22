import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, AlertTriangle } from "lucide-react";

import { broadcastAlert, getAuthorityZones } from "../../api/authority";
import AdminLayout from "../../components/AdminLayout";
import CharacterCounter from "../../components/CharacterCounter";
import ConfirmDialog from "../../components/ConfirmDialog";
import FeedbackMessage from "../../components/FeedbackMessage";
import { backendError } from "../../utils/validation";

const levels = [
  { value: "safe", label: "Safe", color: "bg-green-500", borderColor: "border-green-500", textColor: "text-green-700" },
  { value: "watch", label: "Watch", color: "bg-yellow-400", borderColor: "border-yellow-400", textColor: "text-yellow-700" },
  { value: "warning", label: "Warning", color: "bg-orange-500", borderColor: "border-orange-500", textColor: "text-orange-700" },
  { value: "emergency", label: "Emergency", color: "bg-red-500", borderColor: "border-red-500", textColor: "text-red-700" },
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
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    async function loadZones() {
      try {
        const data = await getAuthorityZones();
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
    if (!formData.zone_id || formData.message.trim().length < 5 || formData.message.length > 2000) {
      setError("Select a zone and enter a message between 5 and 2000 characters.");
      return;
    }
    setConfirmation({
      zone_id: Number(formData.zone_id),
      alert_level: formData.alert_level,
      message: formData.message.trim(),
    });
  }

  async function confirmBroadcast() {
    if (!confirmation) return;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await broadcastAlert(confirmation);
      setMessageId(result.sns_message_id);
      setFormData((current) => ({ ...current, message: "" }));
      setConfirmation(null);
    } catch (err) {
      setError(backendError(err, "Could not broadcast alert."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Create Alert">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-primary tracking-tight">Broadcast Emergency Alert</h1>
        <p className="mt-2 text-ink-secondary">Send an SNS flood alert and update the zone severity level immediately.</p>
      </div>

      <FeedbackMessage message={error} />
      <FeedbackMessage message={messageId ? "Alert broadcast successfully. SNS Message ID: " + messageId : ""} type="success" />

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <form onSubmit={handleSubmit} className="rounded-xl border border-ink-border bg-surface-card p-8 shadow-sm">
          <label htmlFor="zone" className="block text-sm font-bold text-ink-primary">Select Affected Zone</label>
          <div className="mt-2 relative">
            <select
              id="zone"
              value={formData.zone_id}
              onChange={(event) => updateField("zone_id", event.target.value)}
              required
              className="w-full rounded-lg border border-ink-border bg-white px-4 py-3.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 appearance-none font-medium text-ink-primary shadow-sm"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name} — {zone.district}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-ink-secondary">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          <div className="mt-8">
            <span className="block text-sm font-bold text-ink-primary mb-3">Severity Level</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {levels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => updateField("alert_level", level.value)}
                  className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    formData.alert_level === level.value
                      ? `${level.borderColor} bg-white shadow-md ring-4 ring-opacity-10 ring-${level.borderColor.split('-')[1]}-500`
                      : "border-ink-border bg-surface-bg hover:bg-white text-ink-secondary hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-4 w-4 rounded-full shadow-sm ${level.color}`} />
                      <span className={`font-bold uppercase tracking-wide text-sm ${formData.alert_level === level.value ? level.textColor : ''}`}>
                        {level.label}
                      </span>
                    </div>
                    {formData.alert_level === level.value && (
                      <CheckCircle size={20} className={level.textColor} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <label htmlFor="message" className="block text-sm font-bold text-ink-primary">Alert Message Details</label>
            <p className="mt-1 text-xs text-ink-secondary mb-2">Include affected roads, expected impact time, and required safety actions.</p>
            <textarea
              id="message"
              value={formData.message}
              onChange={(event) => updateField("message", event.target.value)}
              required
              maxLength={2000}
              rows={6}
              className="w-full rounded-lg border border-ink-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm resize-none"
              placeholder="E.g., Heavy rainfall has caused water levels in Bagmati River to exceed danger thresholds. Low-lying areas including Teku are at immediate risk..."
            />
            <CharacterCounter value={formData.message} maxLength={2000} minLength={5} />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !formData.zone_id || formData.message.trim().length < 5}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-brand to-brand-gradientEnd px-4 py-4 text-base font-bold text-white shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 transition-all"
          >
            {isSubmitting ? "Broadcasting Alert..." : "Broadcast Alert to Community"}
          </button>
        </form>

        <aside className="h-fit rounded-xl border border-ink-border bg-surface-card p-6 shadow-sm sticky top-6">
          <h2 className="font-bold text-ink-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            SNS Email Preview
          </h2>
          <p className="mt-1 text-xs text-ink-secondary mb-4">This is how the alert will appear to registered users.</p>
          
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className={`px-4 py-3 border-b border-gray-200 ${
              formData.alert_level === 'safe' ? 'bg-green-50 text-green-900' :
              formData.alert_level === 'watch' ? 'bg-yellow-50 text-yellow-900' :
              formData.alert_level === 'warning' ? 'bg-orange-50 text-orange-900' :
              'bg-red-50 text-red-900'
            }`}>
              <p className="font-bold text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                FloodGuard {formData.alert_level.toUpperCase()} Alert - {selectedZone?.name || "Zone"}
              </p>
            </div>
            <div className="p-4 text-sm text-gray-700 bg-gray-50/50 min-h-[200px]">
              <p className="font-semibold mb-3">FloodGuard Early Warning Alert</p>
              
              <div className="grid grid-cols-[100px_1fr] gap-2 mb-4">
                <span className="text-gray-500">District:</span>
                <span className="font-medium">{selectedZone?.district || "-"}</span>
                
                <span className="text-gray-500">Alert level:</span>
                <span className={`font-bold ${
                  formData.alert_level === 'safe' ? 'text-green-600' :
                  formData.alert_level === 'watch' ? 'text-yellow-600' :
                  formData.alert_level === 'warning' ? 'text-orange-600' :
                  'text-red-600'
                }`}>{formData.alert_level.toUpperCase()}</span>
              </div>
              
              <div className="bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap mb-4 font-mono text-xs">
                {formData.message || "Your alert message will appear here."}
              </div>
              
              <p className="text-gray-500 italic">Please follow local authority instructions and stay safe.</p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title="Broadcast this flood alert?"
        description="This will notify subscribed users through Amazon SNS and update the monitored zone status."
        confirmLabel="Broadcast Alert"
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmBroadcast}
        isConfirming={isSubmitting}
      >
        {confirmation && (
          <div className="space-y-2 rounded-lg bg-surface-bg p-3 text-sm text-ink-secondary">
            <p><span className="font-semibold text-ink-primary">Zone:</span> {selectedZone?.name || "Selected zone"}</p>
            <p><span className="font-semibold text-ink-primary">Severity:</span> {confirmation.alert_level.toUpperCase()}</p>
            <p><span className="font-semibold text-ink-primary">Message:</span> {confirmation.message}</p>
          </div>
        )}
      </ConfirmDialog>
    </AdminLayout>
  );
}
