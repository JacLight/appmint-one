import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { routes } from "@/lib/nav";
import { getSetup } from "@/lib/setup";
import { MODULES, moduleLabel } from "@/setups/modules";

export const metadata = { title: "Not found" };

export default async function NotFound() {
  const setup = await getSetup();
  const stowbo = setup.home.variant === "stowbo";
  const home = MODULES[setup.homeModule];
  return (
    <>
      <SiteHeader />
      <section className="sec" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <p className="eyebrow" style={{ color: "var(--primary-strong)" }}>{stowbo ? "404 — Nothing stored here" : "404 — Page not found"}</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,6vw,52px)", lineHeight: 1.05, margin: "8px 0 12px", letterSpacing: "-.02em" }}>
            {stowbo ? "This spot doesn’t exist" : "This page doesn’t exist"}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 17, lineHeight: 1.5, margin: "0 auto 26px", maxWidth: "44ch" }}>
            {stowbo
              ? "The page or listing you were after has moved, closed, or was never here. Plenty of other space to spare, though."
              : "The page you were after has moved or was never here."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {stowbo
              ? <Link className="btn clay lg" href={routes.browse} style={{ borderRadius: 13 }}>Browse spaces</Link>
              : <Link className="btn clay lg" href={home.path} style={{ borderRadius: 13 }}>{moduleLabel(setup, setup.homeModule)}</Link>}
            <Link className="btn ghost lg" href={routes.home} style={{ borderRadius: 13 }}>Back home</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
