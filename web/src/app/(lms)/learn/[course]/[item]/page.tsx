import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { moduleLabel } from "@/setups/modules";
import { courseOutline } from "@/api/content";
import { ContentPlayerRoute } from "@/modules/lms/player/route";
import { LessonChrome } from "@/modules/lms/components/lesson-chrome";
import { SiteHeader } from "@/components/site-header";

type Params = { params: Promise<{ course: string; item: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { course } = await params;
  const o = await courseOutline(decodeURIComponent(course)).catch(() => null);
  return { title: o?.course?.title || "Lesson" };
}

/** One page of a course: base-app's Content Player (outline, the page, Mark complete / its
 *  form) in the lesson frame — no site header; the lesson bar carries the brand and progress.
 *  A page that can't open falls back to the course's landing page, which has the header. */
export default async function LessonPage({ params, searchParams }: Params) {
  const [{ course, item }, sp, setup, session] = await Promise.all([params, searchParams, getSetup(), getSession()]);
  const page = await ContentPlayerRoute({ course: decodeURIComponent(course), item: decodeURIComponent(item), searchParams: sp, signedIn: session.signedIn, exitLabel: moduleLabel(setup, "lms") });
  if (!page) notFound();
  // The lesson frame replaces the site header; anything else (a locked page's landing, a sign-in or code gate) keeps it.
  if ((page as React.ReactElement)?.type === LessonChrome) return page;
  return (
    <>
      <SiteHeader />
      {page}
    </>
  );
}
