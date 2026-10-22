"use server";

import { revalidatePath } from "next/cache";
import { stowbo, createHostListingFee, type StowboListing } from "@/api/rentals";
import { community } from "@/lib/community";
import { getErrorMessage } from "@/lib/errors";
import { addReview, listingFees, toMarketQuote } from "./api";
import type { MarketQuote } from "./shared";

const CUR = "USD";

/** The server's price for one listing over a window — rendered as-is, never derived. */
export async function quoteStayAction(listingId: string, startDate: string, endDate: string):
  Promise<{ ok: true; quote: MarketQuote } | { ok: false; error: string }> {
  try {
    const q = await stowbo.quote({ items: [{ listing: listingId, startDate, endDate, quantity: 1 }], currency: CUR });
    const mq = toMarketQuote(q);
    if (!mq) return { ok: false, error: "Those dates can't be priced." };
    return { ok: true, quote: mq };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Those dates aren't available.") };
  }
}

export async function messageHostAction(bookingId: string, content: string): Promise<{ ok: boolean; to?: string; error?: string }> {
  try {
    const host = await stowbo.bookingHost(bookingId);
    const to = host?.email || host?.id;
    if (!to) return { ok: false, error: "This host can't be messaged right now." };
    await community.send({ recipientId: to, content, context: { event: "stowbo_booking", booking: bookingId } });
    return { ok: true, to };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Message not sent.") };
  }
}

export async function reviewAction(listingId: string, body: { rating: number; title?: string; message: string }, bookingId?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!(body.rating >= 1 && body.rating <= 5)) return { ok: false, error: "Pick a star rating." };
    if (!body.message?.trim()) return { ok: false, error: "Tell other guests a little about it." };
    await addReview(listingId, { rating: body.rating, title: body.title?.trim() || undefined, message: body.message.trim() });
    revalidatePath(`/listing/${listingId}`);
    if (bookingId) revalidatePath(`/account/bookings/${bookingId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not post your review.") };
  }
}

/* ───────────── host ───────────── */

export async function blockDatesAction(listingId: string, from: string, to: string, reason?: string): Promise<{ ok: boolean; error?: string; conflicts?: number }> {
  try {
    const r = await stowbo.host.addBlackout(listingId, { from, to, reason: reason || "Blocked by host" });
    revalidatePath("/host/calendar");
    return { ok: true, conflicts: (r?.conflicts || []).length };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not block those dates.") };
  }
}
export async function unblockAction(listingId: string, blackoutId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await stowbo.host.removeBlackout(listingId, blackoutId);
    revalidatePath("/host/calendar");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not unblock.") };
  }
}

export async function listingStatusAction(listingId: string, status: "active" | "paused"): Promise<{ ok: boolean; error?: string }> {
  try {
    await stowbo.host.setListingStatus(listingId, status);
    revalidatePath("/host/listings");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not change the listing.") };
  }
}

export interface MarketListingForm {
  vertical: string; market?: string; unit: "night" | "day" | "hour";
  title: string; spaceType: string; description: string; bookingInstructions?: string;
  address: { street1?: string; city?: string; state?: string; zip?: string; country?: string };
  location?: { lat: number; lng: number } | null;
  features: string[]; images: string[];
  price: number; minimum: number; cleaningFee?: number; deposit?: number;
  cancellationPolicy: "flexible" | "moderate" | "strict";
  taxRate?: number; details: Record<string, any>; status?: "active" | "draft";
}

/** Create or update a marketplace listing the signed-in host owns. Rates are posted
 *  bands the server prices from; the cleaning fee is the host's own fee record. */
export async function saveMarketListingAction(id: string | null, f: MarketListingForm):
  Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (!f.title?.trim()) return { ok: false, error: "Give your listing a name." };
    if (!(f.price > 0)) return { ok: false, error: "Set a price." };
    if (!f.images.length) return { ok: false, error: "Add at least one photo." };
    const per = f.unit === "hour" ? "hour" : "day";
    const minMinutes = f.unit === "night" ? Math.max(0, (f.minimum - 1) * 1440) + 60 : f.unit === "hour" ? Math.max(1, f.minimum) * 60 : Math.max(1, f.minimum) * 1440;
    const body: Partial<StowboListing> & Record<string, any> = {
      title: f.title.trim(), spaceType: f.spaceType, description: f.description, bookingInstructions: f.bookingInstructions,
      address: { ...f.address, country: f.address.country || "US" },
      ...(f.location ? { location: f.location } : {}),
      exclusive: true, capacity: 1, allowMultiUnitBooking: false,
      features: f.features, images: f.images.map((url) => ({ url, contentType: "image/jpeg", isPublic: true })),
      price: f.price, priceUnit: per,
      rates: { mode: "posted", rounding: "up", minMinutes, ...(per === "hour" ? { increment: 60 } : {}),
        bands: [{ charge: "per_period", amount: f.price, per, label: f.unit === "night" ? "Nightly rate" : per === "hour" ? "Hourly rate" : "Daily rate" }] } as any,
      payment: { upfront: 100, deposit: Math.max(0, Number(f.deposit || 0)), depositRefundable: true },
      cancellationPolicy: f.cancellationPolicy,
      ...(f.taxRate != null ? { taxRate: f.taxRate, taxJurisdiction: [f.address.city, f.address.state].filter(Boolean).join(", ") } : {}),
    };
    let listingId = id;
    if (!listingId) {
      const created: any = await stowbo.host.createListing({ ...body, vertical: f.vertical, parent: f.market, details: f.details, status: f.status || "active", unitLabel: f.unit === "night" ? "home" : "kit", accessHours: "by arrangement", staffing: f.unit === "night" ? "unmanned" : "manned" } as any);
      listingId = String(created?.sk || created?.data?.sk || "");
      if (!listingId) return { ok: false, error: "Could not create the listing." };
    } else {
      // The engine's host edit (PUT host/listings/:id) takes the listing's own fields;
      // `details` (rooms, rules, kit list) is set when the listing is created.
      await stowbo.host.updateListing(listingId, body as any);
    }
    // Cleaning fee: one host fee per listing, uniquely named so it never resolves to another host's fee.
    if (f.cleaningFee != null) {
      const detail: any = await stowbo.host.listing(listingId).catch(() => null);
      const lname = String(detail?.listing?.data?.name || listingId);
      const want = `clean-${lname}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const attached = await listingFees(listingId);
      const existing = attached.find((x: any) => x?.data?.name === want || /clean|prep/i.test(String(x?.data?.title || x?.data?.name || "")));
      const keep = attached.map((x: any) => String(x?.data?.name || x?.name)).filter((n) => n && n !== String(existing?.data?.name || ""));
      if (f.cleaningFee > 0) {
        if (existing) await stowbo.host.updateFee(String(existing.sk), { amount: f.cleaningFee, status: "active" } as any);
        else await apiCreateListingFee(listingId, { name: want, title: f.unit === "night" ? "Cleaning fee" : "Prep & cleaning", description: "Turnover after your stay", paidBy: "guest", trigger: "booking", appliesTo: "checkout", basis: "fixed", amount: f.cleaningFee, taxable: true, refundable: true, status: "active" });
        await stowbo.host.setListingFees(listingId, [...keep, String(existing?.data?.name || want)]);
      } else if (existing) {
        await stowbo.host.setListingFees(listingId, keep);
      }
    }
    revalidatePath("/host/listings");
    revalidatePath(`/listing/${listingId}`);
    return { ok: true, id: listingId };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not save the listing.") };
  }
}

async function apiCreateListingFee(listingId: string, data: Record<string, any>) {
  return createHostListingFee(listingId, data);
}
