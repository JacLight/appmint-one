import type { Metadata } from "next";
import { requireSession } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { Events } from "@/modules/events/base/MyEvents";

export const metadata: Metadata = { title: "My tickets" };

/** My tickets (view, QR, transfer): base-app's my-account Events, inside the account shell. */
export default async function MyTicketsPage() {
  await requireSession();
  const session = await getSession();
  return <div className="ev-tw"><Events data={{ customer: session.customer }} /></div>;
}
