import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { moduleLabel, term } from "@/setups/modules";
import { courseOutline } from "@/api/content";
import { ContentPlayerRoute } from "@/modules/lms/player/route";

type Params = { params: Promise<{ course: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ course }, setup] = await Promise.all([params, getSetup()]);
  const o = await courseOutline(decodeURIComponent(course)).catch(() => null);
  return o ? { title: `${o.course.title} · ${setup.brand.name}`, description: o.course.summary } : { title: term(setup, "course") };
}

/** A course: its landing page (components/landing.tsx), drawn from the Content Player's outline read. */
export default async function CoursePage({ params, searchParams }: Params) {
  const [{ course }, sp, setup, session] = await Promise.all([params, searchParams, getSetup(), getSession()]);
  const page = await ContentPlayerRoute({ course: decodeURIComponent(course), searchParams: sp, signedIn: session.signedIn, exitLabel: moduleLabel(setup, "lms") });
  if (!page) notFound();
  return (
    <>
      <SiteHeader />
      {page}
      <SiteFooter />
    </>
  );
}
