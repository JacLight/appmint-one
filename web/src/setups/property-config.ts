/**
 * Property module: one landlord or manager's homes (whole buildings, the apartments
 * and rooms inside them, single houses), leasing applications, the resident portal
 * (rent, repair requests, building notices) and the promises the office keeps.
 * Plain data only, safe on server and client.
 *
 * Where it lives in the engine (no new routes):
 *   homes          Stowbo listings. `market` is a draft root listing; its children are
 *                  buildings and stand-alone houses; a building's children are its
 *                  units (apartments, rooms). Rent is the unit's monthly `price`.
 *   applications   the CRM form `applicationForm` (client/forms/:name, client-data/forms)
 *   repairs        tickets (client-data/tickets); the response clock is the org's ticket
 *                  workflow, so `sla` below must say what that workflow escalates on
 *   notices        announcements on each building's community page (`details.board`)
 *   rent           invoices (client-data/all, client-data/pay/:id)
 */

export type Segment = "residential" | "commercial";
export interface PropertyType { id: string; label: string; plural: string; segment: Segment }

/** Commercial leasing: offices, shops, warehouses. Rent is quoted per square foot per year
 *  with the lease type; listings carry both that rate and the monthly figure, so nothing
 *  is worked out on screen. */
export interface CommercialConfig {
  /** CRM form businesses apply with (seeded by scripts/seed/property.mjs). */
  form: string;
  checklist: string[];
  note: string;
  copy: { browseTitle: string; browseLead: string; homeTitle: string; homeLead: string };
}
export interface RequestCategory { id: string; label: string; hint: string; icon: string }

export interface PropertyConfig {
  /** Name of the draft Stowbo listing whose children are this setup's buildings and houses. */
  market: string;
  /** IANA zone the office keeps time in (response deadlines are shown in it). */
  timezone: string;
  /** Which kinds of property this landlord leases. Residential uses /homes, commercial /commercial. */
  segments: Segment[];
  /** CRM form residents apply with (seeded by scripts/seed/property.mjs). */
  applicationForm: string;
  commercial?: CommercialConfig;
  /** Unit kinds (a unit listing's `spaceType`). Buildings carry spaceType "building". */
  types: PropertyType[];
  /** Feature ids on listings → the words residents read. */
  amenities: Record<string, string>;
  requestCategories: RequestCategory[];
  /** Rooms of a home a request can be about. */
  requestAreas: string[];
  /**
   * The office's response promise. `responseHours` must match the escalation on the
   * org's ticket workflow (scripts/seed/property.mjs seeds it from this value).
   */
  sla: {
    responseHours: number;
    routineDays: number;
    emergencyPhone: string;
    emergencyNote: string;
  };
  office: { name: string; phone: string; email: string; hours: string; address: string };
  /** What an applicant should have ready, shown on unit pages and step one. */
  applyChecklist: string[];
  /** The screening provider's own link follows by email: no SSN is taken here. */
  screeningNote: string;
  copy: {
    browseTitle: string;
    browseLead: string;
    heroTitle: string;
    heroLead: string;
    /** Full-bleed photo behind the home page search. */
    heroImage?: string;
  };
}
