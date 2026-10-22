"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type HostPaymentRequestInput, type PaymentRequestCreated, type PaymentRequestStatus, type HostPayment } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Raise a pay link + QR for the customer to settle themselves. */
export async function createPaymentRequestAction(input: HostPaymentRequestInput):
  Promise<{ ok: true; request: PaymentRequestCreated } | { ok: false; error: string }> {
  try {
    if (!(Number(input.amount) > 0)) return { ok: false, error: "Enter an amount." };
    const request = await stowbo.host.createPaymentRequest(input);
    revalidatePath("/host/payments");
    return { ok: true, request };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not create that payment request.") };
  }
}

/** Poll while the customer pays — the host is watching their own screen. */
export async function paymentRequestStatusAction(requestId: string):
  Promise<{ ok: true; status: PaymentRequestStatus } | { ok: false; error: string }> {
  try {
    return { ok: true, status: await stowbo.host.paymentRequestStatus(requestId) };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not check that payment.") };
  }
}

/** Collected + pending money for this host. */
export async function hostTransactionsAction():
  Promise<{ ok: true; rows: HostPayment[] } | { ok: false; error: string }> {
  try {
    const rows = await stowbo.host.transactions();
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not load your payments.") };
  }
}

/** Refund a collected payment — full (no amount) or partial. Writes its own refund row;
 *  the original is never mutated. */
export async function refundTransactionAction(ref: string, input: { amount?: number; reason?: string }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (input.amount != null && !(Number(input.amount) > 0)) return { ok: false, error: "Enter an amount greater than 0." };
    await stowbo.host.refundTransaction(ref, { ...(input.amount != null ? { amount: Number(input.amount) } : {}), ...(input.reason ? { reason: input.reason } : {}) });
    revalidatePath("/host/payments"); revalidatePath("/host/earnings"); revalidatePath("/host");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not refund that payment.") };
  }
}

/** (Re)send the receipt — to the booking's customer, or a typed email / phone. */
export async function sendReceiptAction(ref: string, input: { email?: string; phone?: string; bookingId?: string }):
  Promise<{ ok: true; to: "email" | "phone" | "customer" } | { ok: false; error: string }> {
  try {
    await stowbo.host.sendReceipt(ref, input);
    return { ok: true, to: input.email ? "email" : input.phone ? "phone" : "customer" };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not send the receipt.") };
  }
}

/** Void a still-unpaid request so its link / QR stops working. */
export async function cancelPaymentRequestAction(requestId: string):
  Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await stowbo.host.cancelPaymentRequest(requestId);
    revalidatePath("/host/payments"); revalidatePath("/host/earnings");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not cancel that request.") };
  }
}
