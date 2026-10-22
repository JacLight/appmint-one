"use server";

import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/errors";
import * as R from "@/api/reservations";

/** The engine calls behind the ported base-app screens (reservation-system/api.ts). */

type Result = { ok: true; data?: any } | { ok: false; error: string };

const MINE = "/account/scheduling";
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Open times for a run of days, with the booking being moved left free. */
export async function availabilityAction(q: {
  reservationDefinitionId: string; serviceName?: string; from?: string; days?: number; host?: string; excludeReservationId?: string;
}): Promise<Result> {
  try {
    const data = await R.getAvailability({
      reservationDefinitionId: str(q.reservationDefinitionId, 40),
      serviceName: q.serviceName ? str(q.serviceName, 200) : undefined,
      from: q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? q.from : undefined,
      days: Math.min(31, Math.max(1, Number(q.days) || 7)),
      host: q.host ? str(q.host, 200) : undefined,
      excludeReservationId: q.excludeReservationId ? str(q.excludeReservationId, 40) : undefined,
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "The open times could not be loaded. Try again.") };
  }
}

/** The customer moves their booking, found by the email on it and its confirmation code. */
export async function rescheduleByEmailAction(email: string, code: string, body: { startTime: string; reason?: string }): Promise<Result> {
  if (!body?.startTime || Number.isNaN(Date.parse(body.startTime))) return { ok: false, error: "Pick a new time first." };
  try {
    const data = await R.rescheduleByEmail(str(email, 200), str(code, 20), body.startTime, body.reason ? str(body.reason, 500) : undefined);
    revalidatePath(MINE);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "The booking could not be moved. Try another time.") };
  }
}

/** The customer cancels, by the email on the booking and its code; the engine keeps it, marked cancelled. */
export async function cancelByEmailAction(email: string, code: string, reason?: string): Promise<Result> {
  try {
    await R.cancelByEmail(str(email, 200), str(code, 20), reason ? str(reason, 500) : undefined);
    revalidatePath(MINE);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "The booking could not be cancelled. Try again.") };
  }
}
