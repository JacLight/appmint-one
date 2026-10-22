import "server-only";
/**
 * Rentals (Stowbo) — every engine call for listings, availability, checkout,
 * bookings and hosting. Typed client over the appengine `client/stowbo/*` routes
 * (stowbo-client.controller), plus listing reviews (generic `comments/*`) and the
 * org's maps key (`shipping/google-keys`).
 * Moved from src/modules/rentals/lib/stowbo.ts (ported from stowbo-web) — logic unchanged.
 * Every record comes back as an AppMint Envelope { sk, name, data: {...} }.
 */
import { apiReq, type Envelope, type Paged } from "@/lib/api";

const P = "client/stowbo";

/* ───────────────────────── data models (record `.data`) ───────────────────────── */

export type PriceUnit = "hour" | "day" | "week" | "month";
export type Staffing = "manned" | "unmanned";
export type AccessHours = "24/7" | "daytime" | "by arrangement";
export type ListingStatus = "draft" | "active" | "paused" | "inactive";

export interface Address {
  street1?: string; street2?: string; city?: string; zip?: string;
  state?: string; country?: string; name?: string; phone?: string;
}
export interface FileInfo {
  path?: string; url?: string; contentType?: string; isPublic?: boolean;
  meta?: { width?: number; height?: number; size?: number };
}

/** Tariff (SDK RateSchedule). `mode:'progressive'` = time-in-bands; `'posted'` = flat. */
export interface RateBand { upToMinutes?: number; amount: number; per?: "minute" | "hour" | "day" | "week" | "month" }
export interface RateSchedule {
  mode?: "posted" | "progressive"; bands?: RateBand[]; increment?: number;
  rounding?: string; minMinutes?: number; maxMinutes?: number; minCharge?: number;
  cap?: { amount?: number; per?: string };
}
/** Real "access hours" model (SDK AvailabilitySchema) — drives valid time slots. */
export interface AvailabilitySchema {
  from?: string; to?: string;
  windows?: { days?: string[]; opens?: string; closes?: string; label?: string }[];
  slotMinutes?: number; bufferMinutes?: number;
}
export type CancellationPolicy = "flexible" | "moderate" | "strict";

export interface StowboListing {
  name: string;
  title: string;
  parent?: string;          // parent listing `name`; empty = top-level
  spaceType?: string;
  exclusive?: boolean;
  capacity?: number;
  unitLabel?: string;
  size?: string;
  address?: Address;
  location?: { lat?: number; lng?: number; placeId?: string; placeName?: string };
  accessHours?: AccessHours;
  availability?: AvailabilitySchema;   // the real time-window/slot model
  staffing?: Staffing;
  // How THIS host runs the hand-off — auto-shown to the guest after booking.
  bookingInstructions?: string;
  features?: string[];
  images?: FileInfo[];
  description?: string;
  price?: number;
  priceUnit?: PriceUnit;
  rates?: RateSchedule;                // canonical tariff
  payment?: { upfront?: number; deposit?: number; depositRefundable?: boolean };  // how much taken up front + hold
  fees?: string[];                     // fee NAMES attached to this listing (the fee itself is a stowbo_fee record)
  taxRate?: number;
  taxJurisdiction?: string;
  protectionFee?: number;
  cancellationPolicy?: CancellationPolicy;
  blackouts?: any[];
  bookingStyle?: "instant" | "review";
  allowMultiUnitBooking?: boolean;
  addOns?: string[];
  status?: ListingStatus;
}

export type UnitStatus = "vacant" | "reserved" | "occupied" | "maintenance" | "overlocked";
export interface StowboUnit {
  name: string;
  unitNumber?: string;
  listing: string;          // required — parent listing `name`
  status?: UnitStatus;
  booking?: string;         // occupying booking `name`, if any
  location?: { lat?: number; lng?: number; placeId?: string; placeName?: string };
  accessCode?: string;
  notes?: string;
  images?: FileInfo[];
}

export interface StowboAddOn {
  name: string;
  title?: string;
  label?: string;
  description?: string;
  price?: number;           // 0 = free
  chargeEvery?: "once" | "hour" | "day" | "week" | "month" | "item" | "person";
  required?: boolean;
  service?: boolean;        // true = the host physically does something to fulfil it
  status?: "active" | "inactive";
}

/** A host coupon — a storefront discount record the server keys to the host:
 *  `applyTo: 'stowbo'` + `merchant` = the host id, so it only ever matches that host's
 *  listings (any of them, now or later); `products` optionally narrows it to listing
 *  codes. Empty `products` = all of the host's spaces. */
export interface HostDiscount {
  code: string; name?: string; description?: string;
  type?: "percent" | "fixed"; value?: number; maxDiscount?: number | null;
  minCartValue?: number | null; firstOrderOnly?: boolean;
  startDate?: string | null; endDate?: string | null;
  usageLimit?: number | null; usageLimitPerCustomer?: number | null; usageCount?: number;
  status?: "active" | "inactive" | "draft" | "retired";
  /** the host this code belongs to — matched against each listing's owner */
  merchant?: string;
  /** listing codes this coupon is narrowed to; empty = all of the host's listings.
   *  Older rows used `rentalItems`. */
  products?: string[]; rentalItems?: string[]; listings?: string[];
  applyTo?: string; hostId?: string;
}

/** A fee — its own record like an add-on, attached to listings by NAME. A host's fee
 *  is always `type:'host'`; platform / tax / processing fees apply org-wide. */
export interface StowboFee {
  name: string;
  title?: string;
  description?: string;
  code?: string;
  type?: "host" | "platform" | "tax" | "processing";
  paidBy?: "guest" | "host";           // guest = a row on the bill; host = off the payout
  trigger?: "booking" | "cancellation" | "late_pickup" | "no_show";
  appliesTo?: "checkout" | "item";     // once per order, or × quantity
  basis?: "fixed" | "percent";         // amount is money, or % of the space lines
  amount?: number;
  priceFrom?: number | null; priceTo?: number | null;   // order-subtotal band
  minFee?: number | null; maxFee?: number | null;       // floor / cap on the computed fee
  channels?: string[];
  spaceTypes?: string[];
  validFrom?: string | null; validTo?: string | null;
  taxable?: boolean;
  refundable?: boolean;
  sortOrder?: number;
  status?: "active" | "inactive";
}

export type BookingStatus =
  | "requested" | "confirmed" | "in_custody" | "overdue" | "retrieved" | "settled"
  | "disputed" | "abandoned" | "cancelled" | "no_show";
export type LineState = "booked" | "stored" | "retrieved" | "damaged" | "lost" | "abandoned";

