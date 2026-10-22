import { requireModule } from "@/lib/guards";

/** Events module routes. They exist only for setups with `events` on —
 *  anywhere else they 404. */
export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("events");
  return <>{children}</>;
}
