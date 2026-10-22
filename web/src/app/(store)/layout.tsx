import { requireModule } from "@/lib/guards";

/** Store module routes (/shop…, /eat…). They exist only for setups with `store` on —
 *  anywhere else they 404. Each page also checks the variant (retail / food). */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await requireModule("store");
  return <>{children}</>;
}
