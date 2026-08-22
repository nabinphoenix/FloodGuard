export const DEFAULT_MAP_CENTER = [28.3949, 84.124];
export const DEFAULT_MAP_ZOOM = 7;

export const MAP_STATUS_COLORS = {
  safe: "#16a34a",
  watch: "#ca8a04",
  warning: "#ea580c",
  emergency: "#dc2626",
  no_data: "#64748b",
  report: "#2563eb",
  alert: "#be123c",
};

export function getMapTileConfig() {
  const provider = String(import.meta.env.VITE_MAP_PROVIDER || "osm").toLowerCase();
  const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY;

  if (provider === "maptiler" && mapTilerKey) {
    return {
      url: `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>',
    };
  }

  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };
}
