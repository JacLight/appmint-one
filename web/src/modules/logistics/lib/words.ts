import type { Setup } from "@/setups/types";
import { term } from "@/setups/modules";
import type { Words } from "./status";

/** The setup's words for the Logistics screens ("Delivery", "Deliveries", "Driver"). */
export function wordsFor(setup: Setup): Words {
  return { job: term(setup, "job"), jobs: term(setup, "jobs"), provider: term(setup, "provider") };
}
