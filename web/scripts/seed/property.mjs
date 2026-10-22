#!/usr/bin/env node
/**
 * Seed the Halden (residences) setup on an org: the homes, the commercial space (retail
 * under The Mercer, an office building, a flex park), each building's notice board with a
 * few notices, and the rental and commercial lease application forms. Safe to re-run: records are
 * found by name/slug first and updated in place.
 *
 *   APPENGINE=http://127.0.0.1:3300 ORG=demo APPMINT_EMAIL=… APPMINT_PASSWORD=… \
 *     node scripts/seed/property.mjs [--resident you@example.com]
 *
 * Or skip sign-in with APPMINT_STAFF_TOKEN=<staff JWT>. Two-factor accounts are asked for
 * the emailed code on stdin; without a terminal the run stops after sending the code and a
 * second run with APPMINT_2FA_CODE=<code> finishes (the challenge and then the staff token
 * are kept in the OS temp folder, readable only by you).
 *
 * --resident <email>  also makes that customer a resident of Unit 204 at The Mercer: an
 *                     approved application, a member of the building's notice board and
 *                     one open rent invoice. The customer must already have an account.
 *
 * Writes only through staff routes that already exist:
 *   PUT  repository/create, POST repository/update/:id, POST repository/find/:datatype
 *   POST client/community/pages, POST client/community/pages/:id/announcements
 *   POST storefront/invoices/save
 * It never sends email or SMS and never touches workflows or org settings. The repair
 * promise in src/setups/residences.ts (24 h) is the day-one owner escalation of the
 * engine's default `ticket-support` workflow.
 */
import readline from "node:readline/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = (process.env.APPENGINE || "http://127.0.0.1:3300").replace(/\/$/, "");
const ORG = process.env.ORG || "demo";
const argv = process.argv.slice(2);
const RESIDENT = argv.includes("--resident") ? String(argv[argv.indexOf("--resident") + 1] || "").toLowerCase() : "";

