import api from "./axios";

export async function getAlertZones() {
  const response = await api.get("/public/alerts");
  return response.data;
}

export async function getAlertByDistrict(district) {
  const response = await api.get(`/public/alerts/${encodeURIComponent(district)}`);
  return response.data;
}

export async function getAlertHistory() {
  const response = await api.get("/public/alerts/history");
  return response.data;
}

export async function getMapZones() {
  const response = await api.get("/public/zones");
  return response.data;
}

export async function getPublicStats() {
  const response = await api.get("/public/stats");
  return response.data;
}