export interface BookingAddOn { name: string; price: number; chargeEvery: string; quantity: number; subtotal?: number; }
export interface BookingItem {
  listing: string;
  unit?: string;
  quantity: number;
  startDate: string;
  endDate: string;
  addOns?: BookingAddOn[];
  tags?: string[];
  declaredValue?: number;
  condition?: string;
  dropoffPhotos?: FileInfo[];
  pickupPhotos?: FileInfo[];
  state: LineState;
  price?: number;
  subtotal?: number;
  listingTitle?: string;
  hostId?: string;
  hostEmail?: string;
  droppedOffAt?: string;
  retrievedAt?: string;
  // ── the BILL lives in items[] too: every row is a line with a kind + signed amount.
  // No kind (or 'space') = the stay itself; the rest are money-only lines.
  kind?: "space" | "addon" | "fee" | "tax" | "discount" | "charge" | "refund" | "waiver" | "credit" | string;
  code?: string;
  label?: string;
  amount?: number;
  by?: "host" | "platform" | string;   // whose line it is — platform lines are never host-reversible
  bearer?: string;
  at?: string;
  line?: number;
  reversedBy?: string;                 // index of the reversal row (this line is struck)
  reversalOf?: string;                 // index of the line this row reverses
  meta?: Record<string, any>;
}
export interface StowboBooking {
  name: string;
  customer?: string;
  items: BookingItem[];
  dropoffCode: string;
  pickupCode: string;
  currency: string;
  subtotal: number;
  addOnTotal: number;
  overstayCharge: number;
  total: number;
  status: BookingStatus;
  // money ledger written by confirmCheckout
  deposit?: number;
  discountCode?: string;
  discount?: number;
  discounts?: QuoteDiscount[];
  serviceFee?: number;
  protectionFee?: number;
  tax?: number;
  taxLines?: QuoteTaxLine[];
  balanceDue?: number;
  cancellationPolicy?: { policy?: CancellationPolicy; freeUntil?: string; refundablePortion?: number };
  checkout?: string;        // originating stowbo_checkout `name`
  timeline?: TimelineEvent[];
  requests?: StowboRequest[];   // guest asks + host response lifecycle
  platformFee?: number;
  hostEarning?: number;
  settledAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  adjustments?: Adjustment[];
  adjustmentTotal?: number;
  claims?: Claim[];
  paymentHold?: boolean;
  paymentHoldReason?: string;
  payment?: { status?: string; provider?: string; authorizedAmount?: number; capturedAmount?: number; [k: string]: any };
}

/* booking money + support + activity */
export interface Adjustment {
  id: string; kind: "charge" | "discount" | "refund" | "waiver"; category?: string;
  amount: number; bearer?: string; hostPortion?: number; description?: string;
  addedAt?: string; addedBy?: string; reversedBy?: string; reversalOf?: string; settled?: boolean; line?: number;
}
export interface Claim {
  id: string; type: string; openedBy?: string; openedByRole?: string; openedAt?: string;
  description?: string; claimedAmount?: number; status?: string; line?: number; files?: any[];
}
export interface TimelineEvent {
  id?: string; type: string; at: string; actor?: string; actorRole?: string;
  amount?: number; line?: number; detail?: string; [k: string]: any;
}
export interface BookingTimeline {
  booking: string; status: string; timeline: TimelineEvent[]; adjustments: Adjustment[]; claims: Claim[];
}

/* ───────────────────────── request/response shapes ───────────────────────── */

export interface InitResponse {
  signedIn: boolean;
  host: boolean;
  customer?: { id: string; email: string };
  listingCount?: number;
}
export interface ListingsQuery {
  city?: string;
  spaceType?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}
/** Guest-safe host identity (allow-list; never carries email). */
export interface HostProfile {
  id: string; displayName: string; avatar?: string | null;
  memberSince?: string | null; listingCount?: number | null;
}
/** A single listing's server-priced quote for a window — NOT the cart-level CheckoutQuote
 *  (no `lines[]`/`bookable`). Returned on availability + on browse/nearby/more-from-host cards. */
export interface LineQuote {
  currency?: string; rateLines?: QuoteRow[]; quantity?: number;
  base?: number; addOns?: any[]; addOnTotal?: number; subtotal?: number;
  serviceFee?: number; protectionFee?: number; taxRate?: number; taxJurisdiction?: string;
  taxable?: number; tax?: number; total?: number; cancellationPolicy?: any;
}
/** The light card shape returned by `more-from-host` (already flattened server-side). */
export interface ListingCard {
  sk: string; title?: string; spaceType?: string; city?: string;
  image?: string | null; price?: number; priceUnit?: string; rates?: any;
  distanceKm?: number; quote?: LineQuote; available?: number;
}
export interface ListingDetail {
  listing: Envelope<StowboListing>;
  children: Envelope<StowboListing>[];
  addOns: Envelope<StowboAddOn>[];
  // Added server-side (appengine): the detail page asks "who hosts this and what
  // else do they have" in the same request. Absent on older prod → UI falls back.
  host?: HostProfile | null;
  moreFromHost?: ListingCard[];
  schedule?: any;
}
/** `GET listings/:id/nearby` — same-kind places within a radius. NOTE: unlike
 *  more-from-host, `data` here is full listing ENVELOPES (owner stripped), not flat cards. */
export interface NearbyResult {
  origin?: { lat: number; lng: number };
  radiusKm?: number; spaceType?: string | null;
  data: Envelope<StowboListing>[]; total: number;
}
export interface HostListingDetail {
  listing: Envelope<StowboListing>;
  units: Envelope<StowboUnit>[];
  addOns: Envelope<StowboAddOn>[];
}
export interface Availability {
  listing: string; capacity: number; booked: number; bookedLines?: number; heldNow?: number;
  available: number; unitBacked: boolean; blockedByTree: boolean; blackout?: any;
  sufficient: boolean; fits?: boolean; fitReason?: string; quote?: LineQuote;
  declaredCapacity?: number; capacityCappedTo?: number;
}
/** One line of a booking as it appears on the operator board (`host/today`). */
/** One unit's operational record — its own session (checkedInAt/Out), movements, status.
 *  The booking is the ORDER (money); this is what actually happens at one thing booked. */
export interface StowboBookingItem {
  name?: string; booking?: string; customer?: string; listing?: string; line?: number;
  unit?: string; identifier?: string; label?: string;
  startDate?: string; endDate?: string; checkedInAt?: string; checkedOutAt?: string;
  status?: "reserved" | "active" | "ended" | "disputed" | "cancelled";
  collector?: string;
  movements?: Array<{ at?: string; direction?: "in" | "out"; by?: string; note?: string; condition?: string; releasedTo?: string; photos?: FileInfo[] }>;
}
/** The customer's view of one thing they have booked (`GET my-items`). Same underlying
 *  record the host works, so the two sides can never disagree. `present` = last movement in. */
export interface MyItem {
  id: string; booking?: string; listing?: string; unit?: string | null; identifier?: string | null;
  label?: string; startDate?: string; endDate?: string | null;
  status?: "reserved" | "active" | "ended" | "disputed" | "cancelled";
  checkedInAt?: string | null; checkedOutAt?: string | null;
  present?: boolean; lastMovementAt?: string | null; collector?: string | null;
}
/** One booking-item as it appears on the operator board (`host/today`). Presence is
 *  derived server-side from the last movement; there is no listingTitle (map by `listing`). */
