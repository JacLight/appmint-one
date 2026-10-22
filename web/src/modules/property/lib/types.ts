/** Client-safe shapes for the property screens. Rent and deposits are the amounts on the
 *  listings, shown as posted; what a resident owes always comes from their invoices. */

export interface Address { street1?: string; street2?: string; city?: string; state?: string; zip?: string }

export interface Unit {
  id: string;
  name: string;
  title: string;
  type: string;
  typeLabel: string;
  homeId: string;
  homeTitle: string;
  neighborhood: string;
  address: Address;
  lat: number | null;
  lng: number | null;
  rent: number | null;
  deposit: number | null;
  beds: number;             // 0 = studio
  baths: number | null;
  sqft: number | null;
  floor: string | number | null;
  availableFrom: string | null;   // YYYY-MM-DD; null = now
  leaseTerms: number[];           // months
  furnished: boolean;
  pets: boolean | string | null;
  features: string[];
  images: string[];
  description: string;
  available: boolean;
  plan: string | null;            // floor plan name, e.g. "The Elm · 1 bed"
  segment: "residential" | "commercial";
  /** Commercial: the quoted rate per square foot per year, as listed. */
  ratePsf: number | null;
  /** Commercial: "NNN", "Modified gross", "Full service gross"… */
  leaseType: string | null;
  /** Commercial: estimated operating expenses per square foot per year (NNN). */
  opex: number | null;
  /** Commercial: the smallest piece the space divides to, if it divides. */
  minSqft: number | null;
  /** Commercial: build-out state, e.g. "Second-generation restaurant". */
  condition: string | null;
  /** Commercial: facts a broker would list (clear height, docks, power, zoning…). */
  specs: { label: string; value: string }[];
}

export interface Home {
  id: string;
  name: string;
  title: string;
  kind: "building" | "home";
  type: string;
  neighborhood: string;
  address: Address;
  lat: number | null;
  lng: number | null;
  images: string[];
  description: string;
  features: string[];
  yearBuilt: string | number | null;
  floors: number | null;
  totalUnits: number;
  petPolicy: string | null;
  parking: string | null;
  utilities: string | null;
  board: string | null;     // community page id/slug for notices
  segment: "residential" | "commercial";
  highlights: string[];
  units: Unit[];
}

export interface HomeFilters {
  q?: string;
  types?: string[];
  beds?: number | null;
  maxRent?: number | null;
  pets?: boolean;
  furnished?: boolean;
  moveIn?: string;
  sort?: string;
  segment?: "residential" | "commercial";
  minSqft?: number | null;
  maxPsf?: number | null;
  leaseType?: string;
}
