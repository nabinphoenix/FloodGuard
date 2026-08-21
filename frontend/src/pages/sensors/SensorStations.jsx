import { Check, Edit3, Plus, Power, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createStation,
  deleteStation,
  getStations,
  updateStation,
  updateStationStatus,
} from "../../api/sensors";
import { getHistoryGeography } from "../../api/history";
import AdminLayout from "../../components/AdminLayout";
import { backendError } from "../../utils/validation";

const emptyForm = {
  station_code: "",
  name: "",
  province: "",
  district: "",
  river_basin: "",
  river_name: "",
  latitude: "",
  longitude: "",
  watch_threshold: "",
  warning_threshold: "",
  danger_threshold: "",
};

function formFromStation(station) {
  return {
    station_code: station.station_code || station.id || "",
    name: station.name || "",
    province: station.province || "",
    district: station.district || "",
    river_basin: station.river_basin || "",
    river_name: station.river_name || "",
    latitude: String(station.latitude ?? ""),
    longitude: String(station.longitude ?? ""),
    watch_threshold: String(station.watch_threshold ?? ""),
    warning_threshold: String(station.warning_threshold ?? ""),
    danger_threshold: String(station.danger_threshold ?? ""),
  };
}

function statusLabel(value) {
  return value === "no_data" ? "NO DATA" : String(value || "unknown").toUpperCase();
}

function stationPayload(form) {
  return {
    station_code: form.station_code.trim(),
    name: form.name.trim(),
    province: form.province,
    district: form.district,
    river_basin: form.river_basin,
    river_name: form.river_name,
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    watch_threshold: Number(form.watch_threshold),
    warning_threshold: Number(form.warning_threshold),
    danger_threshold: Number(form.danger_threshold),
  };
}

function validateForm(form) {
  const required = [
    ["Station code", form.station_code],
    ["Station name", form.name],
    ["Province", form.province],
    ["District", form.district],
    ["River basin", form.river_basin],
    ["River", form.river_name],
    ["Latitude", form.latitude],
    ["Longitude", form.longitude],
    ["Watch level", form.watch_threshold],
    ["Warning level", form.warning_threshold],
    ["Emergency level", form.danger_threshold],
  ];
  const missing = required.find(([, value]) => String(value).trim() === "");
  if (missing) return missing[0] + " is required.";

  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  const watch = Number(form.watch_threshold);
  const warning = Number(form.warning_threshold);
  const danger = Number(form.danger_threshold);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "Latitude must be between -90 and 90.";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "Longitude must be between -180 and 180.";
  if (![watch, warning, danger].every(Number.isFinite)) return "Thresholds must be valid numbers.";
  if (watch < 0) return "Watch level must be at least 0 m.";
  if (watch >= warning) return "Watch level must be less than warning level.";
  if (warning >= danger) return "Warning level must be less than emergency level.";
  return "";
}

