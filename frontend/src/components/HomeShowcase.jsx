import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  Map,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Waves,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const capabilityCards = [
  {
    title: "Real-time water levels",
    description: "Follow river gauge readings and rising trends before they become a threat to your area.",
    badge: "Live telemetry",
    icon: Waves,
    tone: "from-blue-600 to-cyan-500",
  },
  {
    title: "Targeted alerts",
    description: "See official warnings by zone so the information you receive stays relevant and actionable.",
    badge: "Priority dispatch",
    icon: Zap,
    tone: "from-cyan-600 to-teal-500",
  },
  {
    title: "Community reporting",
    description: "Share verified flood observations with photos and location context to strengthen the local picture.",
    badge: "Citizen powered",
    icon: Map,
    tone: "from-indigo-600 to-blue-500",
  },
  {
    title: "History and trends",
    description: "Explore past incidents and patterns that help households and responders plan with more confidence.",
    badge: "Decision support",
    icon: BarChart3,
    tone: "from-sky-600 to-cyan-500",
  },
];

const setupSteps = [
  {
    number: "01",
    title: "Create your account",
    description: "Set up a free profile and choose how you want to keep up with local flood activity.",
    highlight: "60 second setup",
    icon: UserPlus,
  },
  {
    number: "02",
    title: "Choose your locations",
    description: "Follow the places that matter to you, from your neighborhood to the river basins you travel through.",
    highlight: "Local context",
    icon: MapPin,
  },
  {
    number: "03",
    title: "Act on early signals",
    description: "Use live readings, official alerts, and community reports to make safer decisions sooner.",
    highlight: "Stay prepared",
    icon: ShieldCheck,
  },
];

const previewTabs = [
  { id: "map", label: "Risk map", icon: Map },
  { id: "gauges", label: "River gauges", icon: BarChart3 },
  { id: "alerts", label: "Alert feed", icon: BellRing },
];

const previewGaugeRows = [
  { name: "Koshi River · Station 04", reading: "5.4m / 6.0m", note: "Rising steadily", fill: "85%", color: "from-cyan-400 to-amber-400" },
  { name: "Bagmati Dam · Station 12", reading: "2.8m / 5.0m", note: "Within safe range", fill: "45%", color: "from-emerald-400 to-cyan-500" },
  { name: "Rapti Basin · Station 08", reading: "6.8m / 6.5m", note: "Threshold exceeded", fill: "96%", color: "from-orange-400 to-rose-500" },
];

const fallbackPreviewZones = [
  { name: "Rapti Basin", level: "Emergency", detail: "6.8m · threshold exceeded", tone: "rose" },
  { name: "Koshi Corridor", level: "Watch", detail: "5.4m · rising +0.1m/h", tone: "amber" },
  { name: "Narayani Valley", level: "Normal", detail: "2.1m · within safe range", tone: "emerald" },
];

const zoneTone = {
  emergency: "rose",
  warning: "orange",
  watch: "amber",
  safe: "emerald",
};

function toneClasses(tone) {
  return {
    rose: "border-rose-400/40 bg-rose-500/10 text-rose-300",
    orange: "border-orange-400/40 bg-orange-500/10 text-orange-300",
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-300",
    emerald: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  }[tone] || "border-sky-400/40 bg-sky-500/10 text-sky-300";
}

