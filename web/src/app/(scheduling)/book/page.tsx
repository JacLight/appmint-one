import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { StudioSchedule } from "@/modules/scheduling/components/book/studio-schedule";
import { FindTime } from "@/modules/scheduling/components/book/find-time";
import { BookPageSkeleton } from "@/modules/scheduling/components/book/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetup();
  return { title: s.scheduling?.style === "studio" ? "Class schedule" : s.scheduling?.words.bookCta || "Book" };
}

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** /book — the studio's timetable, or the clinic's / firm's "find a time". */
export default async function BookPage({ searchParams }: { searchParams: SP }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const cfg = setup.scheduling!;
  return (
    <>
      <SiteHeader />
      <main>
        {/* The header shows at once; the doctors and their times stream in behind a skeleton. */}
        <Suspense fallback={<BookPageSkeleton style={cfg.style} />}>
          {cfg.style === "studio"
            ? <StudioSchedule cfg={cfg} day={one(sp.day)} type={one(sp.type)} />
            : <FindTime cfg={cfg} type={one(sp.type)} reason={one(sp.reason)} with={one(sp.with)} from={one(sp.from)} />}
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
