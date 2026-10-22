import type { Setup } from "./types";
import { muvmnt } from "./muvmnt";
import { eventOxygen } from "./event-oxygen";
import { stowbo } from "./stowbo";
import { rental } from "./rental";
import { lawFirm } from "./law-firm";
import { medical } from "./medical";
import { studio } from "./studio";
import { bank } from "./bank";
import { demo } from "./demo";
import { academy } from "./academy";
import { stays } from "./stays";
import { shop } from "./shop";
import { residences } from "./residences";

export type { Setup } from "./types";

/** Order and ids match the mobile portal (appmint_portal/lib/config/setup.dart). */
export const SETUPS: Setup[] = [muvmnt, eventOxygen, stowbo, rental, lawFirm, medical, studio, bank, demo, academy, stays, shop, residences];
export const DEMO_SETUP = demo;

export interface ResolvedSetup {
  setup: Setup;
  /** The id that was asked for (env PORTAL_SETUP), as given. */
  requestedId: string;
  /** True when an id was given but is unknown — a deployment misconfiguration. */
  isFallback: boolean;
}

/** Case-insensitive lookup; missing → demo; unknown → demo with isFallback. */
export function resolveSetup(requested: string | undefined | null): ResolvedSetup {
  const raw = (requested || "").trim();
  const id = raw.toLowerCase();
  if (!id) return { setup: demo, requestedId: raw, isFallback: false };
  const found = SETUPS.find((s) => s.id === id);
  return found ? { setup: found, requestedId: raw, isFallback: false } : { setup: demo, requestedId: raw, isFallback: true };
}
