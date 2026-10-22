/** Pure normalisers: engine records → the Scheduling screens' shapes. No IO. */
import type { Booking, BookingDetail, BookingKind, BookingType, Invoice, Membership, Move, Plan, Service, TeamMember } from "./types";

const str = (v: any) => (v === undefined || v === null ? "" : String(v));

export function hostEmails(value: any): string[] {
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : str(value).split(",");
  const out = list
    .map((h: any) => str(h && typeof h === "object" ? h.email ?? h.value ?? "" : h).trim().toLowerCase())
    .filter((e: string) => /^[^\s@,]+@[^\s@,]+$/.test(e));
  return [...new Set(out)] as string[];
}

const KINDS: BookingKind[] = ["class", "private", "visit", "consultation", "meeting"];

/** A reservation definition → BookingType, or null when it isn't this business's: its
 *  name starts with the setup's prefix, or the setup names it in `include`. */
export function toBookingType(env: any, prefix: string, include: string[] = []): BookingType | null {
  const d = env?.data || {};
  const name = str(d.name);
  if (!env?.sk || !(name.startsWith(prefix) || include.includes(name))) return null;
  if (str(d.status || "active").toLowerCase() !== "active") return null;
  const portal = d.portal || {};
  const services: Service[] = (Array.isArray(d.services) ? d.services : [])
    .filter((s: any) => s && s.name)
    .map((s: any) => ({ name: str(s.name), duration: Number(s.duration) || 30, price: Number(s.price) || 0, description: s.description }));
  const team: TeamMember[] = (Array.isArray(d.team) ? d.team : [])
    .filter((t: any) => t && t.email && t.name)
    .map((t: any) => ({ ...t, email: str(t.email).toLowerCase() }));
  const kind: BookingKind = KINDS.includes(portal.kind) ? portal.kind : "visit";
  return {
    id: str(env.sk),
    name,
    slug: name.startsWith(prefix) ? name.slice(prefix.length) || name : name,
    title: str(d.title || name),
    description: str(d.description),
    image: d.image?.url || (typeof d.image === "string" ? d.image : undefined),
    kind,
    form: d.form ? str(d.form) : undefined,
    team,
    hosts: hostEmails(d.hosts),
    services,
    spots: Number(d.spots) || 1,
    workDays: Array.isArray(d.workDays) ? d.workDays : [],
    timezone: d.officeHours?.timezone || "America/Chicago",
    category: portal.category,
    level: portal.level,
    room: portal.room,
    location: portal.location,
    price: services[0]?.price || 0,
    area: portal.area,
    video: !!portal.video,
    sameDay: !!portal.sameDay,
    hidden: !!portal.hidden,
  };
}

/** Every person across the types, once, in the order they first appear. */
export function teamOf(types: BookingType[]): TeamMember[] {
  const seen = new Map<string, TeamMember>();
  for (const t of types) for (const m of t.team) if (!seen.has(m.email)) seen.set(m.email, m);
  return [...seen.values()];
}

export function memberOf(types: BookingType[], email?: string): TeamMember | undefined {
  if (!email) return undefined;
  const e = email.toLowerCase();
  for (const t of types) { const m = t.team.find((x) => x.email === e); if (m) return m; }
  return undefined;
}

/** The person a booking is with (its host), from the booking type's team. */
export function hostOf(type: BookingType | undefined, hosts: string[]): TeamMember | undefined {
  if (!type) return undefined;
  for (const h of hosts) { const m = type.team.find((x) => x.email === h); if (m) return m; }
  return type.team.length === 1 ? type.team[0] : undefined;
}

export function toBooking(env: any): Booking | null {
  if (!env) return null;
  const d = env.data || {};
  if (!env.sk || !d.startTime) return null;
  return {
    id: str(env.sk),
    number: str(d.name || env.name),
    status: str(d.status || "pending"),
    startTime: d.startTime,
    endTime: d.endTime || d.startTime,
    definitionId: str(d.reservationDefinitionId || env.owner?.id),
    service: d.service || d.serviceName,
    hosts: hostEmails(d.hosts),
    customer: { name: d.customer?.name, email: d.customer?.email, phone: d.customer?.phone },
    notes: d.notes,
    meetingLink: d.meetingLink || null,
    createdAt: env.createdate,
  };
}

