import type { Setup } from "@/setups/types";
import type { AuthCopy } from "@/components/auth/login-form";
import { hasProviderSide, lower, term } from "@/setups/modules";

/** Sign-in / sign-up card copy for a setup: its own words when given, else derived. */
export function authCopy(setup: Setup): AuthCopy {
  const a = setup.auth || {};
  const provider = term(setup, "provider").toLowerCase();
  const customer = term(setup, "customer").toLowerCase();
  const providerSide = hasProviderSide(setup);
  return {
    brandName: setup.brand.name,
    loginLead: a.loginLead || `Sign in to your ${setup.brand.name} account.`,
    signupLead: a.signupLead || setup.brand.tagline,
    roleNote: a.roleNote ?? (providerSide ? `One account works as a ${customer} and as a ${provider}.` : undefined),
    providerCta: a.providerCta ?? (providerSide && setup.headerCta ? { prompt: `Are you a ${provider}?`, label: setup.headerCta.label, href: setup.headerCta.href } : undefined),
    phoneHint: `For ${lower(setup, "booking")} updates`,
  };
}