const U = (id, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;
const IMG = {
  mid1: U("photo-1545324418-cc1a3fa10c00"), mid2: U("photo-1784853879843-f3c5aacf2569"), mid4: U("photo-1775733924031-521cd86c69cc"),
  brick1: U("photo-1638973140785-3b918e290682"), brick4: U("photo-1680434307292-374628581210"), brick2: U("photo-1691902588918-2f44d73f6d8b"),
  house2: U("photo-1598228723793-52759bba239c"), house3: U("photo-1572120360610-d971b9d7767c"), house1: U("photo-1570129477492-45c003edd2be"),
  town6: U("photo-1584183984565-51306ef2a88a"),
  liv2: U("photo-1759691555285-74005fcf3ddf"), liv5: U("photo-1560185007-5f0bb1866cab"), liv4: U("photo-1560185127-6ed189bf02f4"), liv1: U("photo-1583847268964-b28dc8f51f92"), liv6: U("photo-1600493505873-cddd69453072"),
  kit1: U("photo-1484154218962-a197022b5858"), kit2: U("photo-1759691554646-8155da2172ee"), kit3: U("photo-1759691337957-ebc9ed54dc44"),
  bed3: U("photo-1560185893-a55cbc8c57e8"), bed4: U("photo-1758060215425-303300b1c7e2"), bed5: U("photo-1505693416388-ac5ce068fe85"), bed1: U("photo-1615874959474-d609969a20ed"),
  bath1: U("photo-1584622650111-993a426fbf0a"), bath4: U("photo-1587527901949-ab0341697c1e"),
  office1: U("photo-1497366216548-37526070297c"), office2: U("photo-1497366811353-6870744d04b2"), office3: U("photo-1524758631624-e2822e304c36"), office4: U("photo-1497215728101-856f4ea42174"),
  tower1: U("photo-1486406146926-c627a92ad1ab"), shop1: U("photo-1441986300917-64674bd600d8"), cafe1: U("photo-1555396273-367ea4eb4db5"), dining1: U("photo-1517248135467-4c7edcad34c4"),
  whse1: U("photo-1586528116311-ad8dd3c8310d"), whse2: U("photo-1553413077-190dd305871c"), park1: U("photo-1565891741441-64926e441838"),
  pool2: U("photo-1663293761198-bbab02bd21d8"), gym3: U("photo-1630703178161-1e2f9beddbf8"), roof2: U("photo-1493246318656-5bfd4cfb29b8"),
};

/* ───────────── the portfolio ───────────── */

const MARKET = { name: "market-homes", title: "Halden — all homes", vertical: "homes", marketRoot: true, status: "draft", capacity: 0, description: "Internal grouping record for this setup. Never shown to residents." };

const unit = (building, n, o) => ({
  name: `${building.name}-${n.toLowerCase()}`, parent: building.name, vertical: "homes", status: "active",
  title: o.title || `Unit ${n}`, spaceType: o.type || "apartment", exclusive: true, capacity: 1, unitLabel: "home",
  price: o.rent, priceUnit: "month", bookingStyle: "review",
  rates: { mode: "posted", bands: [{ charge: "per_period", amount: o.rent, per: "month", label: "Monthly rent" }] },
  payment: { deposit: o.deposit ?? Math.round(o.rent * 0.5 / 50) * 50, depositRefundable: true },
  features: o.features || [], images: o.images, description: o.description || "",
  address: { ...building.address, street2: o.type === "room" ? o.title : `Unit ${n}` }, location: building.location,
  details: {
    unitNumber: n, bedrooms: o.beds, bathrooms: o.baths, sqft: o.sqft ?? null, floor: o.floor ?? null, plan: o.plan || null,
    availableFrom: o.from || null, leaseTerms: o.terms || [12, 6], furnished: !!o.furnished, pets: o.pets ?? true, leased: !!o.leased,
  },
});

/** A commercial space. Rates are quoted per SF per year; `price` is the monthly base rent
 *  that rate gives on the full size, so the engine and the invoices have a number. */
const suite = (building, n, o) => {
  const monthly = Math.round((o.rate * o.sqft) / 12);
  return {
    name: `${building.name}-${n.toLowerCase().replace(/\s+/g, "-")}`, parent: building.name, vertical: "homes", status: "active",
    title: o.title || `Suite ${n}`, spaceType: o.type, exclusive: true, capacity: 1, unitLabel: "space",
    price: monthly, priceUnit: "month", bookingStyle: "review",
    rates: { mode: "posted", bands: [{ charge: "per_period", amount: monthly, per: "month", label: `Base rent (${o.rate}/SF/yr ${o.leaseType})` }] },
    payment: { deposit: o.deposit ?? monthly * 2, depositRefundable: true },
    features: o.features || [], images: o.images, description: o.description || "",
    address: { ...building.address, street2: o.title || `Suite ${n}` }, location: building.location,
    details: {
      segment: "commercial", unitNumber: n, sqft: o.sqft, minSqft: o.minSqft ?? null, floor: o.floor ?? null,
      ratePsf: o.rate, leaseType: o.leaseType, opex: o.opex ?? null, condition: o.condition || null, specs: o.specs || {},
      availableFrom: o.from || null, leaseTerms: o.terms || [36, 60], leased: !!o.leased,
    },
  };
};

const BUILDINGS = [
  {
    name: "halden-mercer", title: "The Mercer Lofts", spaceType: "building", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "2900 Canton St", city: "Dallas", state: "TX", zip: "75226", country: "US" }, location: { lat: 32.7826, lng: -96.7826 },
    images: [IMG.brick1, IMG.liv5, IMG.kit1, IMG.roof2, IMG.brick4],
    features: ["rooftop", "elevator", "controlled-access", "package-lockers", "shared-laundry", "ev-charging", "pets-allowed"],
    description: "A 1920s cotton warehouse turned into 38 lofts, two blocks from the Deep Ellum music venues. Concrete floors, 14-foot ceilings, original brick and steel windows, and a roof deck that looks straight at downtown.\n\nThe leasing office is on the ground floor, so the people who show you around are the ones who answer when the AC quits.",
    details: { kind: "building", neighborhood: "Deep Ellum", buildingType: "Warehouse lofts", yearBuilt: 1924, floors: 4, totalUnits: 38, board: "halden-the-mercer",
      petPolicy: "Cats and dogs welcome, two per home. $300 pet deposit and $25 a month per pet.", parking: "Gated lot behind the building, $75 a month. Street parking on Canton.", utilities: "Water, sewer and trash $65 a month. Electricity in your name." },
    units: (b) => [
      unit(b, "101", { rent: 1450, beds: 0, baths: 1, sqft: 640, floor: 1, plan: "Studio loft", images: [IMG.liv5, IMG.kit1, IMG.bath1], features: ["high-ceilings", "dishwasher", "central-air"], description: "A ground-floor studio loft with a sleeping nook behind a steel-and-glass partition and the original loading-dock doors as windows." }),
      unit(b, "204", { rent: 1675, beds: 1, baths: 1, sqft: 820, floor: 2, plan: "The Canton · 1 bed", images: [IMG.liv4, IMG.kit2, IMG.bed3, IMG.bath1], features: ["high-ceilings", "in-unit-laundry", "dishwasher", "central-air"], description: "Corner one-bedroom with windows on two sides, a stacked washer and dryer and a bedroom with a real door." }),
      unit(b, "305", { rent: 1725, beds: 1, baths: 1, sqft: 860, floor: 3, plan: "The Canton · 1 bed", images: [IMG.liv2, IMG.kit2, IMG.bed5], features: ["high-ceilings", "in-unit-laundry", "dishwasher"], leased: true }),
      unit(b, "402", { rent: 2350, beds: 2, baths: 2, sqft: 1180, floor: 4, plan: "The Elm · 2 bed", images: [IMG.liv1, IMG.kit1, IMG.bed4, IMG.bath4], features: ["high-ceilings", "in-unit-laundry", "dishwasher", "balcony", "central-air"], description: "Top-floor two-bedroom with a private balcony, two full baths and the best view of the downtown skyline in the building." }),
      unit(b, "410", { rent: 2450, beds: 2, baths: 2, sqft: 1240, floor: 4, plan: "The Elm · 2 bed", images: [IMG.liv6, IMG.kit3, IMG.bed1, IMG.bath1], features: ["high-ceilings", "in-unit-laundry", "dishwasher", "central-air"], from: "2026-12-01", description: "The largest two-bedroom, with a den off the living room that works as an office." }),
      suite(b, "A", { type: "retail", title: "Retail Suite A", sqft: 1450, floor: 1, rate: 32, leaseType: "NNN", opex: 9.5, condition: "Second-generation retail", images: [IMG.shop1, IMG.brick1, IMG.brick4],
        features: ["storefront", "signage", "move-in-ready"], terms: [36, 60],
        description: "The corner storefront on Canton and Malcolm X, with 40 feet of original steel windows and the loft residents walking past every morning. Last used as a menswear shop: lighting track, fitting room and a back stockroom stay.",
        specs: { Frontage: "40 ft on Canton St", "Ceiling height": "14 ft", Restrooms: "1 ADA restroom", Power: "200A single-phase", Use: "Retail, showroom or service" } }),
      suite(b, "B", { type: "restaurant", title: "Restaurant Suite B", sqft: 2600, floor: 1, rate: 36, leaseType: "NNN", opex: 9.5, condition: "Second-generation restaurant", images: [IMG.dining1, IMG.cafe1, IMG.brick4],
        features: ["hood-venting", "grease-trap", "storefront", "signage"], from: "2027-01-01", terms: [60, 120],
        description: "A built-out restaurant with a 14-foot Type I hood, walk-in cooler and a 1,000-gallon grease trap already in place, so most of the expensive work is done. Seats about 70 inside, plus a sidewalk patio permit.",
        specs: { Hood: "14 ft Type I with fire suppression", "Grease trap": "1,000 gal, in-ground", "Walk-in": "8 × 10 cooler", Power: "400A 3-phase", Gas: "2\" line", Seating: "About 70 inside + patio", Use: "Restaurant or bar, no drive-through" } }),
    ],
  },
  {
    name: "halden-parkline", title: "Parkline Uptown", spaceType: "building", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "2525 Cedar Springs Rd", city: "Dallas", state: "TX", zip: "75201", country: "US" }, location: { lat: 32.7987, lng: -96.8034 },
    images: [IMG.mid2, IMG.pool2, IMG.liv2, IMG.gym3, IMG.mid4],
    features: ["pool", "gym", "elevator", "controlled-access", "package-lockers", "garage", "ev-charging", "pets-allowed"],
    description: "Eight floors on Cedar Springs, a short walk to the Katy Trail and McKinney Avenue. A saltwater pool in the courtyard, a fitness room open all hours and covered parking under the building.",
    details: { kind: "building", neighborhood: "Uptown", buildingType: "Mid-rise apartments", yearBuilt: 2019, floors: 8, totalUnits: 112, board: "halden-parkline",
      petPolicy: "Up to two pets, no weight limit. $350 pet deposit and $30 a month per pet. Dog wash on level 1.", parking: "One covered garage space included; a second is $95 a month.", utilities: "Water, sewer, trash and wifi $95 a month. Electricity in your name." },
    units: (b) => [
      unit(b, "3A", { rent: 1395, beds: 0, baths: 1, sqft: 560, floor: 3, plan: "S1 · Studio", images: [IMG.liv6, IMG.kit2, IMG.bath4], features: ["in-unit-laundry", "dishwasher", "central-air"] }),
      unit(b, "5C", { rent: 1795, beds: 1, baths: 1, sqft: 760, floor: 5, plan: "A2 · 1 bed", images: [IMG.liv2, IMG.kit2, IMG.bed5, IMG.bath1], features: ["in-unit-laundry", "dishwasher", "balcony", "central-air"], description: "A one-bedroom facing the courtyard pool, with a balcony big enough for two chairs and a grill." }),
      unit(b, "6D", { rent: 1850, beds: 1, baths: 1, sqft: 790, floor: 6, plan: "A3 · 1 bed + den", images: [IMG.liv4, IMG.kit1, IMG.bed3], features: ["in-unit-laundry", "dishwasher", "central-air"], from: "2026-11-15" }),
      unit(b, "7B", { rent: 2650, beds: 2, baths: 2, sqft: 1120, floor: 7, plan: "B1 · 2 bed", images: [IMG.liv1, IMG.kit3, IMG.bed4, IMG.bath4], features: ["in-unit-laundry", "dishwasher", "balcony", "central-air"], terms: [12, 15] }),
      unit(b, "9A", { rent: 3400, beds: 3, baths: 2, sqft: 1420, floor: 9, plan: "C1 · 3 bed", images: [IMG.liv5, IMG.kit1, IMG.bed1], features: ["in-unit-laundry", "dishwasher", "balcony"], leased: true }),
    ],
  },
  {
    name: "halden-swiss", title: "The Swiss House", spaceType: "building", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "4812 Swiss Ave", city: "Dallas", state: "TX", zip: "75214", country: "US" }, location: { lat: 32.7972, lng: -96.7688 },
    images: [IMG.house3, IMG.liv1, IMG.kit3, IMG.bed4, IMG.bath4],
    features: ["furnished", "utilities-included", "shared-laundry", "yard", "parking", "hardwood-floors"],
    description: "A 1915 house in the Swiss Avenue Historic District, let by the room. Five furnished bedrooms share two baths, a big kitchen, the front porch and the back garden. Bills and wifi are in the rent, and the house is cleaned every other week.\n\nGood for a first year in Dallas, a contract job or anyone who'd rather not furnish a whole apartment.",
    details: { kind: "building", neighborhood: "Swiss Avenue", buildingType: "Shared house · rooms", yearBuilt: 1915, floors: 2, totalUnits: 5, board: "halden-swiss-house",
      petPolicy: "No pets: housemates share the common rooms.", parking: "Driveway and street parking.", utilities: "Electricity, water, gas, wifi and a cleaner every other week are included." },
    units: (b) => [
      unit(b, "R1", { type: "room", title: "Front room", rent: 1050, beds: 1, baths: null, sqft: 220, floor: 1, images: [IMG.bed3, IMG.liv1, IMG.kit3], features: ["furnished", "utilities-included", "hardwood-floors"], pets: false, terms: [6, 12], description: "The big front room on the ground floor, with bay windows onto Swiss Avenue and a queen bed." }),
      unit(b, "R2", { type: "room", title: "Garden room", rent: 950, beds: 1, baths: null, sqft: 180, floor: 1, images: [IMG.bed4, IMG.kit3], features: ["furnished", "utilities-included"], pets: false, terms: [6, 12] }),
      unit(b, "R3", { type: "room", title: "Upstairs suite", rent: 1150, beds: 1, baths: 1, sqft: 260, floor: 2, images: [IMG.bed5, IMG.bath4], features: ["furnished", "utilities-included", "hardwood-floors"], pets: false, terms: [6, 12], description: "The only room with its own bathroom, upstairs at the back." }),
      unit(b, "R4", { type: "room", title: "Corner room", rent: 895, beds: 1, baths: null, sqft: 160, floor: 2, images: [IMG.bed1, IMG.liv1], features: ["furnished", "utilities-included"], pets: false, terms: [3, 6, 12], leased: true }),
      unit(b, "R5", { type: "room", title: "Attic room", rent: 850, beds: 1, baths: null, sqft: 170, floor: 3, images: [IMG.bed4], features: ["furnished", "utilities-included"], pets: false, terms: [3, 6, 12], from: "2026-11-15" }),
    ],
  },
  {
    name: "halden-commerce", title: "Commerce Street Offices", spaceType: "building", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "1717 Commerce St", city: "Dallas", state: "TX", zip: "75201", country: "US" }, location: { lat: 32.7807, lng: -96.7980 },
    images: [IMG.tower1, IMG.office1, IMG.office2, IMG.office3, IMG.office4],
    features: ["elevator", "controlled-access", "24-7-access", "fiber", "conference-room", "after-hours-hvac", "garage"],
    description: "A 1958 downtown office building, gutted and rebuilt in 2021: new glass, new elevators, fiber from two carriers and a shared conference floor tenants book by the hour. Suites run from a 1,100 SF team room to a 4,800 SF half floor.\n\nRates are full service: electricity, janitorial and the building's operating costs are in the rent, so the number you see is the number you pay.",
    details: { kind: "building", segment: "commercial", neighborhood: "Downtown", buildingType: "Class B office", yearBuilt: 1958, floors: 12, totalUnits: 24, board: "halden-commerce-street",
      parking: "Garage across Commerce St: 3 spaces per 1,000 SF at $110 a space a month.", utilities: "Full service gross: electricity, janitorial, taxes, insurance and common areas included. After-hours HVAC $45 an hour." },
    units: (b) => [
      suite(b, "300", { type: "office", sqft: 2400, floor: 3, rate: 27, leaseType: "Full service gross", condition: "Move-in ready", images: [IMG.office2, IMG.office3, IMG.office1],
        features: ["move-in-ready", "private-offices", "conference-room"], terms: [36, 60],
        description: "Four private offices along the windows, an open area for 12, a conference room and a kitchenette. Already wired and painted: bring desks.",
        specs: { Layout: "4 offices, open area for 12, 1 conference room, kitchenette", "Ceiling height": "10 ft", Windows: "Floor-to-ceiling, north and east", Restrooms: "Shared on the floor", Fiber: "Two carriers, 1 Gbps available" } }),
      suite(b, "410", { type: "office", title: "Suite 410 · half floor", sqft: 4800, minSqft: 2200, floor: 4, rate: 26, leaseType: "Full service gross", condition: "Shell, allowance available", images: [IMG.office1, IMG.office4, IMG.office2],
        features: ["private-offices"], terms: [60, 84, 120],
        description: "Half of the fourth floor, delivered as a clean shell so you can lay it out your way. We'll split it for a tenant who needs as little as 2,200 SF, and a five-year lease comes with a $35/SF tenant improvement allowance.",
        specs: { "Divisible to": "2,200 SF", "TI allowance": "$35/SF on a 5-year term", "Ceiling height": "11 ft to deck", Columns: "30 ft bays", Restrooms: "Shared on the floor" } }),
      suite(b, "520", { type: "office", sqft: 1150, floor: 5, rate: 29, leaseType: "Full service gross", condition: "Furnished", images: [IMG.office3, IMG.office4],
        features: ["move-in-ready", "private-offices"], terms: [12, 36], from: "2026-12-01",
        description: "A furnished team room for six with one private office. Twelve-month terms for a company that is still working out how big it will get.",
        specs: { Layout: "1 office, open area for 6", Furniture: "Desks, chairs, conference table included", "Ceiling height": "10 ft" } }),
      suite(b, "210", { type: "office", sqft: 3100, floor: 2, rate: 26.5, leaseType: "Full service gross", condition: "Second-generation office", images: [IMG.office4], leased: true }),
    ],
  },
  {
    name: "halden-trinity", title: "Trinity Flex Park", spaceType: "building", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "2250 Irving Blvd", city: "Dallas", state: "TX", zip: "75207", country: "US" }, location: { lat: 32.7978, lng: -96.8357 },
    images: [IMG.park1, IMG.whse1, IMG.whse2],
    features: ["loading-dock", "grade-door", "yard-storage", "24-7-access", "signage", "parking"],
    description: "Eight bays of office-warehouse off Irving Boulevard, five minutes from I-35E and the Design District. Each bay has a small front office, dock or drive-in doors at the back and its own power, so a showroom, a contractor or an online shop can all work here.",
    details: { kind: "building", segment: "commercial", neighborhood: "Design District", buildingType: "Flex / light industrial", yearBuilt: 1984, floors: 1, totalUnits: 8, board: "halden-trinity-flex",
      parking: "Front lot, about 2 spaces per 1,000 SF. Truck court shared with the bay next door.", utilities: "NNN: you pay your share of taxes, insurance and common areas (about $3.25/SF/yr) plus your own utilities." },
    units: (b) => [
      suite(b, "Bay 4", { type: "flex", title: "Bay 4", sqft: 3600, floor: null, rate: 14.5, leaseType: "NNN", opex: 3.25, condition: "800 SF office, 2,800 SF warehouse", images: [IMG.whse2, IMG.park1],
        features: ["grade-door", "private-offices", "24-7-access"], terms: [36, 60],
        description: "A small front office with two private rooms and a restroom, opening onto 2,800 SF of clear warehouse with a 12-foot drive-in door. Popular with showrooms and trades.",
        specs: { "Clear height": "18 ft", Loading: "1 grade-level door (12 × 14)", Office: "800 SF, 2 private offices", Power: "200A 3-phase", Sprinklers: "Wet system", Use: "Showroom, warehouse, light assembly" } }),
      suite(b, "Bay 7", { type: "industrial", title: "Bay 7", sqft: 9800, minSqft: 4900, floor: null, rate: 9.75, leaseType: "NNN", opex: 3.25, condition: "Warehouse with 600 SF office", images: [IMG.whse1, IMG.park1],
        features: ["loading-dock", "grade-door", "yard-storage"], from: "2026-12-15", terms: [36, 60, 84],
        description: "The end bay: two dock-high doors, a drive-in ramp and a fenced side yard for trailers or materials. Can be split in half for a tenant who needs 4,900 SF.",
        specs: { "Clear height": "22 ft", Loading: "2 dock-high doors + 1 drive-in ramp", Yard: "Fenced, about 6,000 SF", Office: "600 SF", Power: "400A 3-phase", Sprinklers: "ESFR", "Divisible to": "4,900 SF" } }),
      suite(b, "Bay 2", { type: "flex", title: "Bay 2", sqft: 3200, floor: null, rate: 14, leaseType: "NNN", opex: 3.25, condition: "Showroom flex", images: [IMG.whse2], leased: true }),
    ],
  },
];