/** The reservation record → what the booking page shows: status, the answers given when
 *  booking, every move, the cancellation and the check-in stamp. */
export function toBookingDetail(env: any): BookingDetail | null {
  const booking = toBooking(env);
  if (!booking) return null;
  const d = env.data || {};
  const intake: Record<string, string> = {};
  if (d.intake && typeof d.intake === "object") for (const [k, v] of Object.entries(d.intake)) if (v !== null && v !== undefined && String(v).trim()) intake[k] = String(v);
  const moves: Move[] = (Array.isArray(d.rescheduleHistory) ? d.rescheduleHistory : [])
    .filter((m: any) => m?.fromStartTime && m?.toStartTime)
    .map((m: any) => ({ from: m.fromStartTime, to: m.toStartTime, at: m.at, byCustomer: !!m.byCustomer, reason: m.reason || undefined }));
  return {
    booking, intake, moves,
    serviceName: d.serviceName || undefined,
    source: d.source || undefined,
    cancelledAt: d.cancelledAt || null,
    cancelledBy: d.cancelledBy || null,
    cancelReason: d.cancelReason || null,
    usedAt: d.usedAt || null,
    meetingInfo: d.meetingInfo || null,
    address: d.address || null,
  };
}

/** A subscription (storefront/subscriptions/get/me) → Membership, when it is one of this business's plans. */
export function toMembership(env: any, plans: Plan[]): Membership | null {
  const d = env?.data || env || {};
  const plan = plans.find((p) => p.name === str(d.plan));
  if (!plan) return null;
  const status = str(d.status).toLowerCase();
  return {
    id: str(env?.sk || d.name), plan: plan.name, title: plan.title, kind: plan.kind, status,
    active: ["active", "trialing", "trial"].includes(status),
    renewsAt: d.renewalDate || d.nextBillingDate || d.endDate || null,
    startedAt: d.startDate || d.periodStart || null,
  };
}

/** An invoice row from client-data/all. The balance is the engine's. */
export function toInvoice(r: any): Invoice | null {
  if (!r?.id) return null;
  return {
    id: str(r.id), number: str(r.number || r.id), description: r.description || undefined, issuedAt: r.issuedAt || null, dueAt: r.dueAt || null,
    total: Number(r.total) || 0, balance: Number(r.balance) || 0, currency: str(r.currency || "USD"), status: str(r.status || "sent"),
  };
}

const CLOSED = ["cancelled", "canceled", "no_show", "no-show", "noshow", "declined", "rejected", "expired"];
export const isClosed = (status: string) => CLOSED.includes(String(status || "").toLowerCase());

const feat = (features: any[], name: string) => (features || []).filter((f) => str(f?.name).trim().toLowerCase() === name);

export function toPlan(p: any, prefix: string): Plan | null {
  if (!p?.name || !str(p.name).startsWith(prefix)) return null;
  const features: any[] = Array.isArray(p.features) ? p.features : [];
  const c = str(feat(features, "credits")[0]?.value).trim().toLowerCase();
  const credits = c === "unlimited" || c === "*" ? "unlimited" : Number(c) > 0 ? Math.floor(Number(c)) : null;
  const kindV = str(feat(features, "kind")[0]?.value).toLowerCase();
  const scopeV = str(feat(features, "scope")[0]?.value).toLowerCase();
  return {
    name: str(p.name),
    title: str(p.title || p.name),
    description: p.description ? str(p.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined,
    price: Number(p.price) || 0,
    displayPrice: p.displayPrice,
    currency: str(p.currency || "USD"),
    duration: Number(p.duration) || 1,
    durationUnit: str(p.durationUnit || "month"),
    credits,
    kind: kindV === "pack" ? "pack" : "membership",
    scope: scopeV === "class" || scopeV === "private" ? scopeV : "any",
    perks: feat(features, "perk").map((f) => str(f.description || f.value)).filter(Boolean),
    badge: feat(features, "badge")[0]?.value ? str(feat(features, "badge")[0].value) : undefined,
  };
}
