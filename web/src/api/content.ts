/**
 * LMS learning — Content Studio courses as the learner takes them.
 *
 *   client/content-studio/*       mine, outline, enroll, items, progress, answer
 *                                 (appengine src/content-studio/content-studio-client.controller.ts)
 *   repository/find/published     the published course posts (Content Studio has no client
 *                                 list route; a visitor read with the app token works)
 *   client-data/benefits/*        a course page's benefit application (the player draws it)
 *
 * Paid courses are storefront products: their calls live in store.ts.
 * `code` is a course's access / invitation code (`?code=`), passed through as the engine asks.
 */
import "server-only";
import { apiReq } from "@/lib/api";

const P = "client/content-studio";
const enc = encodeURIComponent;
const q = (code?: string) => (code ? { code } : undefined);

/* ── shapes (client/content-studio) ── */

export interface CourseOutline {
  course: { id: string; slug?: string; title: string; summary?: string; coverImage?: string; steps: number; dueInDays?: number; layout?: string; navigation?: string; languages?: string[] };
  enrollment: { id: string; status: string; enrolledAt?: string; dueAt?: string; completedAt?: string; percent: number } | null;
  outline?: any[];
  items: { id: string; title: string; pageId?: string; depth: number; kind: "chapter" | "page"; type?: string; duration?: string; status: string; lockReason?: string; percent: number; done?: number; total?: number; step?: number }[];
  next: string | null;
  viewerLanguage?: string | null;
}

export interface CourseItem {
  item: { id: string; title: string; prev: string | null; next: string | null };
  page: { id: string; title: string; summary?: string; content?: string; type?: string; duration?: string; translations?: Record<string, any>; forms?: Record<string, any> } | null;
  progress: { done?: boolean; percent?: number; score?: number; marks?: Record<string, boolean>; review?: { status: string; note?: string } };
  result?: { passed: boolean; score: number; min: number; message: string; locked?: boolean; next?: { id: string; title: string } };
  answer: Record<string, any> | null;
  enrolled: boolean;
  forms?: Record<string, any>;
}

export interface MyCourse {
  enrollmentId: string;
  course: { id: string; slug?: string; title: string; coverImage?: string };
  status: string;
  percent: number;
  next: string | null;
  dueAt?: string;
}

/* ── client/content-studio ── */

export const myCourses = () => apiReq<MyCourse[]>("GET", `${P}/mine`);

/** Readable before signing in; my enrollment when signed in. 401/403 carry `{ message, reason, stage, title }`. */
export const courseOutline = (course: string, code?: string) => apiReq<CourseOutline>("GET", `${P}/${enc(course)}`, { query: q(code) });

export const enrollInCourse = (course: string, code?: string) => apiReq<CourseOutline>("POST", `${P}/${enc(course)}/enroll`, { data: {}, query: q(code) });

export const courseItem = (course: string, item: string, code?: string) => apiReq<CourseItem>("GET", `${P}/${enc(course)}/items/${enc(item)}`, { query: q(code) });

/** done, watched %, score. */
export const reportCourseProgress = (course: string, item: string, body: { done?: boolean; percent?: number; score?: number }, code?: string) =>
  apiReq<CourseOutline>("POST", `${P}/${enc(course)}/items/${enc(item)}/progress`, { data: body, query: q(code) });

/** Send in an item's form (done: false keeps a draft). */
export const answerCourseItem = (course: string, item: string, body: { values: Record<string, any>; done: boolean }, code?: string) =>
  apiReq<CourseOutline & { result?: CourseItem["result"] }>("POST", `${P}/${enc(course)}/items/${enc(item)}/answer`, { data: body, query: q(code) });

/* ── the published course posts ── */

export async function findPublishedPosts(query: Record<string, any>, pageSize = 60): Promise<any[]> {
  const r = await apiReq<any>("POST", "repository/find/published", { data: { query: { ...query, sourceDatatype: "post" }, options: { page: 1, pageSize } } });
  return Array.isArray(r) ? r : r?.data || [];
}

/* ── benefit applications on a course page ── */

export const benefitApplication = (name: string) => apiReq<any>("GET", `client-data/benefits/${enc(name)}/application`);

export const applyForBenefit = (body: { benefit: string; formData?: Record<string, any>; agreementAccepted: boolean }) => apiReq<any>("POST", "client-data/benefits/enroll", { data: body });