const HOUSES = [
  {
    name: "halden-llano", title: "Llano Avenue House", spaceType: "house", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "6214 Llano Ave", city: "Dallas", state: "TX", zip: "75214", country: "US" }, location: { lat: 32.8143, lng: -96.7486 },
    images: [IMG.house2, IMG.liv5, IMG.kit1, IMG.bed3, IMG.bath1], exclusive: true, capacity: 1, unitLabel: "home",
    price: 2950, priceUnit: "month", bookingStyle: "review", rates: { mode: "posted", bands: [{ charge: "per_period", amount: 2950, per: "month", label: "Monthly rent" }] },
    payment: { deposit: 2950, depositRefundable: true },
    features: ["yard", "garage", "in-unit-laundry", "dishwasher", "central-air", "hardwood-floors", "pets-allowed"],
    description: "A three-bedroom brick house on a quiet Lakewood street, five minutes from White Rock Lake. Big fenced backyard, a two-car garage off the alley and a kitchen redone in 2024.",
    details: { kind: "home", neighborhood: "Lakewood", bedrooms: 3, bathrooms: 2, sqft: 1850, yearBuilt: 1948, availableFrom: "2026-11-01", leaseTerms: [12], pets: true,
      petPolicy: "Dogs and cats welcome; the yard is fenced.", parking: "Two-car garage off the alley.", utilities: "All utilities in your name. Lawn care included." },
  },
  {
    name: "halden-kessler", title: "Kessler Park Townhome", spaceType: "townhome", vertical: "homes", status: "active", parent: MARKET.name,
    address: { street1: "1310 N Edgefield Ave", city: "Dallas", state: "TX", zip: "75208", country: "US" }, location: { lat: 32.7566, lng: -96.8399 },
    images: [IMG.town6, IMG.liv2, IMG.kit2, IMG.bed5, IMG.bath4], exclusive: true, capacity: 1, unitLabel: "home",
    price: 2400, priceUnit: "month", bookingStyle: "review", rates: { mode: "posted", bands: [{ charge: "per_period", amount: 2400, per: "month", label: "Monthly rent" }] },
    payment: { deposit: 1800, depositRefundable: true },
    features: ["garage", "in-unit-laundry", "dishwasher", "central-air", "balcony", "pets-allowed"],
    description: "A three-storey end-unit townhome near the Bishop Arts District: two bedrooms with their own baths, a powder room, a balcony off the living room and an attached garage.",
    details: { kind: "home", neighborhood: "Kessler Park", bedrooms: 2, bathrooms: 2.5, sqft: 1420, yearBuilt: 2016, availableFrom: null, leaseTerms: [12, 18], pets: "Cats and small dogs",
      petPolicy: "Cats and dogs under 40 lb.", parking: "Attached one-car garage plus a driveway space.", utilities: "All utilities in your name. HOA covers trash and grounds." },
  },
];

