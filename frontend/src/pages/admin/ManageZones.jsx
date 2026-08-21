import { useEffect, useState } from "react";
import { Eye, Map, MapPin, Pencil, PlusCircle, Trash2, X } from "lucide-react";

import { createZone, deleteZone, getZone, getZones, updateZone } from "../../api/admin";
import AlertBadge from "../../components/AlertBadge";
import AdminLayout from "../../components/AdminLayout";

const levels = ["safe", "watch", "warning", "emergency"];
const emptyZone = { district: "", alert_level: "safe", latitude: "", longitude: "" };

function zonePayload(formData) {
  return {
    district: formData.district.trim(),
    alert_level: formData.alert_level,
    latitude: Number(formData.latitude),
    longitude: Number(formData.longitude),
  };
}

export default function ManageZones() {
  const [zones, setZones] = useState([]);
  const [formData, setFormData] = useState(emptyZone);
  const [selectedZone, setSelectedZone] = useState(null);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState(null);

  async function loadZones() {
    setIsLoading(true);
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
    setError("");
    setMessage("");
  }

  function closeModal() {
    setModal(null);
    setSelectedZone(null);
    setFormData(emptyZone);
  }

  async function openView(zone) {
    setError("");
    setSelectedZone(zone);
    setModal("view");
    try {
      setSelectedZone(await getZone(zone.id));
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load zone details.");
    }
  }

  function openEdit(zone) {
    setError("");
    setSelectedZone(zone);
    setFormData({
      district: zone.district || "",
      alert_level: zone.alert_level || "safe",
      latitude: zone.latitude ?? "",
      longitude: zone.longitude ?? "",
    });
    setModal("edit");
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const zone = await createZone(zonePayload(formData));
      setZones((current) => [...current, zone].sort((a, b) => a.district.localeCompare(b.district)));
      setFormData(emptyZone);
      setMessage("Alert zone created successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create alert zone.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const updated = await updateZone(selectedZone.id, zonePayload(formData));
      setZones((current) => current.map((zone) => (zone.id === updated.id ? updated : zone)).sort((a, b) => a.district.localeCompare(b.district)));
      closeModal();
      setMessage("Alert zone updated successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update alert zone.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(zone) {
    if (!window.confirm(`Delete the ${zone.district} zone? Historical alert zones cannot be deleted.`)) return;
    setWorkingId(zone.id);
    setError("");
    setMessage("");
    try {
      await deleteZone(zone.id);
      setZones((current) => current.filter((item) => item.id !== zone.id));
      setMessage("Alert zone deleted successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete alert zone.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AdminLayout title="Manage Zones">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink-primary">Monitored Zones</h1>
        <p className="mt-2 text-ink-secondary">Create and manage districts actively monitored by FloodGuard.</p>
      </div>

      {error && <div className="mb-6 rounded-lg border border-flood-emergency/20 bg-flood-emergency/10 px-4 py-3 text-sm font-medium text-flood-emergency">{error}</div>}
      {message && <div className="mb-6 rounded-lg border border-flood-safe/20 bg-flood-safe/10 px-4 py-3 text-sm font-medium text-flood-safe">{message}</div>}

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        <aside>
          <form onSubmit={handleCreate} className="sticky top-6 rounded-xl border border-ink-border bg-surface-card p-6 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-ink-primary"><PlusCircle className="text-brand" size={20} />Add New Zone</h2>
            <div className="space-y-5">
              <label className="block text-sm font-bold text-ink-primary">District Name<input value={formData.district} onChange={(event) => updateField("district", event.target.value)} required minLength="2" className="mt-1.5 w-full rounded-lg border border-ink-border px-4 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="e.g. Petaling Jaya" /></label>
              <label className="block text-sm font-bold capitalize text-ink-primary">Initial Alert Level<select value={formData.alert_level} onChange={(event) => updateField("alert_level", event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink-border bg-white px-4 py-2.5 capitalize outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-4"><label className="text-sm font-bold text-ink-primary">Latitude<input type="number" step="any" min="-90" max="90" value={formData.latitude} onChange={(event) => updateField("latitude", event.target.value)} required className="mt-1.5 w-full rounded-lg border border-ink-border px-3 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label><label className="text-sm font-bold text-ink-primary">Longitude<input type="number" step="any" min="-180" max="180" value={formData.longitude} onChange={(event) => updateField("longitude", event.target.value)} required className="mt-1.5 w-full rounded-lg border border-ink-border px-3 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label></div>
            </div>
            <button type="submit" disabled={isSubmitting} className="mt-8 w-full rounded-lg bg-gradient-to-r from-brand to-brand-gradientEnd px-4 py-3 font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Creating Zone..." : "Add Monitored Zone"}</button>
          </form>
        </aside>

        <div className="flex flex-col overflow-hidden rounded-xl border border-ink-border bg-surface-card shadow-sm">
          <div className="flex items-center justify-between border-b border-ink-border bg-surface-bg px-6 py-5"><h2 className="flex items-center gap-2 text-lg font-bold text-ink-primary"><Map className="text-brand" size={20} />Active Monitored Zones</h2><span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{zones.length} Zones</span></div>
          <div className="flex-1 bg-surface-bg p-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {isLoading ? <div className="col-span-full flex justify-center py-12"><div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" /><p className="font-medium text-ink-secondary">Loading zones...</p></div></div> : zones.length === 0 ? <div className="col-span-full flex flex-col items-center justify-center py-12 text-center"><MapPin size={24} className="text-gray-300" /><p className="mt-4 text-lg font-medium text-ink-primary">No zones created yet.</p><p className="mt-1 text-ink-secondary">Use the form to add your first monitored zone.</p></div> : zones.map((zone) => <article key={zone.id} className="rounded-xl border border-ink-border bg-white p-5 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"><div className="flex flex-col gap-4"><div className="flex items-start justify-between gap-3"><h3 className="truncate pr-2 text-lg font-bold text-ink-primary">{zone.district}</h3><AlertBadge level={zone.alert_level} /></div><div className="flex items-center gap-1.5 rounded border border-gray-100 bg-gray-50 px-2.5 py-1.5 font-mono text-sm text-ink-secondary"><MapPin size={14} className="text-gray-400" />{Number(zone.latitude).toFixed(4)}, {Number(zone.longitude).toFixed(4)}</div><p className="px-1 text-[11px] font-medium text-gray-400">Updated {zone.updated_at ? new Date(zone.updated_at).toLocaleString() : "Never"}</p><div className="flex justify-end gap-1 border-t border-gray-100 pt-3"><button type="button" title="View zone" onClick={() => openView(zone)} className="rounded-lg p-2 text-brand hover:bg-brand/10"><Eye size={17} /></button><button type="button" title="Edit zone" onClick={() => openEdit(zone)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Pencil size={17} /></button><button type="button" title="Delete zone" disabled={workingId === zone.id} onClick={() => handleDelete(zone)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={17} /></button></div></div></article>)}
          </div></div>
        </div>
      </div>

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><h2 className="text-xl font-bold text-ink-primary">{modal === "view" ? "Zone details" : "Edit zone"}</h2><p className="mt-1 text-sm text-ink-secondary">{selectedZone?.district}</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-ink-secondary hover:bg-slate-100"><X size={20} /></button></div>{modal === "view" && selectedZone && <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-ink-border bg-surface-bg p-4"><p className="text-xs font-semibold uppercase text-ink-secondary">District</p><p className="mt-1 font-semibold text-ink-primary">{selectedZone.district}</p></div><div className="rounded-xl border border-ink-border bg-surface-bg p-4"><p className="text-xs font-semibold uppercase text-ink-secondary">Alert level</p><div className="mt-2"><AlertBadge level={selectedZone.alert_level} /></div></div><div className="rounded-xl border border-ink-border bg-surface-bg p-4"><p className="text-xs font-semibold uppercase text-ink-secondary">Coordinates</p><p className="mt-1 font-mono text-sm text-ink-primary">{selectedZone.latitude}, {selectedZone.longitude}</p></div><div className="rounded-xl border border-ink-border bg-surface-bg p-4"><p className="text-xs font-semibold uppercase text-ink-secondary">Last updated</p><p className="mt-1 text-sm text-ink-primary">{selectedZone.updated_at ? new Date(selectedZone.updated_at).toLocaleString() : "Never"}</p></div></div>}{modal === "edit" && <form onSubmit={handleEdit} className="space-y-4"><label className="block text-sm font-semibold text-ink-primary">District<input required minLength="2" value={formData.district} onChange={(event) => updateField("district", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label><label className="block text-sm font-semibold capitalize text-ink-primary">Alert level<select value={formData.alert_level} onChange={(event) => updateField("alert_level", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border bg-white px-4 py-3 capitalize outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label><div className="grid grid-cols-2 gap-4"><label className="text-sm font-semibold text-ink-primary">Latitude<input required type="number" step="any" min="-90" max="90" value={formData.latitude} onChange={(event) => updateField("latitude", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label><label className="text-sm font-semibold text-ink-primary">Longitude<input required type="number" step="any" min="-180" max="180" value={formData.longitude} onChange={(event) => updateField("longitude", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-4 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" /></label></div><button disabled={isSubmitting} className="w-full rounded-lg bg-brand px-4 py-3 font-bold text-white disabled:opacity-60">{isSubmitting ? "Saving..." : "Save changes"}</button></form>}</div></div>}
    </AdminLayout>
  );
}
