import type { Setup } from "@/setups/types";
import { isOn, term } from "@/setups/modules";

/** Empty-inbox line in the setup's words. Rentals keeps Stowbo's exact sentence. */
export function inboxNote(setup: Setup): string {
  if (isOn(setup, "rentals")) return `Message a ${term(setup, "provider").toLowerCase()} about a ${term(setup, "item").toLowerCase()} and it lives here.`;
  return `Conversations with ${setup.brand.name} and your ${term(setup, "provider").toLowerCase()} live here.`;
}
