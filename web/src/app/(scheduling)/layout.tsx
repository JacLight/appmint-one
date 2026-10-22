import { requireModule } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { SchedulingSoon } from "@/modules/scheduling/components/soon";

/** Scheduling's public routes (/book, /book/[type], /memberships, /team). They exist only
 *  for setups with `scheduling` on; one without a scheduling config sees coming soon. */
export default async function SchedulingLayout({ children }: { children: React.ReactNode }) {
  await requireModule("scheduling");
  const setup = await getSetup();
  if (!setup.scheduling) return <SchedulingSoon setup={setup} />;
  return <>{children}</>;
}
