import { useEffect, useMemo, useState } from "react";

import { submitReport } from "../../api/reports";
import CharacterCounter from "../../components/CharacterCounter";
import FeedbackMessage from "../../components/FeedbackMessage";
import LocationPicker from "../../components/map/LocationPicker";
import { isWithinNepalOperationalBounds } from "../../components/map/mapUtils";
import { backendError, validateCoordinate } from "../../utils/validation";

const DISTRICTS = [
  "Chitwan",
  "Kathmandu",
  "Kaski",
];

export default function SubmitReport() {
  const [formData, setFormData] = useState({
    district: "",
    severity: 3,
    description: "",
    latitude: "",
    longitude: "",
    photo: null,
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const canSubmit = useMemo(
    () => formData.district && formData.description.trim().length >= 10 && !isSubmitting,
    [formData.district, formData.description, isSubmitting]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0] || null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file && !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      updateField("photo", null);
      setPreviewUrl("");
      return;
    }

    updateField("photo", file);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setConfirmation(null);
    const nextFieldErrors = {};
    if (!formData.district.trim()) nextFieldErrors.district = "District is required.";
    if (formData.description.trim().length < 10) nextFieldErrors.description = "Description must be at least 10 characters.";
    if (formData.description.length > 2000) nextFieldErrors.description = "Description must be 2000 characters or fewer.";
    const latitudeError = validateCoordinate(formData.latitude, -90, 90, "Latitude");
    const longitudeError = validateCoordinate(formData.longitude, -180, 180, "Longitude");
    if (latitudeError) nextFieldErrors.latitude = latitudeError;
    if (longitudeError) nextFieldErrors.longitude = longitudeError;
    const hasLatitude = String(formData.latitude).trim() !== "";
    const hasLongitude = String(formData.longitude).trim() !== "";
    if (hasLatitude !== hasLongitude) {
      nextFieldErrors.latitude = "Provide both latitude and longitude, or leave both empty.";
      nextFieldErrors.longitude = "Provide both latitude and longitude, or leave both empty.";
    } else if (hasLatitude && !latitudeError && !longitudeError && !isWithinNepalOperationalBounds(Number(formData.latitude), Number(formData.longitude))) {
      nextFieldErrors.latitude = "Report location must be within Nepal.";
      nextFieldErrors.longitude = "Report location must be within Nepal.";
    }
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0 || !canSubmit) {
      setError("Please correct the highlighted fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const result = await submitReport(formData, (progressEvent) => {
        if (progressEvent.total) {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });

      setConfirmation(result);
      setFormData({
        district: "",
        severity: 3,
        description: "",
        latitude: "",
        longitude: "",
        photo: null,
      });
      setPreviewUrl("");
      setFieldErrors({});
      setUploadProgress(100);
    } catch (err) {
      setError(backendError(err, "Could not submit your report. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-10">
      <section className="mx-auto max-w-4xl rounded-lg border border-blue-100 bg-white p-6 shadow-xl shadow-blue-100 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950">Submit Incident Report</h1>
          <p className="mt-2 text-sm text-blue-700">
            Share flood conditions from your area for review by FloodGuard administrators.
          </p>
        </div>

        <FeedbackMessage message={error} />
        <FeedbackMessage
          message={confirmation ? "Report submitted successfully. Your report ID is #" + confirmation.id + "." : ""}
          type="success"
        />

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="district" className="block text-sm font-medium text-blue-950">
              District
            </label>
            <select
              id="district"
              value={formData.district}
              onChange={(event) => updateField("district", event.target.value)}
              required
              className="mt-2 w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Select district</option>
              {DISTRICTS.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium text-blue-950">Severity</span>
            <div className="mt-2 flex h-[50px] items-center gap-2 rounded-md border border-blue-200 px-4">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => updateField("severity", rating)}
                  className={`text-3xl leading-none transition ${
                    rating <= formData.severity ? "text-blue-700" : "text-blue-200"
                  }`}
                  aria-label={`Set severity ${rating}`}
                >
                  ★
                </button>
              ))}
              <span className="ml-auto text-sm font-semibold text-blue-900">
                {formData.severity}/5
              </span>
            </div>
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

          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-blue-950">
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              value={formData.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="27.671000"
            />
            <p className="mt-1 text-xs text-blue-700">Valid range: -90 to 90</p>
            {fieldErrors.latitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.latitude}</p>}
          </div>

          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-blue-950">
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              value={formData.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="84.430500"
            />
            <p className="mt-1 text-xs text-blue-700">Valid range: -180 to 180</p>
            {fieldErrors.longitude && <p className="mt-1 text-xs text-red-600">{fieldErrors.longitude}</p>}
          </div>

          <div className="md:col-span-2">
            <LocationPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              onChange={({ latitude, longitude }) => setFormData((current) => ({ ...current, latitude, longitude }))}
              label="Incident location"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="photo" className="block text-sm font-medium text-blue-950">
              Photo
            </label>
            <input
              id="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoChange}
              className="mt-2 block w-full rounded-md border border-blue-200 bg-white px-4 py-3 text-sm text-blue-950 file:mr-4 file:rounded-md file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-800"
            />
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Selected flood report preview"
                className="mt-4 h-56 w-full rounded-md object-cover"
              />
            )}
          </div>

          {isSubmitting && (
            <div className="md:col-span-2">
              <div className="h-3 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-700 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
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
              {isSubmitting ? "Submitting report..." : "Submit report"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
