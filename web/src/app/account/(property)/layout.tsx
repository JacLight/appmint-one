import { requireModule } from "@/lib/guards";
import "@/modules/property/property.css";

/** The resident portal (/account/home, rent, requests, notices, applications). Only for
 *  setups with `property` on — anywhere else they 404. */
export default async function PropertyAccountLayout({ children }: { children: React.ReactNode }) {
  await requireModule("property");
  return <div className="pm">{children}</div>;
}
