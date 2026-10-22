import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ComingSoon } from "@/components/coming-soon";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { MODULES, hasProviderSide, term } from "@/setups/modules";
import type { Setup } from "@/setups/types";

/** The provider area (door staff / attorney / clinician / coach) for setups whose
 *  provider home is /provider but whose provider side isn't built yet: one clean page
 *  for every /provider/* link in the setup's provider nav. Rentals hosts use /host;
 *  Logistics drivers get the real driver app (src/app/provider/page.tsx). */
export async function providerSetup(): Promise<Setup | null> {
  const setup = await getSetup();
  if (!hasProviderSide(setup) || setup.provider?.home !== "/provider") return null;
  return setup;
}

export async function providerComingSoonMetadata(): Promise<Metadata> {
  const setup = await providerSetup();
  return { title: setup ? `For ${term(setup, "provider").toLowerCase()}s` : "Not found" };
}

export async function ProviderComingSoon() {
  const setup = await providerSetup();
  if (!setup) notFound();
  const session = await getSession();
  const provider = term(setup, "provider");
  const features = setup.modules.flatMap((m) => MODULES[m].provider || []);
  const def = MODULES[setup.homeModule];
  return (
    <>
      <SiteHeader />
      <main className="wrap soon-page">
        <ComingSoon
          def={def}
          title={`${setup.brand.name} for ${provider.toLowerCase()}s`}
          blurb={`The ${provider.toLowerCase()} side of ${setup.brand.name} — same account, switched on by role. It's on its way.`}
          features={features.length ? features : ["Your schedule", "Messages", "Earnings and payouts"]}
          primary={session.signedIn ? { label: "Go to your account", href: "/account" } : { label: `Sign up as a ${provider.toLowerCase()}`, href: "/signup" }}
          secondary={{ label: "Payouts & wallet", href: "/account/wallet" }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
