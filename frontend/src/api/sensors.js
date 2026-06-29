import api from "./axios";

export async function getLiveReadings() {
  const response = await api.get("/sensors/live");
  return response.data;
}

export async function getStations() {
  const response = await api.get("/sensors/stations");
  return response.data;
}

export async function getStationHistory(stationId, limit = 48) {
  const response = await api.get(`/sensors/history/${stationId}`, {
    params: { limit },
  });
  return response.data;
}

export async function updateThresholds(stationId, thresholds) {
  const response = await api.put(`/sensors/stations/${stationId}/thresholds`, thresholds);
  return response.data;
}

export async function getSensorHealth() {
  const response = await api.get("/sensors/health");
  return response.data;
}
