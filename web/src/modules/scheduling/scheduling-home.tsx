import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { StudioHome } from "./components/home/studio-home";
import { ClinicHome } from "./components/home/clinic-home";
import { FirmHome } from "./components/home/firm-home";

/** Home for a Scheduling business: the studio's timetable, the clinic's "book a visit",
 *  the firm's "book a consultation". */
export async function SchedulingHome() {
  const setup = await getSetup();
  const cfg = setup.scheduling!;
  return (
    <>
      <SiteHeader />
      <main>
        {cfg.style === "studio" ? <StudioHome setup={setup} cfg={cfg} /> : cfg.style === "clinic" ? <ClinicHome setup={setup} cfg={cfg} /> : <FirmHome setup={setup} cfg={cfg} />}
      </main>
      <SiteFooter />
    </>
  );
}
