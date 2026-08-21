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

export async function getZone(zoneId) {
  const response = await api.get(`/admin/zones/${zoneId}`);
  return response.data;
}

export async function updateZone(zoneId, zoneData) {
  const response = await api.put(`/admin/zones/${zoneId}`, zoneData);
  return response.data;
}

export async function deleteZone(zoneId) {
  const response = await api.delete(`/admin/zones/${zoneId}`);
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

export async function getUser(userId) {
  const response = await api.get(`/admin/users/${userId}`);
  return response.data;
}

export async function createUser(userData) {
  const response = await api.post("/admin/users", userData);
  return response.data;
}

export async function updateUser(userId, userData) {
  const response = await api.put(`/admin/users/${userId}`, userData);
  return response.data;
}

export async function resetUserPassword(userId, password) {
  const response = await api.post(`/admin/users/${userId}/reset-password`, { password });
  return response.data;
}

export async function deleteUser(userId) {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
}
