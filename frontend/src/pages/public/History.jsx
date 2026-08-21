import { BookOpen, CircleAlert, Filter, History as HistoryIcon, Landmark, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getAnnualFloods,
  getFloodEvents,
  getFloodSummary,
  getHistoryBasins,
  getHistoryGeography,
  getHistorySources,
} from "../../api/history";
import FeedbackMessage from "../../components/FeedbackMessage";
import LoadingSpinner from "../../components/LoadingSpinner";

const tabs = [
  ["overview", "Overview"],
  ["annual", "Annual Statistics"],
  ["geography", "Provinces & Districts"],
  ["basins", "River Basins"],
  ["events", "Major Flood Events"],
  ["sources", "Data Sources & Limitations"],
];

function number(value) {
  return new Intl.NumberFormat("en-NP").format(value ?? 0);
}

function money(value) {
  return "NPR " + new Intl.NumberFormat("en-NP").format(value ?? 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function SummaryCard({ label, value, icon: Icon, accent }) {
  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className={"mb-4 flex h-11 w-11 items-center justify-center rounded-xl " + accent}>
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-blue-950">{number(value)}</p>
    </article>
  );
}

function SelectBox({ label, value, onChange, options, allLabel }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-blue-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200">
        <option value="">{allLabel || "All " + label + "s"}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function NoHistory({ message = "No historical records are available for this selection in the current dataset." }) {
  return <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-8 text-center text-sm font-medium text-blue-800">{message}</div>;
}

export default function History() {
  const [summary, setSummary] = useState(null);
  const [annual, setAnnual] = useState([]);
  const [events, setEvents] = useState([]);
  const [geography, setGeography] = useState(null);
  const [basins, setBasins] = useState([]);
  const [sources, setSources] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [basin, setBasin] = useState("");
  const [river, setRiver] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const [summaryData, annualData, eventData, geographyData, basinData, sourceData] = await Promise.all([
          getFloodSummary(),
          getAnnualFloods(),
          getFloodEvents(),
          getHistoryGeography(),
          getHistoryBasins(),
          getHistorySources(),
        ]);
        setSummary(summaryData);
        setAnnual(annualData.records || []);
        setEvents(eventData.events || []);
        setGeography(geographyData);
        setBasins(basinData.basins || []);
        setSources(sourceData);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not load Nepal flood history.");
      } finally {
        setIsLoading(false);
      }
    }
    loadHistory();
  }, []);

  const years = useMemo(() => annual.map((record) => String(record.year)), [annual]);
  const selectedProvince = geography?.provinces?.find((item) => item.name === province);
  const districtOptions = selectedProvince?.districts?.map((item) => item.name) || [];
  const selectedDistrict = selectedProvince?.districts?.find((item) => item.name === district);
  const basinOptions = selectedDistrict?.river_basins?.length
    ? selectedDistrict.river_basins
    : selectedProvince
      ? unique(selectedProvince.districts.flatMap((item) => item.river_basins || []))
      : geography?.river_basins || [];
  const selectedBasin = basins.find((item) => item.name === basin);
  const riverOptions = selectedDistrict?.rivers?.length
    ? selectedDistrict.rivers
    : basin
      ? selectedBasin?.important_rivers || []
      : selectedProvince
        ? unique(selectedProvince.districts.flatMap((item) => item.rivers || []))
        : geography?.rivers || [];

  const filteredAnnual = annual.filter((record) => {
    if (startYear && record.year < Number(startYear)) return false;
    if (endYear && record.year > Number(endYear)) return false;
    return true;
  });

  const relevantEvents = events.filter((event) => {
    if (district && !event.areas.some((area) => area.toLocaleLowerCase().includes(district.toLocaleLowerCase()))) return false;
    if (basin && !event.river_basins.includes(basin)) return false;
    if (river && !event.rivers.includes(river)) return false;
    return true;
  });

  function changeProvince(value) {
    setProvince(value);
    setDistrict("");
    setBasin("");
    setRiver("");
  }

  function changeDistrict(value) {
    setDistrict(value);
    setBasin("");
    setRiver("");
  }

  function changeBasin(value) {
    setBasin(value);
    setRiver("");
  }

  if (isLoading) return <LoadingSpinner message="Loading Nepal flood history..." />;

  return (
    <main className="min-h-screen bg-blue-50 pb-16">
      <section className="bg-gradient-to-r from-brand to-brand-gradientEnd px-4 py-12 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3 text-blue-100"><BookOpen size={22} /><span className="text-sm font-bold uppercase tracking-wider">Public research explorer</span></div>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Nepal Flood History</h1>
          <p className="mt-4 max-w-3xl text-lg text-blue-100">Explore documented flood incidents, impacts, affected regions, river systems and major historical flood events across Nepal.</p>
          <p className="mt-4 text-sm font-semibold text-blue-100">Historical data describes past events. It is separate from FloodGuard live sensor readings.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {error && <div className="mt-8"><FeedbackMessage message={error} /></div>}

        <div className="mt-8 flex gap-2 overflow-x-auto rounded-xl border border-blue-100 bg-white p-2 shadow-sm">
          {tabs.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setActiveTab(value)} className={"shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold transition " + (activeTab === value ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-blue-50")}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <section className="mt-8">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-blue-950">Flood history in Nepal</h2>
              <p className="mt-2 text-slate-600">National annual totals for {summary?.period}. These figures are not all-time totals and are not province-level allocations.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Flood incidents" value={summary?.flood_incidents} icon={CircleAlert} accent="bg-orange-100 text-orange-700" />
              <SummaryCard label="Deaths" value={summary?.deaths} icon={Landmark} accent="bg-red-100 text-red-700" />
              <SummaryCard label="Missing" value={summary?.missing} icon={HistoryIcon} accent="bg-yellow-100 text-yellow-700" />
              <SummaryCard label="Affected families" value={summary?.affected_families} icon={Waves} accent="bg-blue-100 text-blue-700" />
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {[2017, 2013, 2014].map((year) => {
                const record = annual.find((item) => item.year === year);
                return (
                  <article key={year} className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
                    <p className="text-sm font-bold uppercase tracking-wide text-brand">{year} highlight</p>
                    <p className="mt-4 text-2xl font-black text-blue-950">{number(record?.flood_incidents)} incidents</p>
                    <p className="mt-2 text-slate-600">{number(record?.deaths)} deaths · {number(record?.affected_families)} affected families</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "annual" && (
          <section className="mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-blue-950">Annual national statistics</h2>
              <p className="mt-2 text-slate-600">The available annual series covers 2011–2023. Geography filters are intentionally not applied because province-level annual totals are unavailable.</p>
            </div>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <SelectBox label="Start year" value={startYear} onChange={setStartYear} options={years} allLabel="All years" />
              <SelectBox label="End year" value={endYear} onChange={setEndYear} options={years} allLabel="All years" />
            </div>
            {filteredAnnual.length === 0 ? <NoHistory /> : (
              <div className="overflow-x-auto rounded-xl border border-blue-100 bg-white shadow-sm">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-blue-50 text-xs uppercase tracking-wide text-blue-900">
                    <tr><th className="px-4 py-3">Year</th><th className="px-4 py-3">Flood incidents</th><th className="px-4 py-3">Deaths</th><th className="px-4 py-3">Missing</th><th className="px-4 py-3">Injured</th><th className="px-4 py-3">Affected families</th><th className="px-4 py-3">Estimated loss (NPR)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {filteredAnnual.map((record) => <tr key={record.year} className="text-slate-700"><td className="px-4 py-3 font-bold text-blue-950">{record.year}</td><td className="px-4 py-3">{number(record.flood_incidents)}</td><td className="px-4 py-3">{number(record.deaths)}</td><td className="px-4 py-3">{number(record.missing)}</td><td className="px-4 py-3">{number(record.injured)}</td><td className="px-4 py-3">{number(record.affected_families)}</td><td className="px-4 py-3 whitespace-nowrap">{money(record.estimated_loss_npr)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === "geography" && (
          <section className="mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-blue-950">Provinces, districts and rivers</h2>
              <p className="mt-2 text-slate-600">This reference represents the current flood research dataset, not all 77 districts and not province-level annual totals.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <SelectBox label="Province" value={province} onChange={changeProvince} options={(geography?.provinces || []).map((item) => item.name)} allLabel="All Provinces" />
              <SelectBox label="District" value={district} onChange={changeDistrict} options={districtOptions} allLabel={province ? "All Districts" : "Choose a province first"} />
              <SelectBox label="River basin" value={basin} onChange={changeBasin} options={basinOptions} allLabel="All Basins" />
              <SelectBox label="River" value={river} onChange={setRiver} options={riverOptions} allLabel="All Rivers" />
            </div>

            {!province ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(geography?.provinces || []).map((item) => <article key={item.name} className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm"><h3 className="text-lg font-black text-blue-950">{item.name}</h3><p className="mt-2 text-sm text-slate-600">{item.districts.length} represented district(s)</p></article>)}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-black text-blue-950">{province}</h3>
                {district ? (
                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">District</p><p className="mt-1 text-lg font-bold text-blue-950">{selectedDistrict?.name}</p><p className="mt-1 text-sm text-slate-600">{selectedDistrict?.ecological_region}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Flood-related rivers</p><p className="mt-1 text-sm font-semibold text-slate-700">{selectedDistrict?.rivers?.join(", ") || "No rivers available"}</p></div>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Major basin</p><p className="mt-1 text-sm font-semibold text-slate-700">{selectedDistrict?.river_basins?.join(", ") || "No basin recorded"}</p></div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedProvince?.districts?.map((item) => <article key={item.name} className="rounded-lg bg-blue-50 p-4"><h4 className="font-bold text-blue-950">{item.name}</h4><p className="mt-1 text-sm text-slate-600">{item.rivers.join(", ") || "No rivers available"}</p></article>)}
                  </div>
                )}
                <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-900">Province-level annual totals are not available in the current dataset.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === "basins" && (
          <section className="mt-8">
            <div className="mb-6"><h2 className="text-2xl font-black text-blue-950">River basins</h2><p className="mt-2 text-slate-600">Curated river-system context for flood exploration.</p></div>
            <div className="mb-6 max-w-md"><SelectBox label="River basin" value={basin} onChange={changeBasin} options={basins.map((item) => item.name)} allLabel="Choose a basin" /></div>
            {selectedBasin ? (
              <article className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
                <h3 className="text-2xl font-black text-blue-950">{selectedBasin.name}</h3>
                <p className="mt-4 text-slate-700">{selectedBasin.flood_characteristics}</p>
                <div className="mt-6 grid gap-5 md:grid-cols-2"><div><h4 className="font-bold text-blue-950">Important rivers</h4><p className="mt-2 text-sm text-slate-600">{selectedBasin.important_rivers.join(", ")}</p></div><div><h4 className="font-bold text-blue-950">Commonly affected districts</h4><p className="mt-2 text-sm text-slate-600">{selectedBasin.commonly_affected_districts.join(", ")}</p></div></div>
              </article>
            ) : <NoHistory message="Choose a basin to explore its rivers, districts and flood characteristics." />}
          </section>
        )}

        {activeTab === "events" && (
          <section className="mt-8">
            <div className="mb-6"><h2 className="text-2xl font-black text-blue-950">Major historical flood events</h2><p className="mt-2 text-slate-600">Only supplied event context is shown; unavailable impacts are not estimated.</p></div>
            <div className="grid gap-5 md:grid-cols-2">
              {relevantEvents.map((event) => <article key={event.year + event.event} className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><h3 className="text-lg font-black text-blue-950">{event.event}</h3><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">{event.year}</span></div><p className="mt-4 text-sm text-slate-600"><strong>Areas:</strong> {event.areas.join(", ")}</p>{event.available_impact && <p className="mt-3 text-sm text-slate-700"><strong>Available impact:</strong> {event.available_impact}</p>}{event.notes && <p className="mt-3 text-sm text-slate-700"><strong>Note:</strong> {event.notes}</p>}</article>)}
            </div>
            {relevantEvents.length === 0 && <NoHistory />}
          </section>
        )}

        {activeTab === "sources" && (
          <section className="mt-8">
            <div className="mb-6"><h2 className="text-2xl font-black text-blue-950">Data Sources & Limitations</h2><p className="mt-2 text-slate-600">Read this context before interpreting the historical series.</p></div>
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm"><h3 className="font-black text-blue-950">Sources</h3><div className="mt-4 space-y-4">{(sources?.sources || []).map((item) => <div key={item.source + item.period}><p className="font-bold text-slate-800">{item.source} · {item.period}</p><p className="mt-1 text-sm text-slate-600">{item.notes}</p></div>)}</div></article>
              <article className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm"><h3 className="font-black text-blue-950">Limitations</h3><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{(sources?.limitations || []).map((item) => <li key={item}>{item}</li>)}</ul></article>
            </div>
            {sources?.long_term_context && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950"><strong>Separate long-term context:</strong> DesInventar reports {number(sources.long_term_context.flood_records)} records for {sources.long_term_context.period}. This is not added to the {summary?.period} series.</div>}
          </section>
        )}

        <div className="mt-10 rounded-xl border border-blue-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <strong className="text-blue-950">Historical data note:</strong> These curated research records are separate from current sensor levels, station thresholds, SQS health and operational alerts.
        </div>
      </div>
    </main>
  );
}
