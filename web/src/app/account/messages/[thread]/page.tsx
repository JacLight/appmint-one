import { PageTitle } from "@/components/dashboard-shell";
import { Inbox } from "@/components/messages/inbox";
import { requireSession } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { inboxNote } from "@/lib/inbox-note";
import { community, type CommunityMessage, type ThreadSummary } from "@/lib/community";
import { markThreadReadAction } from "@/app/actions/community";

export const metadata = { title: "Conversation" };

function nameFor(threads: ThreadSummary[], msgs: { data?: CommunityMessage }[], email: string): string {
  for (const t of threads) {
    if (t.otherUser?.email === email) {
      const full = [t.otherUser.firstName, t.otherUser.lastName].filter(Boolean).join(" ").trim();
      if (full) return full;
      if (t.otherUser.company) return t.otherUser.company;
    }
  }
  for (const m of msgs) {
    const d = m.data;
    const info = d?.sender === email ? d?.senderInfo : d?.recipient === email ? d?.recipientInfo : undefined;
    const full = [info?.firstName, info?.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
  }
  return email;
}

export default async function AccountThread({ params }: { params: Promise<{ thread: string }> }) {
  await requireSession();
  const { thread } = await params;
  const email = decodeURIComponent(thread);

  const [threads, page, session] = await Promise.all([
    community.threads().catch(() => []),
    community.thread(email).catch(() => null),
    getSession(),
  ]);
  await markThreadReadAction(email);
  const msgs = page?.data ?? [];

  return (
    <>
      <PageTitle title="Messages" />
        <Inbox
          threads={threads}
          me={session.customer?.email ?? ""}
          base="account"
          emptyNote={inboxNote(await getSetup())}
          activeEmail={email}
          initial={msgs}
          otherName={nameFor(threads, msgs, email)}
        />
    </>
  );
}
