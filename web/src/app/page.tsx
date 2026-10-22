import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SetupHome } from "@/components/home/setup-home";
import { getSetup } from "@/lib/setup";
import { StowboHome } from "@/modules/rentals/stowbo-home";
import { MarketHome } from "@/modules/rentals/market/market-home";
import { MuvmntHome } from "@/modules/logistics/muvmnt-home";
import { EventsHome } from "@/modules/events/events-home";
import { AcademyHome } from "@/modules/lms/academy-home";
import { StoreHome } from "@/modules/store/store-home";
import { BankHome } from "@/modules/money/components/home/bank-home";
import { SchedulingHome } from "@/modules/scheduling/scheduling-home";
import { PropertyHome } from "@/modules/property/property-home";

/** Home: the active setup's sections — or, for the Stowbo setup, Stowbo's own
 *  marketplace home (identical to stowbo-web). */
export default async function Home() {
  const setup = await getSetup();
  if (setup.home.variant === "stowbo") return <StowboHome />;
  if (setup.home.variant === "market") return <MarketHome />;
  if (setup.home.variant === "muvmnt") return <MuvmntHome />;
  if (setup.home.variant === "events") return <EventsHome />;
  if (setup.home.variant === "academy") return <AcademyHome />;
  if (setup.home.variant === "store") return <StoreHome />;
  if (setup.home.variant === "bank") return <BankHome />;
  if (setup.home.variant === "scheduling" && setup.scheduling) return <SchedulingHome />;
  if (setup.home.variant === "property" && setup.property) return <PropertyHome />;
  return (
    <>
      <SiteHeader />
      <main>
        <SetupHome setup={setup} />
      </main>
      <SiteFooter />
    </>
  );
}
