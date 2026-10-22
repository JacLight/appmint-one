import { requireModule } from "@/lib/guards";

/** Rentals module routes (ported from stowbo-web). They exist only for setups with
 *  `rentals` on — anywhere else they 404. */
export default async function RentalsLayout({ children }: { children: React.ReactNode }) {
  await requireModule("rentals");
  return <>{children}</>;
}
