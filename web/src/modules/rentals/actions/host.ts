"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type ListingStatus, type StowboUnit, type HostBookInput, type HostResolve } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };

function refreshHost() {
  revalidatePath("/host");
  revalidatePath("/host/listings");
  revalidatePath("/host/custody");
  revalidatePath("/browse");
}

/** Save edits to a listing. Partial — only sends the fields provided. */
export async function updateListingAction(id: string, data: Record<string, any>): Promise<ActionResult> {
  try {
    await stowbo.host.updateListing(id, data);
    refreshHost();
    revalidatePath(`/host/listings/${id}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not save the listing.") };
  }
}

/** Publish / pause / unlist a listing. */
export async function setListingStatusAction(id: string, status: ListingStatus): Promise<ActionResult> {
  try {
    await stowbo.host.setListingStatus(id, status);
    refreshHost();
    revalidatePath(`/host/listings/${id}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update the listing status.") };
  }
}

export async function deleteListingAction(id: string): Promise<ActionResult> {
  try {
    await stowbo.host.deleteListing(id);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not delete the listing.") };
  }
}

/** Add a physical unit to a listing (listing = the listing's `name`). */
export async function addUnitAction(data: Partial<StowboUnit>): Promise<ActionResult> {
  try {
    await stowbo.host.createUnit(data);
    if (data.listing) revalidatePath(`/host/listings`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not add the unit.") };
  }
}

export async function updateUnitAction(id: string, data: Partial<StowboUnit>): Promise<ActionResult> {
  try {
    await stowbo.host.updateUnit(id, data);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update the unit.") };
  }
}

/** Take someone at the counter — create a booking for a walk-in. Availability still
 *  decides; a full space returns a clear error rather than overselling. */
export async function hostBookAction(data: HostBookInput): Promise<ActionResult> {
  try {
    if (!data.listing) return { ok: false, error: "Pick a space first." };
    await stowbo.host.book(data);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    const code = e?.response?.data?.code ?? e?.data?.code;
    if (code === "UNAVAILABLE") return { ok: false, error: "That space is full right now — nothing free to take." };
    return { ok: false, error: getErrorMessage(e, "Could not create the booking.") };
  }
}

/** Check IN one item: open its session and log it physically in, so it lands in "in your
 *  care". Check-in is idempotent, so this is also safe for bringing something back. */
export async function checkInAction(itemId: string): Promise<ActionResult> {
  try {
    // itemCheckin already records the first "in" movement — don't double it,
    // or the server rejects the second with "That is already here".
    await stowbo.host.itemCheckin(itemId);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not check them in.") };
  }
}

/** Log a physical in/out on one item — leaving or coming back DURING the session. NOT a
 *  check-out: the session stays open, the space stays held, nothing is billed. */
export async function movementAction(itemId: string, direction: "in" | "out"): Promise<ActionResult> {
  try {
    await stowbo.host.itemMovement(itemId, { direction });
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, direction === "out" ? "Could not log it out." : "Could not log it back in.") };
  }
}

/** Check OUT one item: close its session. The server refuses while it's still present,
 *  so move it out first — this is the only place the space frees. */
export async function checkOutAction(itemId: string): Promise<ActionResult> {
  try {
    await stowbo.host.itemMovement(itemId, { direction: "out" }).catch(() => null); // may already be out
    await stowbo.host.itemCheckout(itemId);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    if ((e?.response?.status ?? e?.status) === 409) return { ok: false, error: "Still has something here — move it out first." };
    return { ok: false, error: getErrorMessage(e, "Could not check out.") };
  }
}

/** Universal counter lookup — plate, phone, code, or bay. */
export async function resolveAction(q: string): Promise<{ ok: true; result: HostResolve } | { ok: false; error: string }> {
  try {
    if (!q || q.trim().length < 2) return { ok: false, error: "Type at least 2 characters." };
    return { ok: true, result: await stowbo.host.resolve(q.trim()) };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Search failed.") };
  }
}

/** Host accepts a drop-off — verify the guest's drop-off code, count, optional note. */
export async function dropoffAction(
  bookingId: string,
  data: { code: string; line?: number; unit?: string; condition?: string; declaredValue?: number },
): Promise<ActionResult> {
  try {
    await stowbo.host.dropoff(bookingId, data);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not accept the drop-off. Check the code and try again.") };
  }
}

/** Host hands an item back — verify the guest's pickup code. */
export async function retrieveAction(
  bookingId: string,
  data: { code: string; line?: number; condition?: string },
): Promise<ActionResult> {
  try {
    await stowbo.host.retrieve(bookingId, data);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not complete the hand-back. Check the pickup code.") };
  }
}

/** Close a stretch of days on a listing (maintenance / service). Returns any bookings already inside the window. */
export async function addBlackoutAction(
  id: string,
  data: { from: string; to: string; reason?: string; note?: string; units?: string[] },
): Promise<ActionResult & { conflicts?: any[] }> {
  if (!data.from || !data.to) return { ok: false, error: "Pick a start and end date." };
  if (new Date(data.to) <= new Date(data.from)) return { ok: false, error: "The end date must be after the start date." };
  try {
    const res: any = await stowbo.host.addBlackout(id, data);
    revalidatePath(`/host/listings/${id}`);
    return { ok: true, conflicts: res?.conflicts ?? [] };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not block those days.") };
  }
}

