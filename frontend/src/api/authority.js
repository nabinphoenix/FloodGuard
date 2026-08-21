import api from "./axios";

export async function getAuthorityDashboard() {
  const response = await api.get("/authority/dashboard");
  return response.data;
}

export async function getAuthorityZones() {
  const response = await api.get("/authority/zones");
  return response.data;
}

export async function getAuthorityReports({ status = "", district = "", page = 1, limit = 20 } = {}) {
  const response = await api.get("/authority/reports", {
    params: {
      status: status || undefined,
      district: district || undefined,
      page,
      limit,
    },
  });
  return response.data;
}

export async function approveReport(reportId) {
  const response = await api.put(`/authority/reports/${reportId}/approve`);
  return response.data;
}

export async function rejectReport(reportId, reason) {
  const response = await api.put(`/authority/reports/${reportId}/reject`, { reason });
  return response.data;
}

export async function broadcastAlert(alertData) {
  const response = await api.post("/authority/broadcast-alert", alertData);
  return response.data;
}
