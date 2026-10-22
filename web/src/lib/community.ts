/**
 * Community API — customer↔host messaging over appengine `client/community/*`.
 * Contract from /Users/imzee/projects/appengine/src/community.
 * Counterparties are addressed by EMAIL (or customer sk). Threads are implicit
 * (id = thread_<sortedEmailA>_<sortedEmailB>); no connection required to DM.
 */
import { apiReq, type Envelope, type Paged } from "./api";

const P = "client/community";

export type MessageContentType = "text" | "image" | "file" | "audio" | "link" | "contact";
export type MessageStatus = "sent" | "delivered" | "read" | "deleted";

export interface CommunityMessage {
  name?: string;
  thread: string;
  sender: string;             // email
  senderInfo?: { firstName?: string; lastName?: string; image?: string; email?: string };
  recipient: string;          // email
  recipientInfo?: { firstName?: string; lastName?: string; email?: string; image?: string };
  content: string;
  contentType?: MessageContentType;
  attachments?: any[];
  status?: MessageStatus;
  sentAt?: string;
  readAt?: string;
  deliveredAt?: string;
  replyTo?: string;
  replyPreview?: string;
  context?: { event?: string; eventName?: string; [k: string]: any };
}

export interface ThreadSummary {
  threadId: string;
  lastMessage: Envelope<CommunityMessage>;
  otherUser: { email: string; firstName?: string; lastName?: string; image?: string; company?: string };
  unreadCount: number;
}

export interface SendMessageInput {
  recipientId: string;        // host/customer email or sk
  content: string;
  contentType?: MessageContentType;
  attachments?: any[];
  replyTo?: string;
  context?: { event?: string; eventName?: string; [k: string]: any };
}

export const community = {
  // ── messaging ──
  send: (data: SendMessageInput) => apiReq<Envelope<CommunityMessage>>("POST", `${P}/messages`, { data }),
  threads: (query?: { limit?: number; offset?: number; page?: number }) =>
    apiReq<ThreadSummary[]>("GET", `${P}/messages/threads`, { query }),
  thread: (otherUserIdOrEmail: string, query?: { limit?: number; before?: string; page?: number }) =>
    apiReq<Paged<Envelope<CommunityMessage>>>("GET", `${P}/messages/thread/${encodeURIComponent(otherUserIdOrEmail)}`, { query }),
  markRead: (messageIds: string[]) => apiReq<{ marked: number }>("POST", `${P}/messages/read`, { data: { messageIds } }),
  markThreadRead: (otherUserIdOrEmail: string) =>
    apiReq<{ marked: number }>("POST", `${P}/messages/thread/${encodeURIComponent(otherUserIdOrEmail)}/read`, { data: {} }),
  deleteMessage: (id: string) => apiReq("DELETE", `${P}/messages/${id}`),
  unreadCount: () => apiReq<{ count: number }>("GET", `${P}/messages/unread-count`),

  // ── notifications ──
  notifications: (query?: { unread?: boolean; type?: string; limit?: number; page?: number }) =>
    apiReq<Paged<Envelope<any>>>("GET", `${P}/notifications`, { query }),
  notificationsRead: (ids: string[]) => apiReq("POST", `${P}/notifications/read`, { data: { ids } }),
  notificationsReadAll: () => apiReq("POST", `${P}/notifications/read-all`, { data: {} }),
  notificationsUnreadCount: () => apiReq<{ count: number }>("GET", `${P}/notifications/unread-count`),

  // ── blocking / reporting (message-permission) ──
  block: (data: { blockedId: string; reason?: string; reasonDetails?: string }) => apiReq("POST", `${P}/blocks`, { data }),
  unblock: (userId: string) => apiReq("DELETE", `${P}/blocks/${encodeURIComponent(userId)}`),
  report: (data: { reportedId: string; reason: string; details?: string }) => apiReq("POST", `${P}/reports`, { data }),
};

export type CommunityApi = typeof community;