/** Re-open blacked-out days. */
export async function removeBlackoutAction(id: string, blackoutId: string): Promise<ActionResult> {
  try {
    await stowbo.host.removeBlackout(id, blackoutId);
    revalidatePath(`/host/listings/${id}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not re-open those days.") };
  }
}

function refreshBooking(bookingId: string) {
  revalidatePath(`/host/custody/${bookingId}`);
  revalidatePath("/host/custody");
  revalidatePath("/host/earnings");
  revalidatePath("/host");
}

/** Charge the guest more on a booking (damage / overstay / extra service). */
export async function chargeGuestAction(bookingId: string, data: { amount: number; category?: string; description?: string; line?: number }): Promise<ActionResult> {
  if (!data.amount || Number(data.amount) <= 0) return { ok: false, error: "Enter an amount greater than 0." };
  try { await stowbo.host.charge(bookingId, { ...data, amount: Number(data.amount) }); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not add the charge.") }; }
}

/** Refund / credit the guest. */
export async function refundGuestAction(bookingId: string, data: { amount: number; category?: string; description?: string }): Promise<ActionResult> {
  if (!data.amount || Number(data.amount) <= 0) return { ok: false, error: "Enter an amount greater than 0." };
  try { await stowbo.host.refund(bookingId, { ...data, amount: Number(data.amount) }); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not issue the refund.") }; }
}

/** Reverse an adjustment (keeps the audit trail). */
/** Undo one bill line (by its index in items[]). The original stays, struck through; its
 *  opposite is appended — so a disputed bill still explains itself. If the guest had
 *  already paid, the server refunds the difference to their card. */
export async function reverseLineAction(bookingId: string, index: number | string, reason?: string): Promise<ActionResult> {
  try { await stowbo.host.reverseLine(bookingId, index, reason); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not reverse that line.") }; }
}
/** @deprecated use reverseLineAction — kept for the legacy console. */
export const reverseAdjustmentAction = reverseLineAction;

/** Add a CATALOG add-on to a booking at the counter — paid or free. A service add-on
 *  (one the host physically does) also lands in the host's request queue. */
export async function addCatalogAddonAction(bookingId: string, input: { code: string; label: string; amount: number; quantity?: number }): Promise<ActionResult> {
  try {
    const qty = Math.max(1, Number(input.quantity ?? 1));
    const amount = Math.round(Number(input.amount ?? 0) * qty * 100) / 100;
    if (!(amount >= 0)) return { ok: false, error: "An add-on cannot cost less than nothing." };
    await stowbo.host.charge(bookingId, { kind: "addon", code: input.code, description: input.label, amount, allowZero: true });
    refreshBooking(bookingId);
    return { ok: true };
  } catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not add that add-on.") }; }
}

/** Hold the payout — guest is still captured, host's share is withheld until released. */
export async function holdPaymentAction(bookingId: string, reason?: string): Promise<ActionResult> {
  try { await stowbo.host.holdPayment(bookingId, reason); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not hold the payout.") }; }
}

export async function releasePaymentAction(bookingId: string): Promise<ActionResult> {
  try { await stowbo.host.releasePayment(bookingId); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not release the payout.") }; }
}

/** Cancel a booking — core frees the unit, voids the card hold and records any refund. */
export async function cancelBookingAction(bookingId: string, reason?: string, opts?: { noShow?: boolean }): Promise<ActionResult> {
  try { await stowbo.host.cancelBooking(bookingId, reason, opts?.noShow); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not cancel the booking.") }; }
}

/** Open a support claim (damage / dispute) on a booking. */
export async function openClaimAction(bookingId: string, data: { type?: string; description?: string; claimedAmount?: number; line?: number }): Promise<ActionResult> {
  try { await stowbo.host.openClaim(bookingId, data); refreshBooking(bookingId); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not open the claim.") }; }
}

/** Host responds to a guest request — acknowledge → ready → done (or decline). */
export async function respondRequestAction(bookingId: string, requestId: string, status: "acknowledged" | "ready" | "done" | "declined"): Promise<ActionResult> {
  try {
    await stowbo.host.respondRequest(bookingId, requestId, status);
    refreshHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update the request.") };
  }
}

/** Host settles a completed booking — captures the charge and credits the wallet. */
export async function settleAction(bookingId: string): Promise<ActionResult> {
  try {
    await stowbo.host.settle(bookingId);
    refreshHost();
    revalidatePath("/host/earnings");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not settle the booking.") };
  }
}

export type ApplyResult =
  | { ok: true; status: "active" | "pending" | string }
  | { ok: false; error: string };

/** Submit the host application. Returns the REAL enrollment status — never faked. */
export type CreateListingResult = { ok: true; id: string } | { ok: false; error: string };

/** Create a listing. status defaults to 'draft'; pass 'active' to publish now. */
export async function createListingAction(data: Record<string, any>): Promise<CreateListingResult> {
  try {
    const res: any = await stowbo.host.createListing(data);
    const id = res?.sk || res?.data?.name;
    if (!id) return { ok: false, error: getErrorMessage(res, "Could not create the listing.") };
    revalidatePath("/host");
    revalidatePath("/host/listings");
    revalidatePath("/browse");
    return { ok: true, id };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not create the listing.") };
  }
}

export async function applyHostAction(): Promise<ApplyResult> {
  try {
    const res: any = await stowbo.host.apply({ agreementAccepted: true });
    if (res?.success === false) {
      return { ok: false, error: res?.message || res?.error || "Could not submit application." };
    }
    // res.status is 'active' (auto-approved) or 'pending' (needs review) — pass it through as-is.
    revalidatePath("/host");
    revalidatePath("/account");
    return { ok: true, status: res?.status ?? "pending" };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not submit application.") };
  }
}

/** The add-on catalog a space offers — for the intake / reserve "Extras" picker. */
export type CatalogAddon = { name: string; title: string; price: number; chargeEvery?: string; service?: boolean };
export async function listingAddonsAction(listingId: string): Promise<CatalogAddon[]> {
  try {
    const env: any = await stowbo.listing(listingId);
    return (((env?.addOns ?? []) as any[]).map((e) => e?.data ?? e))
      .filter((a) => a?.name && a.status !== "inactive")
      .map((a) => ({ name: a.name, title: a.title || a.label || a.name, price: Number(a.price ?? 0), chargeEvery: a.chargeEvery, service: !!a.service }));
  } catch { return []; }
}

/** What cancelling / marking no-show would do to the money — shown before the button. */
export async function hostDuePreviewAction(bookingId: string, action: "cancel" | "no_show" | "checkout" | "current"):
  Promise<{ ok: true; due: import("@/api/rentals").BookingDue } | { ok: false; error: string }> {
  try { return { ok: true, due: await stowbo.host.due(bookingId, action) }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not preview that.") }; }
}

// ── Delegated pickup at the counter ────────────────────────────────────────────

/** What a scanned / typed pickup code is: whose items, what to check. Releases nothing. */
export async function resolveHandoverAction(code: string): Promise<{ ok: true; data: import("@/api/rentals").HandoverResolve } | { ok: false; error: string }> {
  try { return { ok: true, data: await stowbo.host.handover(code.trim()) }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "No pickup matches that code.") }; }
}

/** Hand over: the server checks the verification the pass demands, then moves the
 *  items out and checks them out, stamping who collected and what was verified. */
export async function completeHandoverAction(bookingId: string, input: { code: string; items?: string[]; verified: string[]; photos?: import("@/api/rentals").FileInfo[]; note?: string; collectorName?: string }): Promise<ActionResult> {
  try { await stowbo.host.completeHandover(input); refreshBooking(bookingId); revalidatePath("/host/handovers"); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not hand over.") }; }
}

/** Turn someone away. Nothing moves; the owner is told. */
export async function refusePickupAction(bookingId: string, itemId: string, input: { reason: string; who?: string; note?: string; delegation?: string; code?: string }): Promise<ActionResult> {
  try { await stowbo.host.refusePickup(itemId, input); refreshBooking(bookingId); revalidatePath("/host/handovers"); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not record the refusal.") }; }
}

/** A handover photo, from the counter — stored under the signed-in host's files. */
export async function uploadPhotoAction(form: FormData): Promise<{ ok: true; file: import("@/api/rentals").FileInfo } | { ok: false; error: string }> {
  try {
    const f = form.get("file");
    if (!(f instanceof File) || !f.size) return { ok: false, error: "Pick a photo." };
    if (f.size > 8 * 1024 * 1024) return { ok: false, error: "That photo is over 8 MB." };
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const fileName = `stowbo/handover/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const base64Data = Buffer.from(await f.arrayBuffer()).toString("base64");
    const r: any = await stowbo.uploadCustomerFile({ fileName, base64Data: `data:${f.type || "image/jpeg"};base64,${base64Data}` });
    // The upload returns the caller's file list; pick the entry we just wrote.
    const rows: any[] = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.files) ? r.files : r ? [r] : [];
    const hit = rows.find((x) => String(x?.path || x?.name || x?.key || "").includes(fileName.split("/").pop()!)) || rows[rows.length - 1];
    const url = hit?.url || hit?.signedUrl || hit?.publicUrl || hit?.src;
    if (!url) return { ok: false, error: "Upload finished but no file link came back." };
    return { ok: true, file: { url, path: hit?.path || fileName, contentType: f.type || undefined } };
  } catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not upload the photo.") }; }
}

/** One month of a listing's occupancy calendar for the host (GET host/listings/:id/calendar). */
export async function hostCalendarAction(listingId: string, from: string, days: number): Promise<{ ok: true; cal: import("@/api/rentals").StowboCalendar } | { ok: false; error: string }> {
  try { return { ok: true, cal: await stowbo.host.calendar(listingId, { from, days }) }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Couldn't load that month.") }; }
}