export interface TodayEntry {
  item: string; booking?: string; customer?: string; listing?: string;
  unit?: string | null; identifier?: string | null;
  startDate?: string; endDate?: string | null; checkedInAt?: string | null;
  status?: string; present?: boolean;
}
export interface TodayCapacity { listing: string; available: number | null; capacity: number | null; cappedTo?: number | null; blackout?: any }
export interface HostToday {
  arrivals: TodayEntry[]; inCustody: TodayEntry[]; departures: TodayEntry[];
  overdue: TodayEntry[]; capacity: TodayCapacity[];
}
/** One row of `GET host/bookings` — every booking across all the host's listings, newest first. */
export interface HostBookingRow {
  booking: string; reference?: string; customer?: string; status: string;
  guest?: { name?: string; phone?: string; email?: string } | null;
  paymentStatus?: string | null; payState?: string; total: number; paid: number; balance: number; currency: string;
  discountCode?: string | null; discount?: number;
  listing?: string | null; listingTitle?: string | null; units?: number;
  start?: string | null; end?: string | null; at?: string | null;
}
/** `POST host/bookings` — a walk-in / host-created booking. Open stay unless `endDate` given. */
export interface HostBookInput {
  listing: string; customer?: string; quantity?: number;
  startDate?: string; endDate?: string; identifier?: string; unit?: string;
  addOns?: Array<{ name: string } | string>; movementIn?: boolean;
  /** Per-unit details (each its own registration + type). When present the booking is
   *  sized by this list, not `quantity`. */
  units?: Array<{ identifier?: string; unit?: string; type?: string }>;
  /** A FUTURE reservation: booked for a window, NOT checked in (channel 'reservation'). */
  reserve?: boolean;
  /** A storefront discount code — validated and priced by the server, before fees and tax. */
  discountCode?: string;
  /** The guest as the host knows them (no account needed) — shown on the booking page. */
  guest?: { name?: string; phone?: string; email?: string };
  photos?: FileInfo[]; note?: string; condition?: string; declaredValue?: number;
}
/** Legal transitions on an item RIGHT NOW, straight from the server. `checkin` opens
 *  the session; `in`/`out` are movements; `checkout` closes it; `charge` adds to the bill. */
export type ItemAction = "checkin" | "in" | "out" | "checkout" | "charge";
export interface ResolveItem {
  id: string; listing?: string; unit?: string | null; identifier?: string | null;
  startDate?: string; endDate?: string | null; status?: string;
  checkedInAt?: string | null; checkedOutAt?: string | null;
  present?: boolean; overstaying?: boolean; actions: ItemAction[];
}
export interface HostResolveResult { booking: string; reference?: string; customer?: string; status?: string; total?: number; items: ResolveItem[] }
export interface HostResolve { query: string; results: HostResolveResult[] }
/** `GET host/items/:id/checkout` — a read-only preview of what closing this item bills. */
export interface ItemCheckoutPreview {
  item?: string; listing?: string; unit?: string; identifier?: string;
  startDate?: string; endDate?: string; open?: boolean; usedUntil?: string;
  present?: boolean; canCheckOut?: boolean; accruing?: boolean; used?: number; overstay?: number; rateLines?: QuoteRow[];
}
export interface BookingItemInput {
  listing: string;
  startDate: string;
  endDate: string;
  quantity?: number;
  addOns?: Array<{ name: string; price?: number; chargeEvery?: string; quantity?: number } | string>;
}
export interface CreateBookingInput {
  currency?: string;
  items: BookingItemInput[];
  paymentMethodId?: string;  // include to place a card hold
}

/* server-computed checkout pricing — the UI RENDERS these and shows `total`; it
   never derives a price. `subtotal/serviceFee/protectionFee/tax` are the CANONICAL
   cart-level totals; the band breakdown (`rateLines`) is per LINE, not top-level. */
export interface QuoteRow { label?: string; name?: string; minutes?: number; amount: number }
export interface QuoteTaxLine { listing?: string; jurisdiction?: string; rate?: number; taxable?: number; amount: number }
export interface QuoteDiscount { code?: string; name?: string; label?: string; identifier?: string; type?: string; message?: string; amount: number }
/** A fee row the server priced into a quote — every fee is a row, none is computed here. */
export interface QuoteFee { code?: string; fee?: string; label: string; amount: number; by?: "host" | "platform" | "tax" | "processing" | string; taxable?: boolean; refundable?: boolean }
/** A fee that only applies in another state (cancel / no-show / late pick-up) — "good to know". */
export interface ConditionalFee { trigger: "cancellation" | "no_show" | "late_pickup" | string; code?: string; label: string; by?: string; rule?: string; estimate?: number }
export interface CheckoutQuoteLine {
  listing?: string; listingTitle?: string; rateLines?: QuoteRow[]; quantity?: number;
  base?: number; subtotal?: number; serviceFee?: number; protectionFee?: number;
  fees?: QuoteFee[]; feeTotal?: number; conditionalFees?: ConditionalFee[];
  tax?: number; taxRate?: number; taxJurisdiction?: string; total?: number;
  available?: number; sufficient?: boolean; fitReason?: string;
}
export interface CheckoutQuote {
  currency?: string;
  lines?: CheckoutQuoteLine[];
  subtotal: number;
  addOnTotal?: number;
  discount?: number;
  discounts?: QuoteDiscount[];
  discountRejected?: { code?: string; message?: string; reason?: string } | null;
  serviceFee?: number;
  protectionFee?: number;
  fees?: QuoteFee[];
  feeTotal?: number;
  conditionalFees?: ConditionalFee[];
  tax?: number;
  taxLines?: QuoteTaxLine[];
  total: number;
  bookable?: boolean;
  unavailable?: { listing: string; reason: string }[];
}
export interface CheckoutCart { checkoutId: string; quote: CheckoutQuote; checkout?: any; }
export type CheckoutResume =
  | { resumable: false }
  | {
      resumable: true; checkoutId: string; status?: string; step?: string;
      returnTo?: string | null; context?: any; holdExpiresAt?: string | null; holdExpired?: boolean;
      previousTotal?: number; quote: CheckoutQuote; changed?: boolean; items?: any[];
    };
export interface HostApplyInput {
  formData?: Record<string, any>;
  documents?: { name: string; url: string }[];
  agreementAccepted?: boolean;
  notes?: string;
}
/** A guest's request on a booking, with the host-driven status lifecycle. */
export type PaymentCategory = "booking" | "addon" | "tip" | "adhoc" | "other";

