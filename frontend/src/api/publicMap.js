import api from "./axios";

export async function getPublicMapOverview() {
  const response = await api.get("/public/map");
  return response.data;
}
