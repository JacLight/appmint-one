import "server-only";
import { bookingTypes } from "./data";

/**
 * The Scheduling provider signal: the signed-in customer's email is a host of one of
 * this business's active booking types (reservation definition `hosts`), read from the
 * public definitions.
 */
export async function isSchedulingProvider(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const types = await bookingTypes().catch(() => []);
  return types.some((t) => t.hosts.includes(e));
}
