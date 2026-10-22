/** Catalog shapes: a published Content Studio course post as a card. The learning views
 *  (outline, item, mine) are typed in src/api/content.ts. Prices are not here: a paid
 *  course is a storefront product (lib/catalog.ts). */

/** A published Content Studio course, as a card. Every field is read from the post. */
export interface CourseCard {
  id: string;
  slug?: string;
  title: string;
  summary?: string;
  coverImage?: string;
  lessons: number;
  modules: number;
  minutes: number;
  quizzes: number;
  /** Pages of type "assignment" (sent in and reviewed by staff). */
  assignments: number;
  /** Pages of type video. */
  videos: number;
  /** The post's own access rule lets anyone in (authenticationType none). */
  open: boolean;
  mine?: Standing | null;
}

/** Where the signed-in learner stands on a course (from `mine`). */
export interface Standing {
  enrollmentId: string;
  status?: "active" | "completed" | "withdrawn" | string;
  percent: number;
  next?: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  minutes: number;
  items: { id: string; title: string; type?: string; duration?: string; minutes: number }[];
}
