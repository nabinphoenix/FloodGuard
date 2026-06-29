import api from "./axios";

export async function getDashboard() {
  const response = await api.get("/admin/dashboard");
  return response.data;
}

export async function getAdminReports({ status = "", district = "", page = 1, limit = 20 } = {}) {
  const response = await api.get("/admin/reports", {
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
  const response = await api.put(`/admin/reports/${reportId}/approve`);
  return response.data;
}

export async function rejectReport(reportId, reason) {
  const response = await api.put(`/admin/reports/${reportId}/reject`, { reason });
  return response.data;
}

export async function getZones() {
  const response = await api.get("/admin/zones");
  return response.data;
}

export async function createZone(zoneData) {
  const response = await api.post("/admin/zones", zoneData);
  return response.data;
}

export async function broadcastAlert(alertData) {
  const response = await api.post("/admin/broadcast-alert", alertData);
  return response.data;
}

export async function getUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function updateUserRole(userId, role) {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
}
