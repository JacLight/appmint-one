"use server";

import { revalidatePath } from "next/cache";
import { cancelDelivery, completeDeliveryPayment, deliveryPaymentIntent, getDeliveryJob, rateDelivery, reportDeliveryIssue, trackDelivery } from "@/api/logistics";
import type { JobEnvelope, TrackView } from "@/modules/logistics/lib/types";
import { getSession } from "@/lib/auth";
import { community } from "@/lib/community";
import { getErrorMessage } from "@/lib/errors";

const ACCOUNT = "/account/logistics";

/** A fresh PaymentIntent for an order that was created but never paid. The engine
 *  charges the job's own price. */
export async function payExistingAction(jobId: string):
  Promise<{ ok: true; clientSecret: string; paymentIntentId: string; amount: number } | { ok: false; error: string }> {
  try {
    const r = await deliveryPaymentIntent(jobId);
    if (!r?.clientSecret) return { ok: false, error: "We couldn’t start the payment. Please try again." };
    return { ok: true, clientSecret: r.clientSecret, paymentIntentId: r.paymentIntentId, amount: Number(r.amount) };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t start the payment.") };
  }
}

/** Step 3: the card was confirmed with Stripe in the browser — the engine verifies
 *  the PaymentIntent itself and only then releases the job to drivers. */
export async function completePaymentAction(jobId: string, paymentIntentId: string):
  Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await completeDeliveryPayment(jobId, paymentIntentId);
    revalidatePath(ACCOUNT);
    revalidatePath(`${ACCOUNT}/${jobId}`);
    revalidatePath(`/trip/${jobId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Your card wasn’t charged. Please try again.") };
  }
}

export async function cancelAction(jobId: string, reason?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await cancelDelivery(jobId, reason);
  } catch (e: any) {
    // The engine cancels the job before it writes the refund details; a failure on
    // that second write still leaves the job cancelled. Trust the job, not the reply.
    const now = await getDeliveryJob(jobId).catch(() => null);
    if (now?.data?.status !== "cancelled") return { ok: false, error: getErrorMessage(e, "We couldn’t cancel this.") };
  }
  revalidatePath(ACCOUNT);
  revalidatePath(`${ACCOUNT}/${jobId}`);
  revalidatePath(`/trip/${jobId}`);
  return { ok: true };
}

export async function rateAction(jobId: string, rating: number, comment?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Pick 1 to 5 stars." };
    await rateDelivery(jobId, Math.round(rating), comment?.trim() || undefined);
    revalidatePath(`${ACCOUNT}/${jobId}`);
    revalidatePath(`/trip/${jobId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t save your rating.") };
  }
}

export async function reportIssueAction(jobId: string, type: string, description?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!type) return { ok: false, error: "Pick what went wrong." };
    await reportDeliveryIssue(jobId, { type, description: description?.trim() || undefined });
    revalidatePath(`${ACCOUNT}/${jobId}`);
    revalidatePath(`/trip/${jobId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send that. Message support instead.") };
  }
}

/** Open (or continue) the conversation with the other side of a job, through the
 *  app's shared messages. `to` is a customer id or email; returns the thread key. */
export async function messageAction(to: string, content: string, context: { jobId: string; jobNumber?: string; label: string }):
  Promise<{ ok: true; thread: string } | { ok: false; error: string }> {
  if (!to) return { ok: false, error: "No one to message yet." };
  if (!content.trim()) return { ok: false, error: "Type a message first." };
  try {
    const m: any = await community.send({ recipientId: to, content: content.trim(), context: { event: context.jobId, eventName: context.label } });
    const d = m?.data ?? m;
    const me = (await getSession()).customer?.email;
    const other = d?.recipient && d.recipient !== me ? d.recipient : d?.sender && d.sender !== me ? d.sender : to;
    revalidatePath("/account/messages");
    return { ok: true, thread: String(other) };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send that message.") };
  }
}

/** The live poll: the job plus the tracking view (driver card, live location). */
export async function pollJobAction(jobId: string): Promise<{ job: JobEnvelope | null; track: TrackView | null }> {
  const [job, track] = await Promise.all([getDeliveryJob(jobId).catch(() => null), trackDelivery(jobId).catch(() => null)]);
  return { job, track };
}
