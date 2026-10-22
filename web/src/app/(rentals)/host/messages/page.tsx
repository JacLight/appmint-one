import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { Inbox } from "@/components/messages/inbox";
import { requireHost } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { getNav } from "@/lib/nav-server";
import { community } from "@/lib/community";

export const metadata = { title: "Messages" };

export default async function HostMessages() {
  await requireHost();
  const [threads, session] = await Promise.all([community.threads().catch(() => []), getSession()]);
  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Messages">
        <Inbox threads={threads} me={session.customer?.email ?? ""} base="host" />
      </DashboardShell>
    </>
  );
}
