import { requireModule } from "@/lib/guards";

/** Events module account routes (/account/events, /account/ticket-orders). Only for
 *  setups with `events` on — anywhere else they 404. */
export default async function EventsAccountLayout({ children }: { children: React.ReactNode }) {
  await requireModule("events");
  return <>{children}</>;
}
