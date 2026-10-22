import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ComingSoon } from "@/components/coming-soon";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { MODULES, isOn, moduleLabel } from "@/setups/modules";

/** Public entry for a module that isn't built yet (/book, /send, /shop, /events,
 *  /banking, /learn). Built modules own real routes, which win over this one.
 *  Anything that isn't an enabled module's path is a 404. */
async function resolve(slug: string) {
  const setup = await getSetup();
  const def = Object.values(MODULES).find((m) => m.path === `/${slug}`);
  if (!def || def.built || !isOn(setup, def.id)) return null;
  return { setup, def };
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const r = await resolve((await params).module);
  return r ? { title: moduleLabel(r.setup, r.def.id) } : { title: "Not found" };
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const r = await resolve((await params).module);
  if (!r) notFound();
  const { setup, def } = r;
  const session = await getSession();
  const label = moduleLabel(setup, def.id);
  return (
    <>
      <SiteHeader />
      <main className="wrap soon-page">
        <ComingSoon
          def={def}
          title={label}
          blurb={setup.moduleCopy?.[def.id]?.blurb || `${label} is on its way to ${setup.brand.name}.`}
          features={def.customer}
          primary={session.signedIn ? { label: "Go to your account", href: "/account" } : { label: "Create your account", href: "/signup" }}
          secondary={{ label: "Contact us", href: session.signedIn ? "/account/messages" : "/help#contact" }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
