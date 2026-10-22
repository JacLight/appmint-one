import { requireModule } from "@/lib/guards";

/** Logistics module routes. They exist only for setups with `logistics` on —
 *  anywhere else they 404. */
export default async function LogisticsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("logistics");
  return <>{children}</>;
}
