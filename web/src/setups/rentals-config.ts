/**
 * How the Rentals module reads for one setup — what is rented, by what unit, which
 * facts a listing shows, what search asks for and the words on every screen.
 * Plain data (server + client safe). A setup without `rentals` is Stowbo's storage
 * marketplace and renders Stowbo's own screens, unchanged.
 */

export type RentalUnit = "night" | "hour" | "day" | "week" | "month";

export interface RentalType {
  /** stored as listing `spaceType` */
  id: string;
  label: string;   // "Cabin"
  plural: string;  // "Cabins"
}

/** A headline fact read from `listing.data.details[key]`. */
export interface RentalFact {
  key: string;
  /** singular / plural nouns for counts: 3 → "3 bedrooms" */
  one: string;
  many: string;
}

export interface RentalRow {
  title: string;
  sub?: string;
  types?: string[];
  states?: string[];
  /** the search this row's "Show all" opens */
  href: string;
}

export interface RentalsConfig {
  /** Which family of screens: Stowbo's storage screens, vacation stays, or gear/venue hire. */
  experience: "storage" | "stays" | "gear";
  /** Engine `data.vertical` these listings carry (absent = Stowbo's untagged listings). */
  vertical?: string;
  /** The engine listing whose children are this vertical's listings (GET client/stowbo/listings/:market).
   *  Keeps them out of Stowbo's own top-level browse. */
  market?: string;
  /** How prices read on cards: "$289 night". */
  unit: RentalUnit;
  types: RentalType[];
  facts: RentalFact[];
  /** Amenity / feature chips offered in search filters and the listing editor. */
  amenities: string[];
  /** Ask who is coming (stays) — adults, children, infants, pets. */
  guests: boolean;
  /** The time of day matters (hourly venues) → time pickers next to dates. */
  timeOfDay?: boolean;
  search: {
    where: string; wherePlaceholder: string;
    start: string; end: string;
    who?: string; whoPlaceholder?: string;
    button: string;
    /** popular destinations offered in the Where dropdown */
    destinations: { label: string; sub: string }[];
  };
  rows: RentalRow[];
  copy: {
    heroTitle: string;
    heroSub: string;
    reserve: string;          // "Reserve"
    instantNote: string;      // under the reserve button
    priceNote: string;        // "Prices include all fees" next to results
    offersTitle: string;      // "What this place offers"
    rulesTitle: string;       // "House rules"
    checkIn: string;          // "Check-in"
    checkOut: string;         // "Checkout"
    hostedBy: string;         // "Hosted by"
    tripsTitle: string;       // "Trips"
    tripNoun: string;         // "trip"
    emptyTrips: string;
    hostTitle: string;        // "Your listings"
    hostPitch: string;        // become-a-host headline
    hostPitchSub: string;
  };
}
