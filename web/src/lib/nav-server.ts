import "server-only";
import { getSetup } from "./setup";
import { visibleNav } from "@/setups/modules";
import type { NavItem } from "./nav";

export interface SetupNav {
  public: NavItem[];
  customer: NavItem[];
  provider: NavItem[];
}

/** The active setup's nav per role, with links to switched-off modules removed. */
export async function getNav(): Promise<SetupNav> {
  const setup = await getSetup();
  const strip = (l: { label: string; href: string }) => ({ label: l.label, href: l.href });
  return {
    public: visibleNav(setup, setup.nav.public).map(strip),
    customer: visibleNav(setup, setup.nav.customer).map(strip),
    provider: setup.roles.includes("provider") ? visibleNav(setup, setup.nav.provider).map(strip) : [],
  };
}