export interface HostTakePayment {
  paymentIntentId: string; amount?: number; currency?: string; category?: PaymentCategory;
  bookingId?: string; reference?: string; description?: string; email?: string; phone?: string;
}
export interface HostPaymentRequestInput {
  amount?: number; currency?: string; category?: PaymentCategory; bookingId?: string;
  reference?: string; description?: string; email?: string; phone?: string;
  /** deliver the link now by email/SMS */ send?: boolean;
}
export interface PaymentRequestCreated {
  ok: boolean;
  /** the customer-facing link — carries an unguessable `?t=` token (or ?id= for a booking) */
  url: string;
  paymentRequestId: string;
  status: string; sent?: boolean;
  amount: number; currency: string; category: string; booking?: string | null;
}
export interface PaymentRequestStatus {
  request: string; status: "paid" | "pending" | string; paid: boolean;
  amount: number; currency: string; category: string;
  /** gateway ref once paid — lets the host (re)send a receipt */
  ref?: string | null;
}
/** One row of the host's money ledger — collected or still pending. */
export interface HostPayment {
  /** the ledger row id — reopen / poll / cancel a pending request by this */
  request?: string;
  /** gateway reference — set once paid; refunds + receipts address the row by it */
  ref?: string | null;
  amount: number; currency: string; category: string;
  /** 'charge' | 'tip' | 'refund' — a refund row is money OUT */
  kind?: string;
  status: "paid" | "pending" | "refunded" | string; pending: boolean;
  refunded?: number; remaining?: number; refundOf?: string | null;
  channel: string | null; reference?: string | null; description?: string | null;
  booking?: string | null; bookingRef?: string | null; customer?: string | null;
  at?: string | null;
  /** present only while pending — re-show the QR or resend the link */ url?: string | null;
}
export interface HostWallet {
  wallet: string; currency: string; status: string;
  earned: number; pending: number; refunded: number; balance: number;
  available: number; held: number; reserved: number;
  minPayout: number; paidOut: number; pendingPayout: number;
  expectedFromBookings?: number; pendingBookings?: number;
}
export interface HostPayoutMethod {
  id?: string; type: "bank" | "paypal"; label?: string; isDefault?: boolean; status?: string; addedAt?: string;
  bank?: { bankName?: string; accountType?: string; accountHolderName?: string; accountNumberLast4?: string; routingNumber?: string; accountNumber?: string };
  paypal?: { email?: string };
}
export interface HostPayout {
  id: string; number?: string | null; amount: number; currency: string;
  status: string; method?: string | null; note?: string | null; at?: string | null;
  /** where it went — snapshot from request time, last four only */
  destination?: { methodId: string; label?: string | null; type?: string | null; detail?: string | null } | null;
  failureReason?: string | null; traceNumber?: string | null;
}
export type DueAction = "current" | "checkout" | "cancel" | "no_show";
/** "What does this booking owe, or get back, if we put it in that state" — one question,
 *  asked before every money-moving action. The action then writes these same numbers. */
export interface BookingDue {
  currency?: string;
  total: number; paid: number; towardBill?: number; balance?: number;
  accrued: number; metered: boolean; due: number;
  payState: "paid" | "partial" | "unpaid" | "metered" | "free";
  action?: DueAction;
  /** the rows the action WOULD add (fees, credit) */
  lines?: BookingItem[];
  feeTotal?: number;
  /** money back to the guest if the action runs */
  refund?: number;
  /** the server's one-line explanation, e.g. "No fee, nothing due" */
  message?: string;
  pastWindow?: boolean;
}

/** What a public payment link may reveal — thin by design (no guest identity, no codes).
 *  One shape covers BOTH things a link can point at:
 *   • a booking            → `booking` is set (balance owed on a stay)
 *   • an ad-hoc request    → `request` is set (a `stowbo-pr-…` link/QR raised by a host
 *                            for a walk-up with no booking at all)
 *  `payRef` below is whichever one the pay call must use. */
/** A delegated pickup pass — what the collector sees. No owner identity, no booking code. */
/** A delegated pickup: one hand-off of some items on a booking to someone else. */
export interface PickupDelegation {
  id: string; reference: string; booking: string; items: string[];
  itemDetails?: { id: string; label: string | null; unit: string | null; identifier: string | null; status?: string; checkedOutAt?: string | null; present?: boolean }[];
  listing: string;
  delegate: { name?: string | null; phone?: string | null; email?: string | null };
  verify: "qr" | "qr_name" | "qr_id"; verifyLabel: string;
  validUntil: string | null; note: string | null; photo: string | null;
  code: string;
  status: "active" | "revoked" | "completed" | "expired";
  sentAt: string | null; sentVia: string | null; revokedAt: string | null; completedAt: string | null; collectedBy: string | null; createdAt: string | null;
  /** only on create / resend — the link to share with the collector */
  passUrl?: string;
}
export interface HandoverItem { id: string; listing?: string; label: string | null; unit: string | null; identifier: string | null; startDate?: string; endDate?: string | null; status?: string; present?: boolean; checkedOutAt?: string | null; delegatedTo?: string }
/** What a scanned code resolves to at the counter — nothing is released by this. */
export interface HandoverResolve {
  allowed: boolean; kind: "delegate" | "owner"; delegation: string | null; booking: string; reference?: string;
  collector: { role: "delegate" | "owner"; name: string | null; contact: string | null };
  verify: ("qr" | "name" | "id")[]; verifyLabel: string; photoRequired: boolean;
  validUntil: string | null; note: string | null; photo: string | null;
  items: HandoverItem[]; heldForOthers?: HandoverItem[]; collected: HandoverItem[];
  reason: string | null; message: string | null; refuseReasons: string[];
}
export interface HandoverResult { handedOver: { item: string; orderComplete: boolean }[]; collectedBy: { role: string; name?: string | null }; verified: string[]; delegation: string | null }
export interface HostHandovers {
  handoffs: (PickupDelegation & { handovers: { at: string; by: string; verified: string[]; photos: FileInfo[]; name: string | null }[] })[];
  refusals: { item: string; booking: string; listing: string; label: string | null; at: string; by: string; delegation: string | null; who: string | null; reason: string; note: string | null }[];
  totals: { handoffs: number; completed: number; active: number; refusals: number };
}

export interface PickupPass {
  state: "active" | "revoked" | "completed" | "expired";
  reference: string;
  items: { label: string | null; identifier: string | null; unit: string | null; collected: boolean }[];
  place: { title: string; address: string | null; accessHours: string | null; instructions: string | null; staffing: string | null; location?: any };
  verify: "qr" | "qr_name" | "qr_id";
  verifyLabel: string;
  bringId: boolean;
  validUntil: string | null;
  note: string | null;
  photo: string | null;
  collector: string | null;
  code: string | null;
  qr: string | null;
  completedAt: string | null;
}

export interface PickupReceipt {
  reference: string;
  collector: string | null;
  place: { title: string; address: string | null };
  completedAt: string;
  items: { label: string; at: string | null; by: string | null; verified: string[]; photos: FileInfo[]; collectedBy: { role: string; name?: string | null } | null }[];
}

export interface PaymentView {
  booking?: string;
  request?: string;
  reference?: string | null;
  venue?: string | null;
  currency: string; total: number; paid: number; balance: number;
  status: "paid" | "partial" | "unpaid" | "pending";
  category?: string;
  cancelled?: boolean;
  lines: { label: string; amount: number }[];
}

/** NOTE: derive the pay ref (`booking || request`) at the call site. This module is
 *  server-only (it reaches next/headers via the api layer), so a client component must
 *  never import a runtime value from here — only `import type`. */

