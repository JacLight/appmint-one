/** Scheduling module shapes — the engine's reservation records, read for these screens. */

export type BookingKind = "class" | "private" | "visit" | "consultation" | "meeting";

export interface TeamMember {
  email: string;
  name: string;
  title?: string;
  photo?: string;
  bio?: string;
  credentials?: string;
  languages?: string[];
  practice?: string;
  specialties?: string[];
}

export interface Service {
  name: string;
  duration: number; // minutes
  price: number;
  description?: string;
  /** The definition has no services of its own: it is booked as itself, so no service name is sent. */
  implicit?: boolean;
}

/** A booking type (engine: reservation_definition), normalised. */
export interface BookingType {
  id: string;
  name: string;           // engine name, e.g. "studio-reformer-flow"
  slug: string;           // name without the setup prefix, e.g. "reformer-flow"
  title: string;
  description: string;
  image?: string;
  kind: BookingKind;
  /** The definition's own `form`: the form or collection (client/forms/:name) a booking of this type fills in. */
  form?: string;
  team: TeamMember[];
  hosts: string[];        // lower-cased emails
  services: Service[];
  spots: number;
  workDays: string[];
  timezone: string;
  /** The definition's office hours ("09:00"–"17:00"), in `timezone`. */
  hours?: { start: string; end: string };
  /** What the person behind this type practises, when the definition or its team says. */
  specialty?: string;
  category?: string;
  level?: string;
  room?: string;
  location?: string;
  /** The first service's price, as the definition sets it. */
  price: number;
  area?: string;          // firm practice area
  video?: boolean;
  sameDay?: boolean;
  hidden?: boolean;
}

export interface Slot { startTime: string; endTime: string; spotsTotal: number; spotsAvailable: number }
export interface AvailabilityDay { date: string; weekday: string; closed: boolean; openSlots: number; slots: Slot[] }
export interface Availability {
  service?: { name: string; duration: number; price: number };
  timezone: string;
  nextAvailable?: Slot | null;
  days: AvailabilityDay[];
}

/** One bookable class time on the timetable. */
export interface ClassTime {
  type: BookingType;
  coach?: TeamMember;
  slot: Slot;
}

/** A reservation, normalised. */
export interface Booking {
  id: string;
  number: string;
  status: string;
  startTime: string;
  endTime: string;
  definitionId: string;
  service?: string;
  hosts: string[];
  customer: { name?: string; email?: string; phone?: string };
  notes?: string;
  meetingLink?: string | null;
  createdAt?: string;
}

/** One move of a booking (engine: reservation.data.rescheduleHistory[]). */
export interface Move { from: string; to: string; at: string; byCustomer: boolean; reason?: string }

/** A booking as the reservation record holds it: the booking plus what happened to it. */
export interface BookingDetail {
  booking: Booking;
  serviceName?: string;
  source?: string;
  /** What the customer told us when booking (reservation.data.intake). */
  intake: Record<string, string>;
  moves: Move[];
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  usedAt?: string | null;
  meetingInfo?: string | null;
  address?: string | null;
}

/** A membership or class pack the customer holds (engine: sf_subscription). */
export interface Membership { id: string; plan: string; title: string; kind: "membership" | "pack"; status: string; active: boolean; renewsAt: string | null; startedAt: string | null }

/** An invoice billed to the customer (client-data/all → invoices). */
export interface Invoice { id: string; number: string; description?: string; issuedAt?: string | null; dueAt?: string | null; total: number; balance: number; currency: string; status: string }

/** A form the customer has answered or still owes (client-data/forms). */
export interface FormAnswer { id: string; form?: string; title?: string; status: string; submittedAt?: string | null }

/** One of the provider's times, read from the public availability of their booking types. */
export interface ProviderSlot {
  type: BookingType; startTime: string; endTime: string; capacity: number; booked: number;
  /** A one-to-one time taken on one of several types this person hosts (the API doesn't say which). */
  shared?: boolean;
}

export interface Plan {
  name: string;
  title: string;
  description?: string;
  price: number;
  displayPrice?: string;
  currency: string;
  duration: number;
  durationUnit: string;
  credits: number | "unlimited" | null;
  kind: "membership" | "pack";
  scope: "class" | "private" | "any";
  perks: string[];
  badge?: string;
}