const NOTICES = {
  "halden-the-mercer": [
    { title: "Water off Tuesday, 10 AM to noon", content: "We're replacing a riser valve on floors 3 and 4. Water will be off in those homes from 10 AM to noon on Tuesday. Fill a jug the night before. Floors 1 and 2 aren't affected.", priority: "high", pinned: true },
    { title: "Roof deck reopens Friday", content: "The new shade sails are up and the grills have been cleaned. The roof deck is open again from Friday, 7 AM to 11 PM.", priority: "normal" },
    { title: "Pest control visit, first Wednesday of the month", content: "Our pest control contractor treats every home on the first Wednesday of each month between 9 AM and 3 PM. If you'd rather they skip you, tell the office by the Monday before.", priority: "normal" },
  ],
  "halden-parkline": [
    { title: "Pool closed Monday for resurfacing", content: "The courtyard pool is closed all day Monday while the deck is resurfaced. The fitness room stays open.", priority: "normal", pinned: true },
    { title: "Garage gate code changes on the 1st", content: "For security we change the garage gate code on the 1st of each month. Your new code is in the email we sent you and at the front desk.", priority: "high" },
  ],
  "halden-commerce-street": [
    { title: "Fire alarm test Saturday, 8 to 10 AM", content: "The city requires an annual test of the alarm system. Alarms will sound on and off between 8 and 10 AM on Saturday. Nobody needs to leave.", priority: "high", pinned: true },
    { title: "Conference floor booking moves online", content: "Book the 11th-floor conference rooms from your account from Monday. Each suite gets ten free hours a month; after that it's $25 an hour.", priority: "normal" },
  ],
  "halden-trinity-flex": [
    { title: "Truck court resurfacing, bays 5 to 8", content: "The truck court behind bays 5 to 8 will be resurfaced next Monday and Tuesday. Schedule deliveries for the front, or call the office to use the bay 1 dock.", priority: "high", pinned: true },
  ],
  "halden-swiss-house": [
    { title: "House cleaning moves to Thursdays", content: "From next week the cleaner comes every other Thursday instead of Friday. Please keep the kitchen counters clear that morning.", priority: "normal", pinned: true },
  ],
};

