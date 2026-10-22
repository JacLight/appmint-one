import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { myTenancy } from "@/modules/property/lib/resident";
import { RequestForm } from "@/modules/property/components/request-form";

export const metadata: Metadata = { title: "Request a repair" };

export default async function NewRequestPage() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const t = await myTenancy(cfg).catch(() => null);
  const where = t ? (t.home.kind === "building" ? `${t.unit.title}, ${t.home.title}` : t.home.title) : null;
  return (
    <>
      <PageTitle title="Request a repair" />
      <RequestForm categories={cfg.requestCategories} areas={cfg.requestAreas} where={where} sla={cfg.sla} />
    </>
  );
}
