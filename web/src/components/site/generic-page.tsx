import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SitePageView } from "./page-blocks";
import type { SitePage } from "@/setups/types";

/** Header + page blocks + footer — the frame of every Stowbo marketing page. */
export function GenericPage({ page }: { page: SitePage }) {
  return (
    <>
      <SiteHeader />
      <SitePageView page={page} />
      <SiteFooter />
    </>
  );
}
