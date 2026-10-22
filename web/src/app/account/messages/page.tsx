import { PageTitle } from "@/components/dashboard-shell";
import { Inbox } from "@/components/messages/inbox";
import { requireSession } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { inboxNote } from "@/lib/inbox-note";
import { community } from "@/lib/community";

export const metadata = { title: "Messages" };

export default async function AccountMessages() {
  await requireSession();
  const [threads, session] = await Promise.all([community.threads().catch(() => []), getSession()]);
  return (
    <>
      <PageTitle title="Messages" />
        <Inbox threads={threads} me={session.customer?.email ?? ""} base="account"
          emptyNote={inboxNote(await getSetup())} />
    </>
  );
}