export type RequestType = "out" | "in" | "checkout" | "addon" | "service";
export type RequestStatus = "open" | "acknowledged" | "ready" | "done" | "declined";
export interface StowboRequest {
  id: string; type: RequestType; status: RequestStatus;
  label?: string | null;        // set for addon/service requests (the upgrade's name)
  note?: string | null; item?: string | null;
  createdAt: string; updatedAt: string;
}
/** A booking counterparty's reach-through contact card (host↔guest). */
export interface Contact {
  id: string; name: string;
  email?: string | null; phone?: string | null; avatar?: string | null;
  memberSince?: string | null; verified?: boolean;
}
export interface HostMe {
  applied: boolean;
  status: string | null;
  approved: boolean;
  enrollment: Envelope<any> | null;
}
export interface Earnings { settled: number; pending: number; currency: string; bookings: number; }
export interface CustodyLine {
  booking: string; reference?: string; bookingName?: string; index: number;
  pickupCode?: string; listing: string; unit?: string; quantity: number;
  state: LineState; startDate: string; endDate: string; listingTitle?: string;
  overdueSince?: string; overdueMs?: number;
  [k: string]: any;
}

/* ───────────────────────── availability calendar (server-computed) ───────────────────────── */

export type CalState = "free" | "booked" | "stored" | "overdue" | "blocked";
export interface CalUnitDay { date: string; state: CalState; booking?: string; guest?: string; reason?: string; }
export interface CalUnit { name: string; unitNumber?: string; status?: string; days: CalUnitDay[]; }
export interface CapacityDay { date: string; used: number; capacity: number; free: number; blocked: boolean; reason?: string; }
export interface Blackout { id: string; from: string; to: string; reason?: string; note?: string; units?: string[]; createdAt?: string; createdBy?: string; }
export interface CalUpcoming { booking?: string; guest?: string; listing: string; unit?: string; quantity?: number; startDate: string; endDate: string; state: CalState; }
export interface StowboCalendar {
  listing: string;
  title?: string;
  capacity: number;
  unitBacked: boolean;
  from: string;
  days: number;
  today: { inUse: number; free: number; blocked: boolean };
  nextFree: string | null;
  nextArrival: { date: string; guest?: string; booking?: string } | null;
  units: CalUnit[];
  capacityByDay: CapacityDay[];
  blackouts: Blackout[];
  upcoming: CalUpcoming[];
}

/* ───────────────────────── the client ───────────────────────── */

