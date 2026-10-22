import { requireModule } from "@/lib/guards";
import "@/modules/property/property.css";

/** Property module routes (/homes, /homes/[id], /apply/[unitId]). They exist only for
 *  setups with `property` on — anywhere else they 404. */
export default async function PropertyLayout({ children }: { children: React.ReactNode }) {
  await requireModule("property");
  return <>{children}</>;
}
