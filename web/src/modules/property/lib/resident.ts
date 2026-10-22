import "server-only";
import * as R from "@/api/reservations";
import * as P from "@/api/property";
import { myInvoices } from "@/modules/scheduling/lib/data";
import type { PropertyConfig } from "@/setups/property-config";
import { findHome } from "./homes";
import type { Home, Unit } from "./types";

/**
 * The signed-in resident: their applications (the CRM form's submissions), the lease
 * those turn into once the office approves one, their repair requests (tickets), rent
 * (invoices) and their building's notices (its community page).
 */

export interface Application {
  id: string;
  status: string;
  submittedAt: string | null;
  values: Record<string, any>;
  unitId: string;
  unitTitle: string;
  homeTitle: string;
  rent: number | null;
  moveIn: string | null;
  term: number | null;
  segment: "residential" | "commercial";
  company: string;
}

export async function myApplications(cfg: PropertyConfig): Promise<Application[]> {
  const rows = await R.myFormSubmissions(100).catch(() => []);
  const biz = cfg.commercial?.form;
  return rows
    .filter((r: any) => r?.form?.name === cfg.applicationForm || (biz && r?.form?.name === biz))
    .map((r: any) => {
      const v = r.values || {};
      const commercial = !!biz && r.form.name === biz;
      return {
        id: String(r.id),
        status: String(r.status || "new"),
        submittedAt: r.submittedAt || null,
        values: v,
        unitId: String(v.unitId || ""),
        unitTitle: String(v.unitTitle || ""),
        homeTitle: String(v.homeTitle || ""),
        rent: v.rent != null && v.rent !== "" ? Number(v.rent) : null,
        moveIn: v.moveIn || null,
        term: v.leaseTerm ? Number(v.leaseTerm) : null,
        segment: commercial ? "commercial" : "residential",
        company: commercial ? String(v.dba || v.companyName || "") : "",
      };
    });
}

/** Where an application is, in the words an applicant reads. */
export function applicationStage(status: string): { label: string; tone: "wait" | "ok" | "bad" | "info"; step: number } {
  switch (status) {
    case "approved": return { label: "Approved", tone: "ok", step: 3 };
    case "rejected": return { label: "Not approved", tone: "bad", step: 3 };
    case "pending":
    case "incomplete": return { label: "We need something from you", tone: "wait", step: 1 };
    case "completed": return { label: "Under review", tone: "info", step: 2 };
    case "archived": return { label: "Withdrawn", tone: "bad", step: 0 };
    default: return { label: "Submitted", tone: "info", step: 1 };
  }
}

export interface Tenancy { application: Application; home: Home; unit: Unit }

/** The lease: the newest approved application, with the home it was for. */
export async function myTenancy(cfg: PropertyConfig, apps?: Application[]): Promise<Tenancy | null> {
  const list = apps ?? (await myApplications(cfg));
  const approved = list.find((a) => a.status === "approved" && a.unitId);
  if (!approved) return null;
  const found = await findHome(cfg, approved.unitId);
  return found?.unit ? { application: approved, home: found.home, unit: found.unit } : null;
}

export interface RepairRequest {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  category: string;
  area: string;
  urgency: string;
  entry: string;
  pets: string;
  times: string;
  photos: string[];
  home: string;
  createdAt: string;
  updatedAt: string;
}

const toRequest = (t: P.TicketRecord): RepairRequest => {
  const d = t.data || ({} as P.TicketData);
  return {
    id: String(t.sk),
    number: String(d.name || t.name || ""),
    title: d.title || "Repair request",
    description: d.description || "",
    status: String(d.status || "new").toLowerCase(),
    category: d.category || "",
    area: d.area || "",
    urgency: d.urgency || "routine",
    entry: d.permissionToEnter || "",
    pets: d.petsInHome || "",
    times: d.bestTimes || "",
    photos: Array.isArray(d.photos) ? d.photos : [],
    home: d.homeTitle ? `${d.unitTitle ? `${d.unitTitle}, ` : ""}${d.homeTitle}` : "",
    createdAt: t.createdate || "",
    updatedAt: t.modifydate || t.createdate || "",
  };
};

export async function myRequests(): Promise<RepairRequest[]> {
  const r = await P.myTickets().catch(() => null);
  return (r?.data || []).map(toRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function myRequest(num: string): Promise<RepairRequest | null> {
  const r = await P.myTicket(num).catch(() => null);
  const t = r?.data?.[0];
  return t ? toRequest(t) : null;
}

export interface Reply { by: string; at: string; text: string; staff: boolean }

/** The office's replies on a request. Whatever shape the thread comes back in, keep text + who + when. */
export async function requestReplies(ticketId: string, residentEmail?: string): Promise<Reply[]> {
  const r: any = await P.ticketMessages(ticketId).catch(() => null);
  const rows: any[] = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.messages) ? r.messages : [];
  return rows.map((m: any) => {
    const d = m?.data || m || {};
    const by = String(d.from || d.sender || d.author || m?.author || "");
    const text = String(d.text || d.body || d.content || d.message || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { by, at: String(d.date || d.sentAt || m?.createdate || ""), text, staff: !!residentEmail && !by.toLowerCase().includes(residentEmail.toLowerCase()) };
  }).filter((m) => m.text).sort((a, b) => a.at.localeCompare(b.at));
}

/** Where a request is. `open`/`inprogress` are the office working on it. */
export function requestStage(status: string): { label: string; tone: "wait" | "ok" | "info" | "bad"; step: number } {
  if (["done", "resolved", "closed"].includes(status)) return { label: "Done", tone: "ok", step: 3 };
  if (["pending", "waiting", "on-hold", "on_hold"].includes(status)) return { label: "On hold", tone: "wait", step: 2 };
  if (["open", "inprogress", "in-progress", "in_progress", "assigned", "reopened"].includes(status)) return { label: "In progress", tone: "info", step: 2 };
  return { label: "Received", tone: "info", step: 1 };
}

/** The response promise for a request: due by when, and whether it has been kept. */
export function responseClock(cfg: PropertyConfig, r: Pick<RepairRequest, "createdAt" | "status">) {
  const created = new Date(r.createdAt || Date.now()).getTime();
  const due = new Date(created + cfg.sla.responseHours * 3600_000);
  const answered = r.status !== "new";
  const late = !answered && Date.now() > due.getTime();
  return { due, answered, late };
}

export async function myRent() {
  const inv = await myInvoices().catch(() => []);
  const open = inv.filter((i) => i.balance > 0.004);
  const paid = inv.filter((i) => i.balance <= 0.004);
  return { open, paid, all: inv };
}

export interface Board { id: string; title: string; status: "member" | "pending" | "outside" | "missing"; notices: (P.Announcement & { id: string })[] }

export async function myBoard(home: Home | null, limit = 20): Promise<Board | null> {
  if (!home?.board) return null;
  const page = await P.boardPage(home.board).catch(() => null);
  if (!page) return { id: home.board, title: home.title, status: "missing", notices: [] };
  const m = page.viewerMembership?.status;
  const status: Board["status"] = m === "active" ? "member" : m === "pending" ? "pending" : page.preview ? "outside" : "member";
  const list = status === "member" ? await P.boardAnnouncements(String(page.sk), limit).catch(() => null) : null;
  return {
    id: String(page.sk),
    title: page.data?.title || home.title,
    status,
    notices: (list?.data || []).map((a) => ({ id: String(a.sk), ...a.data })),
  };
}