export const stowbo = {
  init: () => apiReq<InitResponse>("GET", `${P}/init`),
  // The org's configured payment gateways — used to pull Stripe's publishable key
  // (browser-safe) for mounting Elements at checkout.
  paymentGateways: () => apiReq<any[]>("GET", `storefront/payment-gateways`),

  // renter: discovery + booking
  listings: (query?: ListingsQuery) =>
    apiReq<Paged<Envelope<StowboListing>>>("GET", `${P}/listings`, { query: query as any }),
  listing: (listingId: string) => apiReq<ListingDetail>("GET", `${P}/listings/${listingId}`),
  availability: (listingId: string, q: { startDate: string; endDate: string; quantity?: number }) =>
    apiReq<Availability>("GET", `${P}/listings/${listingId}/availability`, { query: q }),
  // Same-kind places within a radius of a listing (guest-safe cards).
  nearby: (listingId: string, q?: { radiusKm?: number; spaceType?: string; startDate?: string; endDate?: string; quantity?: number; pageSize?: number }) =>
    apiReq<NearbyResult>("GET", `${P}/listings/${listingId}/nearby`, { query: q as any }),
  // The host's other active listings + a guest-safe host card.
  moreFromHost: (listingId: string, q?: { startDate?: string; endDate?: string; quantity?: number; pageSize?: number }) =>
    apiReq<{ host: HostProfile | null; data: ListingCard[]; total: number }>("GET", `${P}/listings/${listingId}/more-from-host`, { query: q as any }),
  // public availability calendar (guest audience — no other guests' names)
  calendar: (listingId: string, q?: { from?: string; days?: number }) =>
    apiReq<StowboCalendar>("GET", `${P}/listings/${listingId}/calendar`, { query: q as any }),

  createBooking: (data: CreateBookingInput) =>
    apiReq<Envelope<StowboBooking>>("POST", `${P}/bookings`, { data }),

  /* ── server-driven checkout (one open cart per customer, resumable across devices) ── */
  quote: (data: { items: BookingItemInput[]; currency?: string; discountCode?: string }) =>
    apiReq<CheckoutQuote>("POST", `${P}/checkout/quote`, { data }),
  saveCart: (data: { items: BookingItemInput[]; currency?: string; step?: string; returnTo?: string; context?: any; discountCode?: string }) =>
    apiReq<CheckoutCart>("POST", `${P}/checkout/cart`, { data }),
  resumeCheckout: () => apiReq<CheckoutResume>("GET", `${P}/checkout/resume`),
  saveProgress: (checkoutId: string, data: { step?: string; returnTo?: string; context?: any }) =>
    apiReq<{ ok: boolean }>("PUT", `${P}/checkout/${checkoutId}/progress`, { data }),
  holdCheckout: (data: { items: BookingItemInput[]; currency?: string; returnTo?: string; context?: any; step?: string; discountCode?: string }) =>
    apiReq<{ checkoutId: string; expiresAt: string; quote: CheckoutQuote }>("POST", `${P}/checkout/hold`, { data }),
  confirmCheckout: (checkoutId: string, data: { paymentMethodId?: string; captureNow?: boolean } = {}) =>
    apiReq<Envelope<StowboBooking>>("POST", `${P}/checkout/${checkoutId}/confirm`, { data }),
  abandonCheckout: (checkoutId: string) => apiReq<{ ok: boolean }>("DELETE", `${P}/checkout/${checkoutId}`),
  myBookings: (status?: string) =>
    apiReq<Paged<Envelope<StowboBooking>>>("GET", `${P}/bookings`, { query: { status } }),
  booking: (bookingId: string) => apiReq<Envelope<StowboBooking>>("GET", `${P}/bookings/${bookingId}`),
  // The host behind one of my bookings — contact card (name, email, phone).
  bookingHost: (bookingId: string) => apiReq<Contact | null>("GET", `${P}/bookings/${bookingId}/host`),
  // The guest-visible activity feed for one of my bookings (same events the host sees).
  bookingTimeline: (bookingId: string) => apiReq<BookingTimeline>("GET", `${P}/bookings/${bookingId}/timeline`),
  myStuff: () => apiReq<CustodyLine[]>("GET", `${P}/my-stuff`),
  // The customer's booking-ITEMS — the real per-thing tracking, read from the same
  // records the host works. `active` = only what's still running.
  myItems: (active?: boolean) => apiReq<MyItem[]>("GET", `${P}/my-items`, { query: active ? { active: "true" } : undefined }),
  // Must send a body — the appengine PUT rejects an empty body with a 400 (the
  // reason is optional but the request needs a JSON object).
  // Support chat settings the Stowbo site points at (chat_config id + app id).
  chatConfig: () => apiReq<{ configId: string | null; appId: string | null; site: string | null }>("GET", `${P}/chat-config`),
  // Preview what cancelling (or the current state) means in money before doing it.
  bookingDue: (bookingId: string, action: DueAction = "current") =>
    apiReq<BookingDue>("GET", `${P}/bookings/${bookingId}/due`, { query: { action } as any }),
  cancelBooking: (bookingId: string, reason?: string) =>
    apiReq<Envelope<StowboBooking>>("PUT", `${P}/bookings/${bookingId}/cancel`, { data: { reason: reason ?? "Cancelled by guest" } }),
  // Ask the host to act — bring my things out / put them back / check me out.
  requestBooking: (bookingId: string, data: { type: "out" | "in" | "checkout"; note?: string }) =>
    apiReq<{ ok: boolean; request: string }>("POST", `${P}/bookings/${bookingId}/request`, { data }),

  // Extend a stay. The SERVER checks the space is free for the extra time and
  // prices the delta; if money is due it returns 402 PAYMENT_REQUIRED with the
  // amount (dueNow), and the extension only commits once a paymentMethodId pays it.
  extendBooking: (bookingId: string, data: { endDate: string; line?: number; paymentMethodId?: string }) =>
    apiReq<{ line: number; endDate: string; added: number; total: number }>("POST", `${P}/bookings/${bookingId}/extend`, { data }),

  // Buy an upgrade (add-on) on an existing booking. The SERVER charges the card
  // FIRST (paymentMethodId), then adds the paid line; a decline adds nothing and
  // comes back as 402 PAYMENT_REQUIRED. Service add-ons also drop a fulfilment
  // request into the host's queue automatically.
  addBookingAddon: (bookingId: string, data: { name: string; label: string; amount: number; code?: string; paymentMethodId?: string; paymentIntentId?: string }) =>
    apiReq<{ ok?: boolean }>("POST", `${P}/bookings/${bookingId}/addons`, { data }),

  /* ── take payment (NO sign-in — guest or account holder) ──
     Everything keys off the booking id; the SERVER derives what is owed. A link's
     `amount` is display-only and is never what gets charged. */
  // `ref` is a BOOKING id or a `stowbo-pr-…` payment-request ref — the server tells
  // them apart, so one link shape covers a stay balance and a walk-up with no booking.
  paymentView: (ref: string) =>
    apiReq<PaymentView>("GET", `${P}/pay/${ref}`),

  /* ── delegated pickup pass (NO sign-in) ──
     The owner handed some items to someone else; that person opens the link the
     pass was sent with. What it reveals is thin by design: the items, the place,
     the code to show, never the owner's identity. */
  // ── delegated pickup, owner side
  delegations: (bookingId: string) => apiReq<PickupDelegation[]>("GET", `${P}/bookings/${bookingId}/delegations`),
  createDelegation: (bookingId: string, data: { items: string[]; name?: string; phone?: string; email?: string; verify?: "qr" | "qr_name" | "qr_id"; validUntil?: string; note?: string; photo?: string }) =>
    apiReq<PickupDelegation>("POST", `${P}/bookings/${bookingId}/delegations`, { data }),
  resendDelegation: (id: string) => apiReq<PickupDelegation>("POST", `${P}/delegations/${id}/resend`, { data: {} }),
  revokeDelegation: (id: string) => apiReq<any>("DELETE", `${P}/delegations/${id}`),
  // Upload one file as the signed-in person (base64) — used for handover photos.
  uploadCustomerFile: (data: { fileName: string; base64Data: string }) => apiReq<any>("POST", `repository/customer/file/upload`, { data }),
  pickupPass: (token: string) =>
    apiReq<PickupPass>("GET", `${P}/pickup/${encodeURIComponent(token)}`),
  pickupReceipt: (token: string) =>
    apiReq<PickupReceipt>("GET", `${P}/pickup/${encodeURIComponent(token)}/receipt`),
  payBooking: (ref: string, data: { paymentMethodId?: string; paymentIntentId?: string }) =>
    apiReq<PaymentView & { paid: number; alreadySettled?: boolean }>("POST", `${P}/pay/${ref}`, { data }),

  // host: onboarding + operations (host = customer with the stowbo-host benefit)
  host: {
    apply: (data: HostApplyInput) => apiReq("POST", `${P}/host/apply`, { data }),
    me: () => apiReq<HostMe>("GET", `${P}/host/me`),
    listings: () => apiReq<Paged<Envelope<StowboListing>>>("GET", `${P}/host/listings`),
    listing: (listingId: string) => apiReq<HostListingDetail>("GET", `${P}/host/listings/${listingId}`),
    /* ── taking money in person ──
       take-payment = a card tapped here (Tap to Pay); payment-request = a link + QR the
       customer pays themselves on the signed-out /pay page. Both write ONE row to the
       sf_transaction ledger; a request row starts `pending` and flips to `paid`. */
    takePayment: (data: HostTakePayment) =>
      apiReq<{ ok: boolean; amount: number; currency: string; category: string }>("POST", `${P}/host/take-payment`, { data }),
    createPaymentRequest: (data: HostPaymentRequestInput) =>
      apiReq<PaymentRequestCreated>("POST", `${P}/host/payment-request`, { data }),
    /** Poll while the customer pays — flips to `paid` the moment they finish. */
    paymentRequestStatus: (requestId: string) =>
      apiReq<PaymentRequestStatus>("GET", `${P}/host/payment-request/${requestId}`),
    /** Everything this host collected or is still waiting on. Pending rows carry `url`. */
    transactions: () => apiReq<HostPayment[]>("GET", `${P}/host/transactions`),

    // Host-owned add-on definitions (the extras a host offers). price 0 = free.
    addons: () => apiReq<Envelope<StowboAddOn>[]>("GET", `${P}/host/addons`),
    createAddon: (data: { label: string; description?: string; price?: number; chargeEvery?: string; service?: boolean }) =>
      apiReq<Envelope<StowboAddOn>>("POST", `${P}/host/addons`, { data }),
    updateAddon: (addonId: string, data: Partial<StowboAddOn>) =>
      apiReq<Envelope<StowboAddOn>>("PUT", `${P}/host/addons/${addonId}`, { data }),
    deleteAddon: (addonId: string) =>
      apiReq<{ success: boolean }>("DELETE", `${P}/host/addons/${addonId}`),
    setListingAddons: (listingId: string, addOns: string[]) =>
      apiReq<{ listing: string; addOns: string[] }>("PUT", `${P}/host/listings/${listingId}/addons`, { data: { addOns } }),

    // ── coupons: storefront discount codes the host owns, scoped to their listings by the server
    discounts: () => apiReq<Envelope<HostDiscount>[]>("GET", `${P}/host/discounts`),
    createDiscount: (data: Partial<HostDiscount> & { code: string }) => apiReq<Envelope<HostDiscount>>("POST", `${P}/host/discounts`, { data }),
    updateDiscount: (id: string, data: Partial<HostDiscount>) => apiReq<Envelope<HostDiscount>>("PUT", `${P}/host/discounts/${id}`, { data }),
    deleteDiscount: (id: string) => apiReq<{ success: boolean }>("DELETE", `${P}/host/discounts/${id}`),
    // ── fees: the host's own fee records (booking fee, cleaning…) attached to listings by NAME
    fees: () => apiReq<Envelope<StowboFee>[]>("GET", `${P}/host/fees`),
    createFee: (data: Partial<StowboFee> & { title: string }) => apiReq<Envelope<StowboFee>>("POST", `${P}/host/fees`, { data }),
    updateFee: (feeId: string, data: Partial<StowboFee>) => apiReq<Envelope<StowboFee>>("PUT", `${P}/host/fees/${feeId}`, { data }),
    deleteFee: (feeId: string) => apiReq<{ success: boolean }>("DELETE", `${P}/host/fees/${feeId}`),
    setListingFees: (listingId: string, fees: string[]) => apiReq("PUT", `${P}/host/listings/${listingId}/fees`, { data: { fees } }),
    // ── wallet + payouts (host routes — these enforce the payout minimum)
    wallet: () => apiReq<HostWallet>("GET", `${P}/host/wallet`),
    payouts: () => apiReq<HostPayout[]>("GET", `${P}/host/payouts`),
    requestPayout: (data: { amount?: number; methodId?: string; notes?: string }) => apiReq<any>("POST", `${P}/host/payouts`, { data }),
    // Payout destinations on the host's wallet. The list never carries account or
    // routing numbers — only the last four — so it is safe to render as-is.
    payoutMethods: () => apiReq<HostPayoutMethod[]>("GET", `${P}/host/payout-methods`),
    addPayoutMethod: (data: HostPayoutMethod) => apiReq<HostPayoutMethod>("POST", `${P}/host/payout-methods`, { data }),
    setDefaultPayoutMethod: (id: string) => apiReq<HostPayoutMethod[]>("PUT", `${P}/host/payout-methods/${id}/default`, { data: {} }),
    removePayoutMethod: (id: string) => apiReq<HostPayoutMethod[]>("DELETE", `${P}/host/payout-methods/${id}`),
    // ── a collected transaction: refund (full/partial), resend the receipt, void a pending request
    refundTransaction: (ref: string, data: { amount?: number; reason?: string }) =>
      apiReq<any>("POST", `${P}/host/transactions/${encodeURIComponent(ref)}/refund`, { data }),
    sendReceipt: (ref: string, data: { email?: string; phone?: string; bookingId?: string }) =>
      apiReq<any>("POST", `${P}/host/transactions/${encodeURIComponent(ref)}/receipt`, { data }),
    cancelPaymentRequest: (requestId: string) =>
      apiReq<any>("POST", `${P}/host/payment-request/${encodeURIComponent(requestId)}/cancel`, { data: {} }),
    createListing: (data: Partial<StowboListing>) =>
      apiReq<Envelope<StowboListing>>("POST", `${P}/host/listings`, { data }),
    updateListing: (listingId: string, data: Partial<StowboListing>) =>
      apiReq<Envelope<StowboListing>>("PUT", `${P}/host/listings/${listingId}`, { data }),
    setListingStatus: (listingId: string, status: ListingStatus) =>
      apiReq<Envelope<StowboListing>>("PUT", `${P}/host/listings/${listingId}/status`, { data: { status } }),
    deleteListing: (listingId: string) =>
      apiReq<{ success: boolean; id: string }>("DELETE", `${P}/host/listings/${listingId}`),
    units: (listing?: string) =>
      apiReq<Paged<Envelope<StowboUnit>>>("GET", `${P}/host/units`, { query: { listing } }),
    createUnit: (data: Partial<StowboUnit>) =>
      apiReq<Envelope<StowboUnit>>("POST", `${P}/host/units`, { data }),
    updateUnit: (unitId: string, data: Partial<StowboUnit>) =>
      apiReq<Envelope<StowboUnit>>("PUT", `${P}/host/units/${unitId}`, { data }),
    booking: (bookingId: string) => apiReq<Envelope<StowboBooking>>("GET", `${P}/host/bookings/${bookingId}`),
    // The guest on one of my bookings — contact card (name, email, phone).
    bookingCustomer: (bookingId: string) => apiReq<Contact | null>("GET", `${P}/host/bookings/${bookingId}/customer`),
    // Move a guest request along: acknowledged → ready → done (or declined).
    respondRequest: (bookingId: string, requestId: string, status: RequestStatus) =>
      apiReq<{ ok: boolean; request: StowboRequest }>("POST", `${P}/host/bookings/${bookingId}/requests/${requestId}`, { data: { status } }),
    listingBookings: (listingId: string) => apiReq<Envelope<StowboBooking>[]>("GET", `${P}/host/listings/${listingId}/bookings`),
    // occupancy calendar + day-blocking — all server-computed (see StowboService.getCalendar)
    calendar: (listingId: string, q?: { from?: string; days?: number }) =>
      apiReq<StowboCalendar>("GET", `${P}/host/listings/${listingId}/calendar`, { query: q as any }),
    blackouts: (listingId: string) =>
      apiReq<{ listing: string; blackouts: Blackout[] }>("GET", `${P}/host/listings/${listingId}/blackouts`),
    addBlackout: (listingId: string, data: { from: string; to: string; reason?: string; note?: string; units?: string[] }) =>
      apiReq<{ blackout: Blackout; blackouts: Blackout[]; conflicts: any[] }>("POST", `${P}/host/listings/${listingId}/blackouts`, { data }),
    removeBlackout: (listingId: string, blackoutId: string) =>
      apiReq<{ blackouts: Blackout[] }>("DELETE", `${P}/host/listings/${listingId}/blackouts/${blackoutId}`),
    custody: () => apiReq<CustodyLine[]>("GET", `${P}/host/custody`),
    incoming: () => apiReq<CustodyLine[]>("GET", `${P}/host/incoming`),
    overdue: () => apiReq<CustodyLine[]>("GET", `${P}/host/overdue`),
    earnings: () => apiReq<Earnings>("GET", `${P}/host/earnings`),
    // Control center: the whole operator board (arrivals / in-custody / departures /
    // overdue / capacity) for today, in one call.
    today: (q?: { listing?: string; date?: string }) =>
      apiReq<HostToday>("GET", `${P}/host/today`, { query: q as any }),
    // Universal counter search — plate / phone / code / bay — with per-result actions.
    resolve: (q: string) => apiReq<HostResolve>("GET", `${P}/host/resolve`, { query: { q } }),
    // Take someone at the counter — a walk-in / host-created booking (open stay by default).
    book: (data: HostBookInput) => apiReq<Envelope<StowboBooking>>("POST", `${P}/host/bookings`, { data }),
    // Every booking across all my listings (optionally by status), newest first.
    allBookings: (q?: { status?: string }) => apiReq<HostBookingRow[]>("GET", `${P}/host/bookings`, { query: q as any }),
    // Operations address a booking ITEM (one unit's session), never the order.
    bookingItems: (bookingId: string) => apiReq<Envelope<StowboBookingItem>[]>("GET", `${P}/host/bookings/${bookingId}/items`),
    // ── delegated pickup, host side: resolve a scanned code, hand over, refuse, and the record
    handover: (code: string) => apiReq<HandoverResolve>("GET", `${P}/host/handover`, { query: { code } }),
    completeHandover: (data: { code: string; items?: string[]; verified: string[]; photos?: FileInfo[]; note?: string; collectorName?: string }) =>
      apiReq<HandoverResult>("POST", `${P}/host/handover`, { data }),
    refusePickup: (itemId: string, data: { reason: string; who?: string; note?: string; delegation?: string; code?: string }) =>
      apiReq<any>("POST", `${P}/host/items/${itemId}/refuse`, { data }),
    bookingDelegations: (bookingId: string) => apiReq<PickupDelegation[]>("GET", `${P}/host/bookings/${bookingId}/delegations`),
    handovers: (q?: { from?: string; to?: string; listing?: string; status?: string }) => apiReq<HostHandovers>("GET", `${P}/host/handovers`, { query: q as any }),
    // Open the session on one item — they've arrived, the space is theirs. Idempotent;
    // distinct from creating the booking and from anything physically moving in.
    itemCheckin: (itemId: string, data?: { note?: string; unit?: string }) =>
      apiReq<Envelope<StowboBookingItem>>("POST", `${P}/host/items/${itemId}/checkin`, { data: data ?? {} }),
    // Log a physical in/out on one item — append-only, repeatable, NEVER billable, never
    // touches capacity. NOT a check-out; the session stays open. `in` = arrived/came back.
    itemMovement: (itemId: string, data: { direction: "in" | "out"; note?: string; releasedTo?: string; condition?: string; declaredValue?: number; identifier?: string; unit?: string; photos?: FileInfo[] }) =>
      apiReq<Envelope<StowboBookingItem>>("POST", `${P}/host/items/${itemId}/movement`, { data }),
    // Preview what closing one item adds to the bill (read-only, safe to poll).
    itemCheckoutPreview: (itemId: string) => apiReq<ItemCheckoutPreview>("GET", `${P}/host/items/${itemId}/checkout`),
    // Close the session on one item — the ONLY place it stops occupying capacity.
    // 409 STILL_PRESENT while present; move it out first.
    itemCheckout: (itemId: string, data?: { note?: string }) =>
      apiReq<any>("POST", `${P}/host/items/${itemId}/checkout`, { data: data ?? {} }),
    // Put/move one item to a unit (re-assignable any number of times).
    itemAssign: (itemId: string, data: { unit: string; note?: string }) =>
      apiReq<Envelope<StowboBookingItem>>("POST", `${P}/host/items/${itemId}/assign`, { data }),
    occupancyNow: (listingId: string) => apiReq<any>("GET", `${P}/host/listings/${listingId}/occupancy-now`),
    dropoff: (bookingId: string, data: { code: string; line?: number; unit?: string; tags?: string[]; photos?: FileInfo[]; condition?: string; declaredValue?: number }) =>
      apiReq<Envelope<StowboBooking>>("POST", `${P}/host/bookings/${bookingId}/dropoff`, { data }),
    retrieve: (bookingId: string, data: { code: string; line?: number; photos?: FileInfo[]; condition?: string }) =>
      apiReq<Envelope<StowboBooking>>("POST", `${P}/host/bookings/${bookingId}/retrieve`, { data }),
    settle: (bookingId: string) =>
      apiReq<Envelope<StowboBooking>>("POST", `${P}/host/bookings/${bookingId}/settle`, { data: {} }),

    // 360 booking console: unified activity + money + support
    timeline: (bookingId: string) => apiReq<BookingTimeline>("GET", `${P}/host/bookings/${bookingId}/timeline`),
    // `kind:'addon'` + `code` = a CATALOG add-on added at the counter (free ones allowed);
    // otherwise an ad-hoc charge (damage, extra time…).
    charge: (bookingId: string, data: { amount: number; category?: string; description?: string; line?: number; kind?: "addon" | "charge"; code?: string; allowZero?: boolean }) =>
      apiReq("POST", `${P}/host/bookings/${bookingId}/charge`, { data }),
    // What the booking owes right now, incl. a running meter — and one payState badge.
    due: (bookingId: string, action: DueAction = "current") =>
      apiReq<BookingDue>("GET", `${P}/host/bookings/${bookingId}/due`, { query: { action } as any }),
    refund: (bookingId: string, data: { amount: number; category?: string; description?: string }) =>
      apiReq("POST", `${P}/host/bookings/${bookingId}/refund`, { data }),
    // Undo a bill line by its INDEX in items[] — the original stays (struck), its opposite is appended.
    reverseLine: (bookingId: string, index: number | string, reason?: string) =>
      apiReq<{ reversal: BookingItem; total: number }>("POST", `${P}/host/bookings/${bookingId}/lines/${index}/reverse`, { data: { reason: reason ?? "" } }),
    holdPayment: (bookingId: string, reason?: string) =>
      apiReq("POST", `${P}/host/bookings/${bookingId}/hold`, { data: { reason } }),
    releasePayment: (bookingId: string) =>
      apiReq("POST", `${P}/host/bookings/${bookingId}/release`, { data: {} }),
    // `noShow: true` applies the no-show fees and sets status `no_show` instead of `cancelled`.
    cancelBooking: (bookingId: string, reason?: string, noShow?: boolean) =>
      apiReq("POST", `${P}/host/bookings/${bookingId}/cancel`, { data: { reason: reason ?? "", ...(noShow ? { noShow: true } : {}) } }),
    openClaim: (bookingId: string, data: { type?: string; description?: string; claimedAmount?: number; line?: number }) =>
      apiReq<Claim>("POST", `${P}/host/bookings/${bookingId}/claims`, { data }),
  },
};

