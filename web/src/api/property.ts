import "server-only";
/**
 * Property: repair requests and building notices. Homes are Stowbo listings (read with
 * `stowbo` from rentals.ts); applications are CRM forms and rent is invoices (both in
 * reservations.ts). Nothing here is a new engine route.
 *
 *   client-data/tickets                     a resident's repair requests (create, list, one)
 *   crm/tickets/messages/:ticketId          what the office wrote on one of them (owner may read)
 *   client/community/pages/:id              a building's notice board, with my membership
 *   client/community/pages/:id/join         ask to join it (the office approves)
 *   client/community/pages/:id/announcements, client/community/announcements/:id
 */
import { apiReq, type Envelope, type Paged } from "@/lib/api";

const enc = encodeURIComponent;

export interface TicketData {
  name?: string;            // the ticket number
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  reportedBy?: string;
  reportedByEmail?: string;
  [k: string]: any;
}
export type TicketRecord = Envelope<TicketData>;

/** POST client-data/tickets — the engine sets the number, status "new", priority and owner. */
export const createTicket = (data: Record<string, any>) =>
  apiReq<TicketRecord>("POST", "client-data/tickets", { data: { data } });

/** GET client-data/tickets — the signed-in customer's own tickets. */
export const myTickets = (status?: string) =>
  apiReq<Paged<TicketRecord>>("GET", "client-data/tickets", { query: { status } });

/** GET client-data/tickets/:number — one of mine (a page of 0 or 1). */
export const myTicket = (num: string) =>
  apiReq<Paged<TicketRecord>>("GET", `client-data/tickets/${enc(num)}`);

/** GET crm/tickets/messages/:ticketId — the replies on a ticket (its owner may read them). */
export const ticketMessages = (ticketId: string) => apiReq<any>("GET", `crm/tickets/messages/${enc(ticketId)}`);

export interface BoardPage {
  sk: string;
  preview?: boolean;
  data: { title?: string; slug?: string; description?: string; visibility?: string; joinPolicy?: string; coverImage?: string };
  viewerMembership?: { status?: string; role?: string } | null;
}

/** GET client/community/pages/:id — by id or slug; a private page shows outsiders its card only. */
export const boardPage = (pageId: string) => apiReq<BoardPage>("GET", `client/community/pages/${enc(pageId)}`);

/** POST client/community/pages/:id/join — on an approval-required page the membership waits for the office. */
export const joinBoard = (pageId: string) => apiReq<any>("POST", `client/community/pages/${enc(pageId)}/join`, { data: {} });

export interface Announcement {
  title?: string;
  content?: string;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  pinned?: boolean;
  publishedAt?: string;
  expiresAt?: string | null;
  authorInfo?: { name?: string; firstName?: string; lastName?: string };
  media?: any[];
}

/** GET client/community/pages/:id/announcements — pinned first, then by priority and date. */
export const boardAnnouncements = (pageId: string, limit = 20) =>
  apiReq<Paged<Envelope<Announcement>>>("GET", `client/community/pages/${enc(pageId)}/announcements`, { query: { limit } });

/** GET client/community/announcements/:id */
export const announcement = (id: string) => apiReq<Envelope<Announcement>>("GET", `client/community/announcements/${enc(id)}`);
