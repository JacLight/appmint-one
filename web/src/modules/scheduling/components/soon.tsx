import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ComingSoon } from "@/components/coming-soon";
import type { Setup } from "@/setups/types";
import { MODULES, moduleLabel } from "@/setups/modules";

/** A setup with Scheduling switched on but no `scheduling` config (the demo) keeps the
 *  clean coming-soon page instead of a half-configured booking screen. */
export function SchedulingSoon({ setup, account }: { setup: Setup; account?: boolean }) {
  const def = MODULES.scheduling;
  const label = moduleLabel(setup, "scheduling");
  const panel = (
    <ComingSoon def={def} title={label} compact={account} blurb={setup.moduleCopy?.scheduling?.blurb || `${label} is on its way to ${setup.brand.name}.`} features={def.customer}
      primary={{ label: "Go to your account", href: "/account" }} secondary={{ label: "Contact us", href: "/help#contact" }} />
  );
  if (account) return panel;
  return (<><SiteHeader /><main className="wrap soon-page">{panel}</main><SiteFooter /></>);
}
