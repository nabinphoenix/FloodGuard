import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Star } from "lucide-react";

import { getPublicGeography, getReportZones } from "../../api/public";
import { getMyReports, submitReport, updateReport } from "../../api/reports";
import CharacterCounter from "../../components/CharacterCounter";
import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingSpinner from "../../components/LoadingSpinner";
import LocationPicker from "../../components/map/LocationPicker";
import { isWithinNepalOperationalBounds } from "../../components/map/mapUtils";
import { backendError, validateCoordinate } from "../../utils/validation";

const EMPTY_FORM = {
  province: "",
  district: "",
  zone_id: "",
  severity: "",
  description: "",
  latitude: "",
  longitude: "",
  photo: null,
};

export default function SubmitReport() {
  const { reportId } = useParams();
  const isEditMode = Boolean(reportId);
  const preserveZoneRef = useRef(false);
  const [isReportLoading, setIsReportLoading] = useState(isEditMode);
  const [existingImageUrl, setExistingImageUrl] = useState("");

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [geography, setGeography] = useState(null);
  const [isGeographyLoading, setIsGeographyLoading] = useState(true);
  const [zones, setZones] = useState([]);
  const [isZonesLoading, setIsZonesLoading] = useState(false);
  const [zoneError, setZoneError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedProvince = geography?.provinces?.find((item) => item.name === formData.province);
  const districts = selectedProvince?.districts || [];
  const selectedZone = zones.find((zone) => String(zone.id) === String(formData.zone_id));

  const canSubmit = useMemo(
    () => (
      formData.province
      && formData.district
      && formData.zone_id
      && Boolean(formData.severity)
      && formData.description.trim().length >= 10
      && formData.latitude !== ""
      && formData.longitude !== ""
      && (isEditMode ? Boolean(existingImageUrl || formData.photo) : Boolean(formData.photo))
      && !isSubmitting
    ),
    [existingImageUrl, formData, isEditMode, isSubmitting],
  );

  useEffect(() => {
    let ignore = false;

    async function loadGeography() {
      try {
        setGeography(await getPublicGeography());
      } catch (loadError) {
        if (!ignore) setError(backendError(loadError, "Unable to load Nepal geography."));
      } finally {
        if (!ignore) setIsGeographyLoading(false);
      }
    }

    loadGeography();
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (!isEditMode) return;
    let ignore = false;

    async function loadReport() {
      try {
        const reports = await getMyReports();
        const report = reports.find((item) => String(item.id) === String(reportId));
        if (!report) throw new Error("Report not found.");
        if (ignore) return;

        preserveZoneRef.current = true;
        setFormData({
          province: report.province || "",
          district: report.district || "",
          zone_id: report.zone_id ? String(report.zone_id) : "",
          severity: report.severity ? String(report.severity) : "",
          description: report.description || "",
          latitude: report.latitude ?? "",
          longitude: report.longitude ?? "",
          photo: null,
        });
        setExistingImageUrl(report.image_url || "");
      } catch (loadError) {
        if (!ignore) setError(backendError(loadError, "Could not load your report for editing."));
      } finally {
        if (!ignore) setIsReportLoading(false);
      }
    }

    loadReport();
    return () => {
      ignore = true;
    };

  }, [isEditMode, reportId]);
  useEffect(() => {
    let ignore = false;
    const preserveZone = preserveZoneRef.current;
    preserveZoneRef.current = false;
    setZones([]);
    setZoneError("");
    if (!preserveZone) setFormData((current) => ({ ...current, zone_id: "" }));

    if (!formData.province) {
      setIsZonesLoading(false);
      return () => {
        ignore = true;
      };
    }

    setIsZonesLoading(true);
    getReportZones(formData.province)
      .then((nextZones) => {
        if (!ignore) setZones(Array.isArray(nextZones) ? nextZones : []);
      })
      .catch((loadError) => {
        if (!ignore) setZoneError(backendError(loadError, "Unable to load FloodGuard zones."));
      })
      .finally(() => {
        if (!ignore) setIsZonesLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [formData.province]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function updateProvince(value) {
    setFormData((current) => ({ ...current, province: value, district: "", zone_id: "" }));
    setZones([]);
    setZoneError("");
    setFieldErrors((current) => ({ ...current, province: "", district: "", zone_id: "" }));
    setError("");
  }

  function updateDistrict(value) {
    setFormData((current) => ({ ...current, district: value }));
    setFieldErrors((current) => ({ ...current, district: "" }));
    setError("");
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0] || null;

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (file && !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      updateField("photo", null);
      setPreviewUrl("");
      return;
    }

    updateField("photo", file);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setConfirmation(null);

    const nextFieldErrors = {};
    if (!formData.province.trim()) nextFieldErrors.province = "Please select a province.";
    if (!formData.district.trim()) nextFieldErrors.district = "Please select a district.";
    if (!formData.zone_id) nextFieldErrors.zone_id = "Please select a FloodGuard zone.";
    if (!formData.severity) nextFieldErrors.severity = "Please select a severity rating.";
    if (formData.description.trim().length < 10) nextFieldErrors.description = "Description must be at least 10 characters.";
    if (formData.description.length > 2000) nextFieldErrors.description = "Description must be 2000 characters or fewer.";
    if (!isEditMode && !formData.photo) nextFieldErrors.photo = "Please attach a photo of the reported conditions.";

    const latitudeError = validateCoordinate(formData.latitude, -90, 90, "Latitude");
    const longitudeError = validateCoordinate(formData.longitude, -180, 180, "Longitude");
    if (latitudeError) nextFieldErrors.latitude = latitudeError;
    if (longitudeError) nextFieldErrors.longitude = longitudeError;
    if (!latitudeError && !longitudeError && !isWithinNepalOperationalBounds(Number(formData.latitude), Number(formData.longitude))) {
      nextFieldErrors.latitude = "FloodGuard currently accepts incident locations within Nepal.";
      nextFieldErrors.longitude = "FloodGuard currently accepts incident locations within Nepal.";
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0 || !canSubmit) {
      setError("Please correct the highlighted fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const onUploadProgress = (progressEvent) => {
        if (progressEvent.total) {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      };
      const result = isEditMode
        ? await updateReport(reportId, formData, onUploadProgress)
        : await submitReport(formData, onUploadProgress);

      setConfirmation(result);
      if (isEditMode) {
        setExistingImageUrl(result.image_url || existingImageUrl);
        setFormData((current) => ({ ...current, photo: null }));
        setPreviewUrl("");
      } else {
        setFormData(EMPTY_FORM);
        setZones([]);
        setPreviewUrl("");
      }
      setFieldErrors({});
      setUploadProgress(100);
    } catch (submitError) {
      setError(backendError(submitError, "Could not submit your report. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isReportLoading) return <LoadingSpinner message="Loading your report..." />;
  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-4xl rounded-lg border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950">{isEditMode ? "Edit Flood Report" : "Submit Incident Report"}</h1>
          <p className="mt-2 text-sm text-blue-700">
            {isEditMode ? "Update the details below. Your edited report will be reviewed again by FloodGuard administrators." : "Share flood conditions from your area for review by FloodGuard administrators."}
          </p>
        </div>

        <FeedbackMessage message={error} />
        <FeedbackMessage
          message={confirmation ? (isEditMode ? "Report updated successfully. It is pending review again." : "Report submitted successfully. Your report ID is #" + confirmation.id + ".") : ""}
          type="success"
        />

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2 rounded-xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-blue-950">Report location</h2>
              <p className="mt-1 text-sm text-blue-700">Choose the province, district, and FloodGuard zone for this report.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <label className="block text-sm font-medium text-blue-950">
                Province *
                <select
                  value={formData.province}
                  onChange={(event) => updateProvince(event.target.value)}
                  required
                  disabled={isGeographyLoading}
                  className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                >
                  <option value="">{isGeographyLoading ? "Loading provinces..." : "Select province"}</option>
                  {geography?.provinces?.map((province) => (
                    <option key={province.name} value={province.name}>{province.name} Province</option>
                  ))}
                </select>
                {fieldErrors.province && <p className="mt-1 text-xs text-red-600">{fieldErrors.province}</p>}
              </label>

              <label className="block text-sm font-medium text-blue-950">
                District *
                <select
                  value={formData.district}
                  onChange={(event) => updateDistrict(event.target.value)}
                  required
                  disabled={!formData.province || isGeographyLoading}
                  className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                >
                  <option value="">{formData.province ? "Select district" : "Select province first"}</option>
                  {districts.map((district) => (
                    <option key={district.name} value={district.name}>{district.name}</option>
                  ))}
                </select>
                {fieldErrors.district && <p className="mt-1 text-xs text-red-600">{fieldErrors.district}</p>}
              </label>

              <label className="block text-sm font-medium text-blue-950">
                Zone *
                <select
                  value={formData.zone_id}
                  onChange={(event) => updateField("zone_id", event.target.value)}
                  disabled={!formData.province || isZonesLoading}
                  required
                  className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                >
                  <option value="">
                    {isZonesLoading ? "Loading zones..." : zones.length ? "Select zone" : "No FloodGuard zones configured for this province."}
                  </option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>{zone.name || zone.district} ({zone.district})</option>
                  ))}
                </select>
                {fieldErrors.zone_id && <p className="mt-1 text-xs text-red-600">{fieldErrors.zone_id}</p>}
                {zoneError && <p className="mt-1 text-xs text-red-600">{zoneError}</p>}
                {!zoneError && formData.province && !isZonesLoading && !zones.length && (
                  <p className="mt-1 text-xs text-red-600">A configured FloodGuard zone is required before submitting.</p>
                )}
              </label>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-blue-950">Severity *</span>
            <div className="mt-2 flex h-[50px] items-center gap-2 rounded-md border border-blue-200 px-4">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => updateField("severity", rating)}
                  className={`transition ${rating <= formData.severity ? "text-blue-700" : "text-blue-200"}`}
                  aria-label={`Set severity ${rating}`}
                  aria-pressed={rating === Number(formData.severity)}
                >
                  <Star
                    size={28}
                    strokeWidth={2.25}
                    fill={rating <= formData.severity ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>
              ))}
              <span className="ml-auto text-sm font-semibold text-blue-900">{formData.severity || 0}/5</span>
            </div>
            {fieldErrors.severity && <p className="mt-1 text-xs text-red-600">{fieldErrors.severity}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-blue-950">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(event) => updateField("description", event.target.value)}
              required
              maxLength={2000}
              rows={5}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="Describe water level, blocked roads, nearby landmarks, or urgent risks."
            />
            <CharacterCounter value={formData.description} maxLength={2000} minLength={10} />
            {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>}
          </div>

          <div className="md:col-span-2">
            <LocationPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              zones={selectedZone ? [selectedZone] : []}
              onChange={({ latitude, longitude }) => setFormData((current) => ({ ...current, latitude, longitude }))}
              label="Location *"
            />
          </div>

          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-blue-950">
              Latitude *
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={formData.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
              required
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="27.671000"
            />
            {fieldErrors.latitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.latitude}</p>}
          </div>

          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-blue-950">
              Longitude *
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={formData.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
              required
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="84.430500"
            />
            {fieldErrors.longitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.longitude}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="photo" className="block text-sm font-medium text-blue-950">
              {isEditMode ? "Photo (leave blank to keep current)" : "Photo *"}
            </label>
            <input
              id="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoChange}
              required={!isEditMode}
              className="mt-2 block w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-sm text-blue-950 file:mr-4 file:rounded-md file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-800"
            />
            {isEditMode && existingImageUrl && !previewUrl && (
              <img src={existingImageUrl} alt="Current flood report" className="mt-4 h-56 w-full rounded-md object-cover" />
            )}
            {fieldErrors.photo && <p className="mt-1 text-xs text-red-600">{fieldErrors.photo}</p>}
            {previewUrl && (
              <img src={previewUrl} alt="Selected flood report preview" className="mt-4 h-56 w-full rounded-md object-cover" />
            )}
          </div>

          {isSubmitting && (
            <div className="md:col-span-2">
              <div className="h-3 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-blue-700 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="mt-2 text-sm text-blue-700">Uploading {uploadProgress}%</p>
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isSubmitting ? (isEditMode ? "Updating report..." : "Submitting report...") : (isEditMode ? "Update report" : "Submit report")}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
