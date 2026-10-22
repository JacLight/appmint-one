import { requireModule } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { SchedulingSoon } from "@/modules/scheduling/components/soon";

/** The customer's Scheduling pages (/account/scheduling/*). Only where Scheduling is on;
 *  a setup without a scheduling config keeps the coming-soon panel. */
export default async function SchedulingAccountLayout({ children }: { children: React.ReactNode }) {
  await requireModule("scheduling");
  const setup = await getSetup();
  if (!setup.scheduling) return <SchedulingSoon setup={setup} account />;
  return <div className="scm">{children}</div>;
}
