import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { myBoard, myTenancy } from "@/modules/property/lib/resident";
import { Notices } from "@/modules/property/components/notices";

export const metadata: Metadata = { title: "Notices" };

/** Notices from the resident's building: its community page's announcements. */
export default async function NoticesPage() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const t = await myTenancy(cfg).catch(() => null);
  const board = t ? await myBoard(t.home, 50) : null;
  return (
    <>
      <PageTitle title="Notices" />
      <section className="pm-panel" style={{ maxWidth: 820 }}>
        {t && <div className="pm-panel-h"><h2>{t.home.title}</h2></div>}
        <Notices board={board} big />
        {!t && <p style={{ marginTop: 14 }}><Link className="pm-link" href="/homes">Find a home</Link></p>}
      </section>
    </>
  );
}