/* ───────────── the application form ───────────── */

const str = (title, extra = {}) => ({ type: "string", title, ...extra });
const FORM = {
  name: "rental-application",
  title: "Rental application",
  description: "Apply for a Halden home. Each adult applies with their own account.",
  authenticationType: "magic-link",
  status: "active",
  schema: {
    type: "object",
    required: ["firstName", "lastName", "email", "phone", "moveIn", "leaseTerm", "monthlyIncome", "unitId"],
    properties: {
      unitId: str("Home id", { hidden: true }), unitTitle: str("Home"), homeId: str("Building id", { hidden: true }), homeTitle: str("Building"),
      rent: { type: ["number", "string"], title: "Posted rent" },
      firstName: str("First name"), lastName: str("Last name"), email: str("Email", { format: "email" }), phone: str("Phone"),
      currentAddress: str("Current address"),
      moveIn: str("Move-in date", { format: "date" }), leaseTerm: str("Lease length (months)"),
      adults: str("Adults"), children: str("Children"), otherOccupants: str("Other occupants"),
      pets: str("Pets", { enum: ["yes", "no", ""] }), petDetails: str("About the pets"), vehicles: str("Vehicles"),
      employmentStatus: str("Employment"), employer: str("Employer"), jobTitle: str("Job title"),
      monthlyIncome: str("Monthly income"), employedSince: str("Employed since"), otherIncome: str("Other income"),
      currentLandlord: str("Current landlord"), landlordPhone: str("Landlord phone"), currentRent: str("Current rent"),
      movingReason: str("Reason for moving"), evicted: str("Ever evicted", { enum: ["yes", "no", ""] }), evictionDetails: str("Eviction details"),
      documents: { type: "array", title: "Documents", items: { type: "string" } },
      consent: str("Screening consent", { enum: ["yes", ""] }),
    },
  },
};

