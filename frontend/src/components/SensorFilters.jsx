import { Filter } from "lucide-react";

export function filterStations(stations, filters) {
  return stations.filter((station) => {
    if (filters.province && station.province !== filters.province) return false;
    if (filters.district && station.district !== filters.district) return false;
    if (filters.river_basin && station.river_basin !== filters.river_basin) return false;
    if (filters.river && station.river_name !== filters.river) return false;
    if (filters.station && station.id !== filters.station) return false;
    return true;
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function SelectFilter({ label, value, onChange, options, emptyLabel, allLabel, disabled = false }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-secondary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        disabled={disabled}
        className="w-full rounded-lg border border-ink-border bg-white px-3 py-2.5 text-sm font-semibold text-ink-primary outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <option value="">{allLabel || "All " + label + "s"}</option>
        {options.length === 0 ? (
          <option value="" disabled>{emptyLabel}</option>
        ) : (
          options.map((option) => (
            <option key={option.value || option} value={option.value || option}>
              {option.label || option}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

export default function SensorFilters({ stations, filters, onChange, geography = null }) {
  const provinceStations = filters.province
    ? stations.filter((station) => station.province === filters.province)
    : stations;
  const districtStations = filters.district
    ? provinceStations.filter((station) => station.district === filters.district)
    : provinceStations;
  const basinStations = filters.river_basin
    ? districtStations.filter((station) => station.river_basin === filters.river_basin)
    : districtStations;
  const riverStations = filters.river
    ? basinStations.filter((station) => station.river_name === filters.river)
    : basinStations;

  const geographyProvinces = geography?.provinces || [];
  const selectedProvince = geographyProvinces.find((province) => province.name === filters.province);
  const provinces = geographyProvinces.length
    ? geographyProvinces.map((province) => province.name)
    : unique(stations.map((station) => station.province));
  const districts = geographyProvinces.length
    ? (selectedProvince?.districts || []).map((district) => district.name)
    : unique(provinceStations.map((station) => station.district));
  const basins = unique(districtStations.map((station) => station.river_basin));
  const rivers = unique(basinStations.map((station) => station.river_name));
  const stationOptions = riverStations.map((station) => ({
    value: station.id,
    label: station.id + " — " + station.name,
  }));

  return (
    <section className="mb-8 rounded-xl border border-ink-border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-ink-secondary">
        <Filter size={18} />
        <h2 className="text-sm font-bold uppercase tracking-wider">Sensor filters</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SelectFilter label="Province" value={filters.province} onChange={(value) => onChange("province", value)} options={provinces} emptyLabel="No provinces available" />
        <SelectFilter label="District" value={filters.district} onChange={(value) => onChange("district", value)} options={districts} emptyLabel={filters.province ? "No districts available" : "Select a province first"} allLabel={geographyProvinces.length && !filters.province ? "Select province first" : undefined} disabled={Boolean(geographyProvinces.length && !filters.province)} />
        <SelectFilter label="River Basin" value={filters.river_basin} onChange={(value) => onChange("river_basin", value)} options={basins} emptyLabel="No basins available" />
        <SelectFilter label="River" value={filters.river} onChange={(value) => onChange("river", value)} options={rivers} emptyLabel="No rivers available" />
        <SelectFilter label="Station" value={filters.station} onChange={(value) => onChange("station", value)} options={stationOptions} emptyLabel="No stations configured" />
      </div>
    </section>
  );
}
