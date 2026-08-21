import api from "./axios";

export async function getFloodSummary() {
  const response = await api.get("/history/floods/summary");
  return response.data;
}

export async function getAnnualFloods(params = {}) {
  const response = await api.get("/history/floods/annual", { params });
  return response.data;
}

export async function getFloodEvents(params = {}) {
  const response = await api.get("/history/floods/events", { params });
  return response.data;
}

export async function getHistoryGeography(params = {}) {
  const response = await api.get("/history/geography", { params });
  return response.data;
}

export async function getHistoryBasins() {
  const response = await api.get("/history/basins");
  return response.data;
}

export async function getHistorySources() {
  const response = await api.get("/history/sources");
  return response.data;
}
