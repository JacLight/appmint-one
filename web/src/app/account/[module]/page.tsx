import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/dashboard-shell";
import { ComingSoon } from "@/components/coming-soon";
import { getSetup } from "@/lib/setup";
import { MODULES, isOn, moduleLabel } from "@/setups/modules";

/** The customer's own area of a module that isn't built yet (/account/scheduling …).
 *  Titled with the setup's own nav label ("Matters", "My tickets"). */
async function resolve(slug: string) {
  const setup = await getSetup();
  const def = Object.values(MODULES).find((m) => m.accountPath === `/account/${slug}`);
  if (!def || def.built || !isOn(setup, def.id)) return null;
  const navLabel = setup.nav.customer.find((n) => n.href === def.accountPath)?.label;
  return { setup, def, title: navLabel || moduleLabel(setup, def.id) };
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const r = await resolve((await params).module);
  return { title: r ? r.title : "Not found" };
}

export default async function AccountModulePage({ params }: { params: Promise<{ module: string }> }) {
  const r = await resolve((await params).module);
  if (!r) notFound();
  const { setup, def, title } = r;
  return (
    <>
      <PageTitle title={title} />
      <ComingSoon
        compact
        def={def}
        title={`Your ${title.replace(/^My /, "").toLowerCase()} will live here`}
        blurb={`We're putting the finishing touches on ${moduleLabel(setup, def.id).toLowerCase()} for ${setup.brand.name}. Until then, message us and we'll sort it for you.`}
        features={def.customer}
        primary={{ label: "Message us", href: "/account/messages" }}
        secondary={{ label: "Support", href: "/account/support" }}
      />
    </>
  );
}
