import { useEffect, useMemo, useState } from "react";

import { submitReport } from "../../api/reports";

const DISTRICTS = [
  "Kuala Lumpur",
  "Selangor",
  "Johor",
  "Kelantan",
  "Penang",
  "Perak",
  "Kedah",
  "Pahang",
  "Terengganu",
  "Negeri Sembilan",
  "Melaka",
  "Perlis",
  "Sabah",
  "Sarawak",
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
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

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

  function fillCurrentLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateField("latitude", position.coords.latitude.toFixed(6));
        updateField("longitude", position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setError("Could not get your location. Please enter it manually.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setConfirmation(null);

    if (!canSubmit) {
      setError("Please select a district and enter at least 10 characters.");
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
      setUploadProgress(100);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not submit your report. Please try again.");
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

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {confirmation && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Report submitted successfully. Your report ID is{" "}
            <span className="font-semibold">#{confirmation.id}</span>.
          </div>
        )}

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
              rows={5}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="Describe water level, blocked roads, nearby landmarks, or urgent risks."
            />
          </div>

          <div>
            <label htmlFor="latitude" className="block text-sm font-medium text-blue-950">
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="3.139000"
            />
          </div>

          <div>
            <label htmlFor="longitude" className="block text-sm font-medium text-blue-950">
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
              className="mt-2 w-full rounded-md border border-blue-200 px-4 py-3 text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
              placeholder="101.686900"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={fillCurrentLocation}
              disabled={isLocating}
              className="rounded-md border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocating ? "Getting location..." : "Use my current location"}
            </button>
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