function SelectField({ label, value, onChange, options, required = true, disabled = false }) {
  return (
    <label className="block text-sm font-semibold text-ink-primary">
      {label}{required && " *"}
      <select required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border bg-white px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100">
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StationForm({ form, setForm, geography, editing, isSaving, error, onSubmit, onCancel }) {
  const provinces = geography?.provinces?.map((item) => item.name) || [];
  const selectedProvince = geography?.provinces?.find((item) => item.name === form.province);
  const districts = selectedProvince?.districts?.map((item) => item.name) || [];
  const selectedDistrict = selectedProvince?.districts?.find((item) => item.name === form.district);
  const basins = selectedDistrict?.river_basins?.length
    ? selectedDistrict.river_basins
    : geography?.river_basins || [];
  const rivers = selectedDistrict?.rivers || [];

  function change(field, value) {
    const resets = {
      province: { district: "", river_basin: "", river_name: "" },
      district: { river_basin: "", river_name: "" },
      river_basin: { river_name: "" },
    };
    setForm((current) => ({ ...current, [field]: value, ...(resets[field] || {}) }));
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-blue-950">{editing ? "Edit sensor station" : "Create sensor station"}</h2>
          <p className="mt-1 text-sm text-slate-600">Configure the location and thresholds used by the live monitoring workflow.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close station form"><X size={20} /></button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block text-sm font-semibold text-ink-primary">Station Code *
          <input required maxLength={20} disabled={editing} value={form.station_code} onChange={(event) => change("station_code", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100" placeholder="e.g. STN001" />
          {editing && <span className="mt-1 block text-xs font-normal text-slate-500">Station codes remain stable after creation.</span>}
        </label>
        <label className="block text-sm font-semibold text-ink-primary">Station Name *
          <input required maxLength={150} value={form.name} onChange={(event) => change("name", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="Narayani River Station" />
        </label>

        <SelectField label="Province" value={form.province} onChange={(value) => change("province", value)} options={provinces} />
        <SelectField label="District" value={form.district} onChange={(value) => change("district", value)} options={districts} disabled={!form.province} />
        <SelectField label="River Basin" value={form.river_basin} onChange={(value) => change("river_basin", value)} options={basins} disabled={!form.district} />
        <SelectField label="River" value={form.river_name} onChange={(value) => change("river_name", value)} options={rivers} disabled={!form.district} />

        <label className="block text-sm font-semibold text-ink-primary">Latitude *
          <input required type="number" step="any" value={form.latitude} onChange={(event) => change("latitude", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="27.6710" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Valid range: -90 to 90</span>
        </label>
        <label className="block text-sm font-semibold text-ink-primary">Longitude *
          <input required type="number" step="any" value={form.longitude} onChange={(event) => change("longitude", event.target.value)} className="mt-2 w-full rounded-lg border border-ink-border px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder="84.4305" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Valid range: -180 to 180</span>
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
        <h3 className="font-black text-blue-950">Alert thresholds</h3>
        <p className="mt-1 text-sm text-blue-800">All values are metres (m). They determine SAFE, WATCH, WARNING and EMERGENCY.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {[
            ["watch_threshold", "Watch Level (m)", "2.50"],
            ["warning_threshold", "Warning Level (m)", "3.50"],
            ["danger_threshold", "Emergency Level (m)", "4.50"],
          ].map(([field, label, placeholder]) => (
            <label key={field} className="block text-sm font-semibold text-ink-primary">{label} *
              <input required type="number" min="0" step="0.01" value={form[field]} onChange={(event) => change(field, event.target.value)} className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" placeholder={placeholder} />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-lg border border-ink-border px-5 py-3 font-semibold text-ink-primary hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={isSaving} className="rounded-lg bg-brand px-5 py-3 font-bold text-white hover:bg-brand-gradientEnd disabled:opacity-60">{isSaving ? "Saving..." : editing ? "Save changes" : "Create station"}</button>
      </div>
    </form>
  );
}

export default function SensorStations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stations, setStations] = useState([]);
  const [geography, setGeography] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(searchParams.get("create") === "1");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [stationData, geographyData] = await Promise.all([getStations(), getHistoryGeography()]);
      setStations(stationData);
      setGeography(geographyData);
      setError("");
    } catch (err) {
      setError(backendError(err, "Could not load sensor stations."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
    setMessage("");
    setSearchParams({ create: "1" });
  }

  function openEdit(station) {
    setForm(formFromStation(station));
    setEditing(station);
    setShowForm(true);
    setMessage("");
    setSearchParams({});
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setSearchParams({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      if (editing) {
        await updateStation(editing.id, stationPayload(form));
        setMessage("Sensor station updated successfully.");
      } else {
        await createStation(stationPayload(form));
        setMessage("Sensor station created successfully.");
      }
      closeForm();
      await load();
    } catch (err) {
      setError(backendError(err, "Could not save sensor station."));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleStation(station) {
    try {
      await updateStationStatus(station.id, !station.is_active);
      setMessage(station.is_active ? "Sensor station deactivated." : "Sensor station activated.");
      await load();
    } catch (err) {
      setError(backendError(err, "Could not update station status."));
    }
  }

  async function removeStation(station) {
    if (!window.confirm("Delete this station? Stations with readings must be deactivated instead.")) return;
    try {
      await deleteStation(station.id);
      setMessage("Sensor station deleted.");
      await load();
    } catch (err) {
      setError(backendError(err, "Could not delete sensor station."));
    }
  }

  return (
    <AdminLayout title="Sensor Stations">
      <section>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-primary">Sensor Stations</h1>
            <p className="mt-2 text-ink-secondary">Create and maintain the monitoring stations used by Field Officer operations.</p>
          </div>
          <button type="button" onClick={openCreate} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 font-bold text-white shadow-sm hover:bg-brand-gradientEnd"><Plus size={18} /> Add Sensor Station</button>
        </div>

        {message && <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</div>}

        {showForm && <div className="mb-8"><StationForm form={form} setForm={setForm} geography={geography} editing={editing} isSaving={isSaving} error={error} onSubmit={handleSubmit} onCancel={closeForm} /></div>}

        {isLoading ? (
          <div className="rounded-xl border border-blue-100 bg-white p-12 text-center text-slate-600">Loading sensor stations...</div>
        ) : stations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-black text-blue-950">No sensor stations configured.</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-600">Create your first monitoring station to start collecting water-level telemetry.</p>
            {!showForm && <button type="button" onClick={openCreate} className="mt-6 rounded-lg bg-brand px-5 py-3 font-bold text-white">Add Sensor Station</button>}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {stations.map((station) => (
              <article key={station.id} className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-brand">{station.station_code}</p>
                    <h2 className="mt-1 text-xl font-black text-blue-950">{station.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">{station.province} · {station.district} · {station.river_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{station.river_basin}</p>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-xs font-bold uppercase " + (station.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600")}>{station.is_active ? "active" : "inactive"}</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                  <div className="rounded-lg bg-yellow-50 p-3 text-yellow-800">Watch<br /><strong>{station.watch_threshold?.toFixed(2)} m</strong></div>
                  <div className="rounded-lg bg-orange-50 p-3 text-orange-800">Warning<br /><strong>{station.warning_threshold?.toFixed(2)} m</strong></div>
                  <div className="rounded-lg bg-red-50 p-3 text-red-800">Emergency<br /><strong>{station.danger_threshold?.toFixed(2)} m</strong></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEdit(station)} className="flex items-center gap-1.5 rounded-lg border border-ink-border px-3 py-2 text-sm font-semibold hover:border-brand hover:text-brand"><Edit3 size={15} /> Edit</button>
                  <button type="button" onClick={() => toggleStation(station)} className="flex items-center gap-1.5 rounded-lg border border-ink-border px-3 py-2 text-sm font-semibold hover:border-brand hover:text-brand"><Power size={15} /> {station.is_active ? "Deactivate" : "Activate"}</button>
                  <button type="button" onClick={() => removeStation(station)} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15} /> Delete</button>
                  <Link to="/sensors/history" className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"><Check size={15} /> View history</Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <h2 className="font-black">Sensor Demo</h2>
          <p className="mt-2">Create a station, configure its thresholds, then run the included <code className="font-mono font-bold">scripts/simulate_water_level.py</code> utility. The utility authenticates as a Field Officer and submits real API readings; credentials are never stored in this page.</p><p className="mt-2">Automated cloud demo telemetry may be enabled for this environment at a one-minute interval. Its server-side <code className="font-mono font-bold">SIMULATOR_ENABLED</code> setting controls whether scheduled readings are sent.</p>
        </div>
      </section>
    </AdminLayout>
  );
}
