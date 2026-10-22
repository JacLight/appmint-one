import type { CourseCard, CourseModule } from "./types";

/**
 * Shaping and display helpers. Only fields the engine's course post actually has are
 * read: title, slug, summary, coverImage, pages (type, duration), toc, access. No
 * price, topic, level or instructor: Content Studio has none of those.
 */

export function minutesOf(duration: unknown): number {
  const s = String(duration ?? "").trim().toLowerCase();
  if (!s) return 0;
  const clock = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) return clock[3] !== undefined ? Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60 : Number(clock[1]) + Number(clock[2]) / 60;
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|seconds)\b/g)) {
    matched = true;
    const n = Number(m[1]);
    total += m[2].startsWith("h") ? n * 60 : m[2].startsWith("s") ? n / 60 : n;
  }
  if (matched) return total;
  const bare = Number(s);
  return Number.isFinite(bare) ? bare : 0;
}

const sum = (items: { minutes: number }[]) => Math.round(items.reduce((t, i) => t + (i.minutes || 0), 0));

/** The syllabus from a published post's `toc` + `pages` (catalog cards). */
export function modulesOf(data: any): CourseModule[] {
  const pages = new Map<string, any>((data?.pages || []).filter((p: any) => p?.id).map((p: any) => [String(p.id), p]));
  const row = (n: any) => {
    const page = n?.pageId ? pages.get(String(n.pageId)) : pages.get(String(n?.id));
    return { id: String(n.id), title: n.title || page?.title || String(n.id), type: page?.type, duration: page?.duration, minutes: minutesOf(page?.duration) };
  };
  const leaves = (n: any): any[] => [...(n?.pageId ? [n] : []), ...((n?.children || []) as any[]).flatMap(leaves)];
  const toc: any[] = (data?.toc || []).filter((n: any) => n?.id);
  if (!toc.length) {
    const items = (data?.pages || []).filter((p: any) => p?.id).map((p: any) => row({ id: p.id, pageId: p.id, title: p.title }));
    return items.length ? [{ id: "all", title: data?.title || "Lessons", minutes: sum(items), items }] : [];
  }
  const out: CourseModule[] = [];
  let loose: CourseModule | null = null;
  for (const n of toc) {
    if (n.children?.length && !n.pageId) {
      loose = null;
      const items = leaves(n).map(row);
      out.push({ id: String(n.id), title: n.title || String(n.id), minutes: sum(items), items });
    } else if (n.pageId) {
      if (!loose) { loose = { id: String(n.id), title: n.title || "Lessons", minutes: 0, items: [] }; out.push(loose); }
      loose.items.push(row(n));
      loose.minutes = sum(loose.items);
    }
  }
  return out;
}

/** Open to anyone: the post's `authenticationType` is none and no legacy code / participants lock. */
export function isOpenAccess(data: any): boolean {
  const type = String(data?.authenticationType ?? "none").trim().toLowerCase() || "none";
  const legacy = String(data?.accessMode ?? "").trim().toLowerCase();
  return type === "none" && legacy !== "code" && legacy !== "participants";
}

export function cardOf(post: any): CourseCard {
  const data = post?.data || {};
  const modules = modulesOf(data);
  const items = modules.flatMap((m) => m.items);
  return {
    id: String(post.sk),
    slug: data.slug || undefined,
    title: data.title || "Untitled course",
    summary: data.summary || undefined,
    coverImage: data.coverImage || undefined,
    lessons: items.length,
    modules: modules.length,
    minutes: sum(items),
    quizzes: items.filter((i) => i.type === "quiz").length,
    assignments: items.filter((i) => i.type === "assignment").length,
    videos: items.filter((i) => i.type === "video").length,
    open: isOpenAccess(data),
  };
}

/* ── display ── */

export function fmtMinutes(min: number): string {
  const m = Math.round(min || 0);
  if (m <= 0) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function courseRef(c: { slug?: string; id: string }): string {
  return c.slug || c.id;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;


/* ── the outline the engine sends (client/content-studio/:course) ── */

export type OutlineItem = { id: string; title: string; kind: string; depth?: number; type?: string; duration?: string; status?: string; lockReason?: string; done?: number; total?: number; step?: number };
export type OutlineSection = { id: string; title: string; status?: string; lockReason?: string; done: number; total: number; minutes: number; items: OutlineItem[] };

/** The outline's flat `items` as sections (a chapter and the pages under it), the way the
 *  Content Player's own outline groups them. Loose pages form an untitled section. */
export function sectionsOf(items: OutlineItem[] = []): OutlineSection[] {
  const out: OutlineSection[] = [];
  for (const i of items) {
    if (i.kind === "chapter") { out.push({ id: i.id, title: i.title, status: i.status, lockReason: i.lockReason, done: Number(i.done) || 0, total: Number(i.total) || 0, minutes: 0, items: [] }); continue; }
    let last = out[out.length - 1];
    if (!last || (!(Number(i.depth) > 0) && !last.id.startsWith("loose-"))) { last = { id: `loose-${i.id}`, title: "", done: 0, total: 0, minutes: 0, items: [] }; out.push(last); }
    last.items.push(i);
    last.minutes += minutesOf(i.duration);
    if (!last.id.startsWith("loose-")) continue;
    last.total += 1;
    if (i.status === "done") last.done += 1;
  }
  for (const s of out) s.minutes = Math.round(s.minutes);
  return out;
}

export const pagesOfOutline = (items: OutlineItem[] = []) => items.filter((i) => i.kind === "page");

/** What a course holds, by the page types its author set, as "This course includes" lines. */
export function includesOf(items: OutlineItem[] = []): { icon: string; label: string }[] {
  const pages = pagesOfOutline(items);
  const by = (types: string[]) => pages.filter((p) => types.includes(String(p.type || "text")));
  const mins = (ps: OutlineItem[]) => fmtMinutes(ps.reduce((t, p) => t + minutesOf(p.duration), 0));
  const rows: { icon: string; label: string }[] = [];
  const add = (icon: string, ps: OutlineItem[], one: string, many: string, withTime = false) => {
    if (!ps.length) return;
    const t = withTime ? mins(ps) : "";
    rows.push({ icon, label: `${ps.length} ${ps.length === 1 ? one : many}${t ? ` · ${t}` : ""}` });
  };
  add("video", by(["video"]), "video lesson", "video lessons", true);
  add("audio", by(["audio"]), "audio lesson", "audio lessons", true);
  add("text", by(["text", "article", "page"]), "reading", "readings");
  add("file", by(["pdf", "download"]), "downloadable resource", "downloadable resources");
  add("quiz", by(["quiz", "form"]), "quiz", "quizzes");
  add("upload", by(["assignment"]), "assignment, reviewed by a teacher", "assignments, reviewed by a teacher");
  add("image", by(["gallery"]), "gallery", "galleries");
  return rows;
}
