import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireSession } from "@/lib/guards";
import { getNav } from "@/lib/nav-server";

/** Every /account page: signed-in guard, the setup's header, and the customer sidebar
 *  from the setup's nav (links to switched-off modules are dropped). */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const nav = await getNav();
  return (
    <>
      <SiteHeader />
      <DashboardShell nav={nav.customer}>{children}</DashboardShell>
    </>
  );
}
