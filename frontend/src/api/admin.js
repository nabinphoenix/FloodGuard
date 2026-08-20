import api from "./axios";

export async function getDashboard() {
  const response = await api.get("/admin/dashboard");
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

export async function getUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function updateUserRole(userId, role) {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
}
