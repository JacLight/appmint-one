import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { resolveSetup, SETUPS, type ResolvedSetup } from "@/setups";
import type { ModuleId, Setup } from "@/setups/types";
import { isOn } from "@/setups/modules";
import { runtimeEnv } from "./runtime-env";

/** The active setup, chosen by env PORTAL_SETUP at RUNTIME (one image, many setups).
 *  `connection()` opts the caller into request-time rendering so a prerender never
 *  freezes the build machine's setup into the page. */
export const getResolvedSetup = cache(async (): Promise<ResolvedSetup> => {
  await connection();
  if (setupSwitchAllowed()) {
    // medical.localhost:3710 → medical (each setup in its own tab, own cookies).
    const host = ((await headers()).get("host") || "").toLowerCase();
    const label = host.split(":")[0].endsWith(".localhost") ? host.split(".")[0] : "";
    if (label && SETUPS.some((s) => s.id === label)) return resolveSetup(label);
    const picked = (await cookies()).get(SETUP_COOKIE)?.value?.toLowerCase();
    if (picked && SETUPS.some((s) => s.id === picked)) return resolveSetup(picked);
  }
  return resolveSetup(runtimeEnv("PORTAL_SETUP"));
});

/** Cookie that overrides PORTAL_SETUP (after the <setup>.localhost host), so one server can preview every setup.
 *  Only honoured in dev, or when PORTAL_SETUP_SWITCH=1 (a preview deployment). */
export const SETUP_COOKIE = "one_setup";

export function setupSwitchAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || runtimeEnv("PORTAL_SETUP_SWITCH") === "1";
}

export async function getSetup(): Promise<Setup> {
  return (await getResolvedSetup()).setup;
}

/** Synchronous variant for places that cannot await (metadata routes already awaited
 *  connection). Reads the same env. */
export function getSetupNow(): Setup {
  return resolveSetup(runtimeEnv("PORTAL_SETUP")).setup;
}

export async function moduleOn(id: ModuleId): Promise<boolean> {
  return isOn(await getSetup(), id);
}
