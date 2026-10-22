/**
 * What a setup teaches, for the catalog (/learn) and the academy home. base-app has no
 * course catalog (its Content Player starts at a course), so this stays custom.
 *   - free courses: the published Content Studio course posts (src/api/content.ts)
 *   - paid courses: this setup's storefront products in the "courses" category, bought
 *     with the Store module's bag and checkout. The engine has no product → course
 *     link, so a purchase does not enroll (see the module report's proposal).
 */
import "server-only";
import type { Setup } from "@/setups/types";
import { findPublishedPosts, myCourses } from "@/api/content";
// TODO(store): switch to src/api/store.ts `listProducts` when the store builder lands it.
import { listProducts } from "@/api/store";
import { storeView } from "@/modules/store/lib/config";
import type { Product } from "@/modules/store/lib/types";
import { cardOf } from "./shape";
import type { CourseCard, Standing } from "./types";

/** The storefront category that marks a product as a course. */
export const COURSE_CATEGORY = "courses";

/**
 * A setup's course posts — the engine's own `data.sites` rule (a post listing no site
 * shows everywhere), and only posts whose author chose the course layout
 * (`course.layout: "sidebar"`; `steps` posts are applications and forms).
 */
export async function listCourses(setup: Setup, opts: { search?: string; signedIn?: boolean } = {}): Promise<CourseCard[]> {
  const posts = await findPublishedPosts({
    "data.course.layout": "sidebar",
    $or: [{ "data.sites": setup.id }, { "data.sites": { $exists: false } }, { "data.sites": null }, { "data.sites": { $size: 0 } }],
  });
  const mine = new Map<string, Standing>();
  if (opts.signedIn) {
    for (const r of (await myCourses().catch(() => [])) || []) {
      if (r.status !== "withdrawn") mine.set(String(r.course?.id), { enrollmentId: r.enrollmentId, status: r.status, percent: r.percent, next: r.next });
    }
  }
  let cards = posts.filter((p) => p?.data?.course).map((p) => ({ ...cardOf(p), mine: mine.get(String(p.sk)) || null }));
  const s = opts.search?.trim().toLowerCase();
  if (s) cards = cards.filter((c) => [c.title, c.summary].some((v) => v?.toLowerCase().includes(s)));
  return cards;
}

/** Paid courses: only where the Store module is on, since that is where they are bought. */
export async function listCourseProducts(setup: Setup, opts: { search?: string } = {}): Promise<Product[]> {
  const view = storeView(setup);
  if (!view.retail) return [];
  const { products } = await listProducts({ tags: view.tags, category: COURSE_CATEGORY, keyword: opts.search, pageSize: 60 });
  return products;
}