const COMMERCIAL_FORM = {
  name: "commercial-lease-application",
  title: "Commercial lease application",
  description: "Apply to lease Halden office, retail, restaurant or industrial space.",
  authenticationType: "magic-link",
  status: "active",
  schema: {
    type: "object",
    required: ["companyName", "entityType", "firstName", "lastName", "signerTitle", "email", "phone", "moveIn", "leaseTerm", "use", "headcount", "yearsInBusiness", "annualRevenue", "guarantor", "unitId"],
    properties: {
      segment: str("Segment", { hidden: true }),
      unitId: str("Space id", { hidden: true }), unitTitle: str("Space"), homeId: str("Building id", { hidden: true }), homeTitle: str("Building"),
      rent: { type: ["number", "string"], title: "Posted base rent (monthly)" },
      sqft: { type: ["number", "string"], title: "Size (SF)" }, ratePsf: { type: ["number", "string"], title: "Rate ($/SF/yr)" }, leaseType: str("Lease type"),
      companyName: str("Company legal name"), dba: str("Trading as"),
      entityType: str("Entity type", { enum: ["LLC", "Corporation", "Partnership", "Sole proprietor", "Nonprofit", "Other"] }),
      stateOfFormation: str("State of formation"), website: str("Website"),
      firstName: str("Signer first name"), lastName: str("Signer last name"), signerTitle: str("Signer title"),
      email: str("Email", { format: "email" }), phone: str("Phone"),
      moveIn: str("Target occupancy", { format: "date" }), leaseTerm: str("Lease term (months)"),
      use: str("Intended use"), headcount: str("People on site"), hours: str("Hours of operation"),
      buildOut: str("Build-out needs"), needs: str("Power, venting, deliveries"), currentLocation: str("Current location"),
      yearsInBusiness: str("Years in business"), annualRevenue: str("Annual revenue"),
      guarantor: str("Personal guarantee offered", { enum: ["yes", "no"] }), guarantorName: str("Guarantor"),
      bankName: str("Bank"), currentLandlord: str("Current landlord"), landlordPhone: str("Landlord phone"),
      documents: { type: "array", title: "Documents", items: { type: "string" } },
      consent: str("Credit check consent", { enum: ["yes", ""] }),
    },
  },
};

