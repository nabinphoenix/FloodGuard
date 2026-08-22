import { AlertTriangle, CheckCircle2, Droplets, ExternalLink, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import FloodFooter from "../../components/FloodFooter";
import { FLOODGUARD_SUPPORT_CONTACTS } from "../../data/supportContacts";

const beforeFlood = [
  "Monitor FloodGuard alerts and official local announcements.",
  "Move documents, medicines, valuables and electrical items above likely flood levels.",
  "Plan a route to higher ground and discuss it with children, older adults and anyone needing assistance.",
  "Keep your phone charged and save important contact numbers offline.",
];

const duringFlood = [
  "Stay calm and move to safer or higher ground when advised.",
  "Never walk, swim or drive through moving or unknown-depth water.",
  "Stay away from riverbanks, drainage channels, damaged bridges, fallen wires and flooded roads.",
  "Take essential medicines, identification, water and communication devices if it is safe to do so.",
];

const afterFlood = [
  "Return only when authorities say the area is safe.",
  "Avoid unstable buildings, contaminated water, electrical hazards and damaged roads.",
  "Use safe drinking water and report urgent hazards through the appropriate local channel.",
  "Check on neighbours and vulnerable family members without entering unsafe areas.",
];

const kitItems = [
  "Drinking water and ready-to-eat food",
  "Essential medicines and first-aid supplies",
  "Torch, spare batteries and power bank",
  "Identification, cash and important documents in a waterproof pouch",
  "Phone, charger and a small whistle",
  "Dry clothes, hygiene items and basic blankets",
];

const alertLevels = [
  { level: "SAFE", color: "border-green-200 bg-green-50 text-green-800", description: "No active flood threshold is currently exceeded. Continue normal awareness." },
  { level: "WATCH", color: "border-yellow-200 bg-yellow-50 text-yellow-900", description: "Conditions may change. Prepare supplies, charge phones and monitor updates." },
  { level: "WARNING", color: "border-orange-200 bg-orange-50 text-orange-900", description: "Flood risk is elevated. Prepare to move and avoid exposed waterways and roads." },
  { level: "EMERGENCY", color: "border-red-200 bg-red-50 text-red-900", description: "Take immediate life-safety action and follow official evacuation instructions." },
];

function SafetyList({ items }) {
  return (
    <ul className="space-y-3 text-sm leading-6 text-slate-700">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckCircle2 className="mt-1 shrink-0 text-brand" size={17} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Safety() {
  return (
    <main className="min-h-screen bg-surface-bg text-ink-primary">
      <section className="bg-gradient-to-br from-brand via-brand to-brand-gradientEnd px-6 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">FloodGuard public safety guide</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Know what to do before, during and after a flood.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-blue-50 sm:text-lg">Use this guide to prepare early, make safer decisions and keep monitoring current alerts. FloodGuard alerts support — but do not replace — instructions from local authorities and official emergency services.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/alerts" className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-brand shadow-sm transition hover:bg-blue-50">View live alerts</Link>
            <a href="#support-contacts" className="rounded-lg border border-white/50 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Support contacts</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand"><ShieldCheck size={23} /></div>
            <h2 className="text-2xl font-black">Before a Flood</h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">Prepare while conditions are calm.</p>
            <SafetyList items={beforeFlood} />
          </article>
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand"><Droplets size={23} /></div>
            <h2 className="text-2xl font-black">During a Flood</h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">Protect life first and avoid moving water.</p>
            <SafetyList items={duringFlood} />
          </article>
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-brand"><CheckCircle2 size={23} /></div>
            <h2 className="text-2xl font-black">After a Flood</h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">Stay cautious even when water levels fall.</p>
            <SafetyList items={afterFlood} />
          </article>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><ShieldCheck className="text-brand" size={24} /><h2 className="text-2xl font-black">Emergency Preparedness Kit</h2></div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Keep a small, easy-to-carry kit ready for each household.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {kitItems.map((item) => <div key={item} className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold leading-5 text-blue-950">{item}</div>)}
            </div>
          </article>
          <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><AlertTriangle className="text-brand" size={24} /><h2 className="text-2xl font-black">Understanding FloodGuard Alerts</h2></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {alertLevels.map((item) => <div key={item.level} className={`rounded-xl border p-4 ${item.color}`}><p className="text-xs font-black uppercase tracking-widest">{item.level}</p><p className="mt-2 text-sm leading-5">{item.description}</p></div>)}
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">Alert levels are based on available FloodGuard zone and sensor information. Conditions can change quickly; follow local authorities and official emergency services for evacuation and life-safety directions.</p>
          </article>
        </div>

        <section id="support-contacts" className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-brand">FloodGuard Support Contacts</p><h2 className="mt-2 text-2xl font-black text-blue-950">Need help connecting with the FloodGuard team?</h2></div><p className="max-w-md text-sm leading-6 text-blue-900">These are FloodGuard support contacts, not government emergency services. For immediate danger, follow local authority and official emergency-service instructions.</p></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOODGUARD_SUPPORT_CONTACTS.map((contact) => <a key={contact.name} href={contact.tel} className="group rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand"><div className="flex items-center gap-3"><Phone size={18} className="text-brand" /><span className="font-bold text-blue-950">{contact.name}</span></div><p className="mt-3 text-sm font-semibold text-brand group-hover:underline">{contact.phone}</p></a>)}
          </div>
        </section>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-slate-500"><ExternalLink size={15} aria-hidden="true" />Check the <Link to="/alerts" className="font-bold text-brand hover:underline">live alert feed</Link> for the latest FloodGuard status.</p>
      </section>
      <FloodFooter />
    </main>
  );
}
