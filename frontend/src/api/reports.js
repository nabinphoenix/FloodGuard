import api from "./axios";

export async function submitReport(reportData, onUploadProgress) {
  const formData = new FormData();

  formData.append("district", reportData.district);
  formData.append("severity", String(reportData.severity));
  formData.append("description", reportData.description);

  if (reportData.latitude !== "" && reportData.latitude !== null && reportData.latitude !== undefined) {
    formData.append("latitude", String(reportData.latitude));
  }

  if (reportData.longitude !== "" && reportData.longitude !== null && reportData.longitude !== undefined) {
    formData.append("longitude", String(reportData.longitude));
  }

  if (reportData.photo) {
    formData.append("photo", reportData.photo);
  }

  const response = await api.post("/reports/submit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

  return response.data;
}

export async function getCommunityReports({ page = 1, limit = 9, district = "", severity = "" } = {}) {
  const response = await api.get("/reports/community", {
    params: {
      page,
      limit,
      district: district || undefined,
      severity: severity || undefined,
    },
  });

  return response.data;
}

export async function getMyReports() {
  const response = await api.get("/reports/my-reports");
  return response.data;
}

export async function getReport(reportId) {
  const response = await api.get(`/reports/${reportId}`);
  return response.data;
}

export async function markHelpful(reportId) {
  const response = await api.post(`/reports/${reportId}/helpful`);
  return response.data;
}