/* ───────────── engine calls ───────────── */

// APPMINT_APP_TOKEN: the app's own token (POST profile/app/key with the APP_ID, APP_KEY and APP_SECRET
// from .env.local), the way the Stowbo seeder signs in; no staff password or two-factor code needed.
const APP_TOKEN = process.env.APPMINT_APP_TOKEN || "";
let TOKEN = APP_TOKEN || process.env.APPMINT_STAFF_TOKEN || "";

async function call(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { "content-type": "application/json", orgid: ORG, ...(TOKEN ? { authorization: `Bearer ${TOKEN}`, ...(APP_TOKEN ? {} : { "x-client-authorization": TOKEN }) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json).slice(0, 300)}`);
  return json;
}

// Two-factor without a terminal: the first run signs in and keeps the challenge here, a
// second run with APPMINT_2FA_CODE finishes it. The staff token is kept for later runs.
const STATE = join(tmpdir(), `appmint-seed-${ORG}.json`);
const state = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});

async function signIn() {
  if (TOKEN) return;
  const saved = state();
  TOKEN = saved.token || "";
  if (TOKEN && (await fetch(`${API}/client/community/pages/mine`, { headers: { orgid: ORG, authorization: `Bearer ${TOKEN}`, "x-client-authorization": TOKEN } })).ok) return;
  TOKEN = "";
  const code = (process.env.APPMINT_2FA_CODE || "").trim();
  if (code && saved.challengeToken) {
    const v = await call("POST", "profile/security/challenge/verify", { challengeToken: saved.challengeToken, code });
    TOKEN = v?.token || v?.access_token || v?.data?.token;
  } else {
    const email = process.env.APPMINT_EMAIL, password = process.env.APPMINT_PASSWORD;
    if (!email || !password) throw new Error("Set APPMINT_STAFF_TOKEN, or APPMINT_EMAIL and APPMINT_PASSWORD.");
    const r = await call("POST", "profile/user/signin", { email, password });
    if (r?.requiresTwoFactor) {
      if (!process.stdin.isTTY) {
        writeFileSync(STATE, JSON.stringify({ challengeToken: r.challengeToken }), { mode: 0o600 });
        console.log("Two-factor code sent to the account's email. Run again with APPMINT_2FA_CODE=<code>.");
        process.exit(2);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const typed = (await rl.question("Two-factor code (check the account's email): ")).trim();
      rl.close();
      const v = await call("POST", "profile/security/challenge/verify", { challengeToken: r.challengeToken, code: typed });
      TOKEN = v?.token || v?.access_token || v?.data?.token;
    } else {
      TOKEN = r?.token || r?.access_token || r?.data?.token;
    }
  }
  if (!TOKEN) throw new Error("Signed in but no token came back.");
  writeFileSync(STATE, JSON.stringify({ token: TOKEN }), { mode: 0o600 });
}

async function byName(datatype, name, attr = "name") {
  const r = await call("POST", `repository/find/${datatype}`, { query: { [`data.${attr}`]: name }, options: { page: 1, pageSize: 1 } });
  return (r?.data || [])[0] || null;
}

async function upsert(datatype, data, attr = "name") {
  const existing = await byName(datatype, data[attr], attr);
  if (existing) {
    await call("POST", `repository/update/${existing.sk}`, { ...existing, data: { ...existing.data, ...data } });
    return { ...existing, data: { ...existing.data, ...data }, _updated: true };
  }
  return call("PUT", "repository/create", { datatype, name: data.name, data });
}

async function board(slug, title, description) {
  const found = await call("GET", `client/community/pages/${encodeURIComponent(slug)}`).catch(() => null);
  if (found?.sk) return found;
  return call("POST", "client/community/pages", {
    title, slug, description, type: "community", category: "residents",
    visibility: "private", joinPolicy: "approval_required", postingPolicy: "admins_only", status: "active",
  });
}

async function main() {
  console.log(`Seeding Halden homes on ${API} (org ${ORG})`);
  await signIn();

  await upsert("stowbo_listing", MARKET);
  console.log(`  root ${MARKET.name}`);

  const boards = {};
  for (const b of BUILDINGS) {
    const page = await board(b.details.board, b.title, `Notices for ${b.details.segment === "commercial" ? "tenants" : "residents"} of ${b.title}.`);
    boards[b.details.board] = page;
    const { units, ...data } = b;
    await upsert("stowbo_listing", data);
    for (const u of units(b)) await upsert("stowbo_listing", u);
    const all = units(b), spaces = all.filter((u) => u.details.segment === "commercial").length;
    console.log(`  ${b.title}: ${[all.length - spaces && `${all.length - spaces} homes`, spaces && `${spaces} commercial spaces`].filter(Boolean).join(", ")}, board ${b.details.board}`);
  }
  for (const h of HOUSES) {
    await upsert("stowbo_listing", h);
    console.log(`  ${h.title}`);
  }

  for (const [slug, list] of Object.entries(NOTICES)) {
    const page = boards[slug];
    if (!page?.sk) continue;
    const have = await call("GET", `client/community/pages/${page.sk}/announcements?limit=50`).catch(() => ({ data: [] }));
    const titles = new Set((have?.data || []).map((a) => a.data?.title));
    for (const n of list) if (!titles.has(n.title)) await call("POST", `client/community/pages/${page.sk}/announcements`, { ...n, status: "published" });
    console.log(`  notices on ${slug}: ${list.length}`);
  }

  const form = await upsert("crm_form", FORM);
  console.log(`  form ${FORM.name}`);
  await upsert("crm_form", COMMERCIAL_FORM);
  console.log(`  form ${COMMERCIAL_FORM.name}`);

  if (RESIDENT) {
    const u = BUILDINGS[0].units(BUILDINGS[0]).find((x) => x.details.unitNumber === "204");
    const unitRec = await byName("stowbo_listing", u.name);
    const buildingRec = await byName("stowbo_listing", BUILDINGS[0].name);
    const formRec = form?.sk ? form : await byName("crm_form", FORM.name);
    const existing = await call("POST", "repository/find/form_submission", { query: { "data.values.email": RESIDENT, "data.formId": String(formRec.sk) } }).catch(() => null);
    if (!(existing?.data || []).length) {
      await call("PUT", "repository/create", {
        datatype: "form_submission",
        data: {
          formId: String(formRec.sk), status: "approved",
          values: { email: RESIDENT, firstName: "Test", lastName: "Resident", phone: "", unitId: String(unitRec.sk), unitTitle: u.title, homeId: String(buildingRec.sk), homeTitle: BUILDINGS[0].title, rent: u.price, moveIn: "2026-09-01", leaseTerm: "12", monthlyIncome: "6200", consent: "yes" },
        },
      });
    }
    const page = boards[BUILDINGS[0].details.board];
    const member = await call("POST", "repository/find/community_page_member", { query: { "data.page": String(page.sk), "data.email": RESIDENT } }).catch(() => null);
    if (!(member?.data || []).length) {
      await call("PUT", "repository/create", { datatype: "community_page_member", data: { page: String(page.sk), email: RESIDENT, role: "member", status: "active", source: "manual", joinedAt: new Date().toISOString() } });
    }
    const remarks = `November rent · ${u.title}, ${BUILDINGS[0].title}`;
    const billed = await call("POST", "repository/find/sf_invoice", { query: { "data.customerEmail": RESIDENT, "data.remarks": remarks } }).catch(() => null);
    if (!(billed?.data || []).length) await call("POST", "storefront/invoices/save", {
      customerEmail: RESIDENT, status: "sent", currency: "USD", dueDate: "2026-11-01", invoiceDate: "2026-10-25",
      remarks,
      products: [{ name: `November rent · ${u.title}`, quantity: 1, price: u.price }],
    });
    console.log(`  resident ${RESIDENT}: approved for ${u.title}, on the ${BUILDINGS[0].title} board, November rent invoiced`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