export type StowboApi = typeof stowbo;


/* ───────────────────────── reviews (generic comments on a listing) ───────────────────────── */

/** A listing's comments; reviews are the top-level ones that carry a `rating`. */
export function listingComments(listingId: string, q: { pageSize?: number } = { pageSize: 100 }) {
  return apiReq<{ data: any[]; total?: number }>("GET", `comments/stowbo_listing/${listingId}`, { query: q as any });
}
/** Leave a review (a comment with a rating) on a listing. */
export function addListingComment(listingId: string, body: { rating: number; title?: string; message: string }) {
  return apiReq("POST", `comments/stowbo_listing/${listingId}`, { data: body });
}

/* ───────────────────────── host: fees on one listing ───────────────────────── */

/** The host fee records attached to one listing (GET host/listings/:id/fees). */
export async function hostListingFees(listingId: string): Promise<Envelope<StowboFee>[]> {
  const r: any = await apiReq("GET", `${P}/host/listings/${listingId}/fees`).catch(() => null);
  return Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
}
/** Create a fee record on one listing (POST host/listings/:id/fees). */
export function createHostListingFee(listingId: string, data: Partial<StowboFee> & Record<string, any>) {
  return apiReq<Envelope<StowboFee>>("POST", `${P}/host/listings/${listingId}/fees`, { data });
}

/* ───────────────────────── maps key ───────────────────────── */

/** The org's Google Maps key → { mapsApiKey, source, billable } (GET shipping/google-keys). */
export function googleKeys() {
  return apiReq<{ mapsApiKey?: string; source?: string; billable?: boolean }>("GET", "shipping/google-keys");
}
