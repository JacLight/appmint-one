import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { getNav } from "@/lib/nav-server";
import { requireSchedulingArea, requireTeamMember } from "@/modules/scheduling/lib/guards";

/** Scheduling's provider route (/provider/schedule).
 *  Only where Scheduling owns the provider area; team members only. */
export default async function SchedulingProviderLayout({ children }: { children: React.ReactNode }) {
  await requireSchedulingArea();
  await requireTeamMember();
  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider}><div className="scm">{children}</div></DashboardShell>
    </>
  );
}