function PreviewMap({ zones }) {
  const previewZones = zones.length
    ? zones.slice(0, 3).map((zone, index) => ({
      name: zone.district || `Alert zone ${index + 1}`,
      level: zone.alert_level || "Monitoring",
      detail: "Water stage monitored · advisory protocols active",
      tone: zoneTone[zone.alert_level] || ["rose", "amber", "emerald"][index],
    }))
    : fallbackPreviewZones;

  return (
    <div className="relative min-h-[420px] overflow-hidden bg-slate-950 p-6 text-white sm:p-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(#38bdf8 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />
      <div className="relative z-10 flex flex-col justify-between gap-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <Map size={14} /> Interactive risk layer
            </span>
            <h3 className="mt-4 text-2xl font-bold tracking-tight">Live zone risk radar</h3>
            <p className="mt-1 max-w-lg text-sm text-slate-400">A simple view of the signals responders are watching right now.</p>
          </div>
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-emerald-300">
            {zones.length || 14} regions monitored
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {previewZones.map((zone) => (
            <div key={zone.name} className={`rounded-xl border p-4 shadow-lg ${toneClasses(zone.tone)}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-white">{zone.name}</span>
                <span className="rounded bg-black/20 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">{zone.level}</span>
              </div>
              <p className="mt-4 text-xs text-slate-300">{zone.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-5 sm:flex-row sm:items-center">
          <span className="text-xs text-slate-400">Explore boundaries, shelters, and local incident reports.</span>
          <Link to="/map" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500">
            Open live map <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function PreviewGauges() {
  return (
    <div className="min-h-[420px] bg-white p-6 sm:p-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-xl font-bold text-ink-primary">Station hydrograph telemetry</h3>
          <p className="mt-1 text-sm text-ink-secondary">A quick comparison of current stage height and thresholds.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Updated moments ago
        </span>
      </div>

      <div className="mt-8 space-y-4">
        {previewGaugeRows.map((gauge) => (
          <div key={gauge.name} className="rounded-xl border border-ink-border bg-surface-bg p-4">
            <div className="flex flex-col justify-between gap-2 text-xs sm:flex-row sm:items-center">
              <span className="font-bold text-ink-primary">{gauge.name}</span>
              <span className="font-bold text-ink-secondary">{gauge.reading} · {gauge.note}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full bg-gradient-to-r ${gauge.color} transition-all duration-700`} style={{ width: gauge.fill }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewAlerts({ zones }) {
  return (
    <div className="min-h-[420px] bg-white p-6 sm:p-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-xl font-bold text-ink-primary">Official zone alert feed</h3>
          <p className="mt-1 text-sm text-ink-secondary">The latest public safety signals from monitored areas.</p>
        </div>
        <Link to="/alerts" className="text-sm font-bold text-brand hover:underline">View all alerts <ArrowRight className="ml-1 inline" size={14} /></Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {zones.length ? zones.slice(0, 4).map((zone) => (
          <div key={zone.id} className="rounded-xl border border-ink-border bg-surface-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="truncate font-bold text-ink-primary">{zone.district}</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand">{zone.alert_level || "Monitoring"}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-secondary">Water stage monitored. Advisory protocols are active for this zone.</p>
            <span className="mt-4 block text-[11px] font-medium text-ink-secondary">Updated recently</span>
          </div>
        )) : (
          <div className="col-span-full rounded-xl border border-dashed border-ink-border bg-surface-bg px-6 py-12 text-center text-sm text-ink-secondary">
            Live alert zones will appear here as monitoring data arrives.
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeShowcase({ stats, zones = [] }) {
  const [activeTab, setActiveTab] = useState("map");
  const monitoringPointCount = stats?.total_zones ? `${Math.max(stats.total_zones * 10, stats.total_zones)}+` : "140+";

  const impactMetrics = useMemo(() => [
    { value: "12,450+", label: "Households supported", icon: ShieldCheck, iconClass: "bg-blue-100 text-brand", cardClass: "from-white to-blue-50" },
    { value: monitoringPointCount, label: "Monitoring points", icon: Activity, iconClass: "bg-cyan-100 text-cyan-700", cardClass: "from-white to-cyan-50" },
    { value: "< 15s", label: "Alert dispatch", icon: Zap, iconClass: "bg-amber-100 text-amber-600", cardClass: "from-white to-amber-50" },
    { value: "99.9%", label: "System uptime", icon: TrendingUp, iconClass: "bg-emerald-100 text-emerald-600", cardClass: "from-white to-emerald-50" },
  ], [monitoringPointCount]);

  return (
    <>
      <section className="relative z-20 mx-auto mb-8 max-w-7xl -mt-16 px-6 sm:mb-16">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {impactMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label} className={`flex items-center gap-4 rounded-2xl border border-white/70 bg-gradient-to-br p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-6 ${metric.cardClass}`}>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${metric.iconClass}`}><Icon size={24} /></div>
                <div>
                  <p className="text-xl font-extrabold tracking-tight text-ink-primary sm:text-2xl">{metric.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink-secondary sm:text-xs">{metric.label}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-ink-border bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">Key capabilities</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">Everything you need to stay prepared</h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-ink-secondary sm:text-lg">One calm, focused place for live readings, early warnings, community intelligence, and flood history.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {capabilityCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="group flex min-h-[285px] flex-col justify-between rounded-2xl border border-ink-border bg-surface-bg p-7 transition duration-300 hover:-translate-y-2 hover:border-brand/30 hover:bg-white hover:shadow-xl">
                  <div>
                    <div className="mb-6 flex items-start justify-between gap-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition duration-300 group-hover:scale-110 ${card.tone}`}><Icon size={27} /></div>
                      <span className="rounded-full border border-ink-border bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">{card.badge}</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-ink-primary transition-colors group-hover:text-brand">{card.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{card.description}</p>
                  </div>
                  <a href="#how-it-works" className="mt-6 inline-flex items-center border-t border-ink-border/70 pt-4 text-xs font-bold text-brand">See how it helps <ArrowRight className="ml-1.5 transition-transform group-hover:translate-x-1" size={14} /></a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-ink-border bg-surface-bg py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">Simple three-step setup</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">How FloodGuard works</h2>
            <p className="mt-4 text-base font-medium text-ink-secondary sm:text-lg">Start with the places and signals that matter most to you.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {setupSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.number} className="rounded-2xl border border-ink-border bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-brand to-brand-gradientEnd text-lg font-extrabold text-white shadow-sm">{step.number}</span>
                    <span className="rounded-full border border-ink-border bg-surface-bg px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-secondary">{step.highlight}</span>
                  </div>
                  <div className="mt-7 flex items-center gap-3"><Icon size={20} className="text-brand" /><h3 className="text-xl font-bold tracking-tight text-ink-primary">{step.title}</h3></div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{step.description}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-brand to-brand-gradientEnd p-6 text-white shadow-lg sm:flex-row sm:p-8">
            <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20"><Sparkles size={23} /></div><div><h3 className="text-lg font-bold">Ready to secure your locations?</h3><p className="mt-1 text-sm text-blue-100">Create a free account and start following your local risk picture.</p></div></div>
            <Link to="/register" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand shadow-md transition hover:bg-blue-50">Create free account <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="border-b border-ink-border bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">Interactive preview</span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-primary sm:text-4xl">See the monitoring picture at a glance</h2>
            <p className="mt-4 text-base font-medium text-ink-secondary sm:text-lg">Switch between the views responders use to understand changing conditions.</p>

            <div className="mt-8 inline-flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-ink-border bg-surface-bg p-1.5">
              {previewTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-pressed={isActive} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition sm:px-5 sm:text-sm ${isActive ? "bg-brand text-white shadow-sm" : "text-ink-secondary hover:text-ink-primary"}`}><Icon size={15} />{tab.label}</button>;
              })}
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl border border-ink-border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-border bg-slate-100 px-4 py-3">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /><span className="ml-2 hidden text-xs font-semibold text-ink-secondary sm:inline">FloodGuard · live stream</span></div>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-border bg-white px-3 py-1 text-[10px] font-semibold text-ink-secondary sm:text-xs"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Monitoring active</span>
            </div>
            {activeTab === "map" && <PreviewMap zones={zones} />}
            {activeTab === "gauges" && <PreviewGauges />}
            {activeTab === "alerts" && <PreviewAlerts zones={zones} />}
          </div>
        </div>
      </section>

      <section className="bg-surface-bg py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-gradientEnd p-8 text-center text-white shadow-2xl sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-bold"><CheckCircle2 size={15} className="text-cyan-100" /> Prioritize community safety</span>
              <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Don&apos;t wait until the waters rise</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-blue-100 sm:text-lg">Follow live flood conditions, read verified community reports, and help the people around you respond earlier.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-brand shadow-lg transition hover:bg-blue-50">Get started free</Link><Link to="/alerts" className="rounded-full border border-white/60 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">View current alerts</Link></div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
