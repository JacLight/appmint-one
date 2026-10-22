/**
 * The Appmint One marketplace: every business setup as a product someone can browse,
 * with real screens captured from the running app (public/directory/<id>/).
 * Screens named f*-* are signed-in flows run end to end on the local engine;
 * the rest are captured signed out by scratchpad/directory/capture.py (manifest.json).
 */
export interface Screen { src: string; caption: string }
export interface Listing {
  id: string;
  category: string;
  like: string;
  pitch: string;
  /** What a customer can do, in order of the flow. */
  customer: string[];
  /** What the business side (host, owner, provider) gets. */
  business?: string[];
  flows: Screen[];
  /** Honest state of the demo data. */
  note?: string;
  /** Captured paths or flow files that only show an empty state; left out of the gallery. */
  hide?: string[];
}

const f = (id: string, file: string, caption: string): Screen => ({ src: `/directory/${id}/${file}.jpg`, caption });

export const CATEGORIES = ["All", "Marketplaces", "Bookings", "Commerce", "Learning", "Property", "Finance"] as const;

export const GROUP: Record<string, (typeof CATEGORIES)[number]> = {
  stays: "Marketplaces", rental: "Marketplaces", stowbo: "Marketplaces", muvmnt: "Commerce",
  "event-oxygen": "Commerce", shop: "Commerce", studio: "Bookings", medical: "Bookings",
  "law-firm": "Bookings", academy: "Learning", residences: "Property", bank: "Finance",
};

export const LISTINGS: Listing[] = [
  {
    id: "stays", category: "Vacation rentals", like: "Airbnb · VRBO",
    pitch: "Cabins, beach houses and city flats listed by hosts. Guests search by place and dates, see the full price up front, book and pay, then manage the trip. Hosts run their listings, calendar and payouts.",
    customer: ["Search by place, dates, guests and amenities", "Only shows what's free for your dates, with the total", "Listing page with photos, house rules, reviews and map", "Book and pay by card; the price shown is the price charged", "My trips: details, message the host, cancel with a refund preview", "Extend a stay and pay the difference"],
    business: ["Host today view and reservations", "Calendar with blackout dates", "Create and edit listings, fees and status", "Wallet, payouts and payout methods"],
    flows: [f("stays", "f1-search", "Search stays"), f("stays", "f2-listing", "Stay page"), f("stays", "f3-reserve", "Reserve"), f("stays", "f4-booked", "Booked and paid"), f("stays", "f5-trips", "My trips"), f("stays", "f6-cancel", "Cancel with refund preview"), f("stays", "f7-extend", "Extend a stay"), f("stays", "f8-hostres", "Host: reservations"), f("stays", "f9-hostcal", "Host: calendar"), f("stays", "f10-hostedit", "Host: edit listing")],
  },
  {
    id: "muvmnt", hide: ["/", "/eat", "f1-eat"], category: "Food delivery", like: "Uber Eats · DoorDash",
    pitch: "Order from local kitchens and get it delivered. The delivery fee you see is the fee you pay. Rides, package delivery and driving live in the mobile app; the web has their pages and support.",
    customer: ["Set your address and browse restaurants near you", "Restaurant menus, bag and checkout", "Delivery fee from the engine's quote, charged exactly", "Track the courier, rate, report a problem", "My orders with receipts", "Ride, Send and Drive pages that point to the app"],
    flows: [f("muvmnt", "f1-eat", "Eat"), f("muvmnt", "f2-ride", "Ride (in the app)"), f("muvmnt", "f3-drive", "Drive with muvmnt"), f("muvmnt", "f4-orders", "My orders")],
    note: "Restaurants and menus aren't seeded yet, so the feed shows its empty state.",
  },
  {
    id: "event-oxygen", hide: ["/", "/events", "/shop"], category: "Event tickets", like: "Dice · Eventbrite",
    pitch: "Upcoming events with ticket types, a fast card checkout, and tickets that live in your account with a live QR for the door. Plans change: transfer a ticket to a friend.",
    customer: ["Browse upcoming events", "Event page with ticket types and prices", "Card checkout (Stripe)", "My tickets with a live QR", "Transfer a ticket by email", "Ticket orders and booking details", "Merch from the store"],
    flows: [f("event-oxygen", "f1-event", "Event page"), f("event-oxygen", "f2-picked", "Pick tickets"), f("event-oxygen", "f3-card", "Pay by card"), f("event-oxygen", "f4-confirmed", "Tickets confirmed"), f("event-oxygen", "f5-qr", "Ticket with live QR"), f("event-oxygen", "f6-transfer", "Transfer a ticket"), f("event-oxygen", "f7-orders", "Ticket orders")],
  },
  {
    id: "rental", hide: ["/shop"], category: "Gear rental", like: "Fat Llama · ShareGrid",
    pitch: "Cameras, party kits, outdoor and tools rented by the day from local owners, with a refundable deposit held at booking.",
    customer: ["Browse by category with day prices", "Kit page with what's in the box", "Book dates and pay with the deposit", "Rental details, pick-up, return and extend"],
    business: ["Owner today view and reservations", "Calendar, listings and payouts"],
    flows: [f("rental", "f1-search", "Browse gear"), f("rental", "f2-booked", "Booked with deposit"), f("rental", "f3-trip", "Rental details"), f("rental", "f4-host", "Owner: today"), f("rental", "f5-hostres", "Owner: reservations")],
  },
  {
    id: "stowbo", category: "Storage & parking", like: "Neighbor · SpotHero",
    pitch: "The original Stowbo: store your things or park your car at real businesses with room to spare. Book a window, drop off with a code, pick up and pay for the time used.",
    customer: ["Search storage or parking by place and window", "Book and pay a small hold", "Hand-offs confirmed by code and photo", "Your stuff: what's stored where"],
    business: ["Host dashboard, listings and custody", "Hand-offs, payments, coupons and earnings"],
    flows: [f("stowbo", "f1-browse", "Browse spaces")],
  },
  {
    id: "studio", hide: ["/book", "/memberships", "/team", "f1-book", "f2-team", "f3-plans", "f4-account"], category: "Fitness studio", like: "Mindbody · ClassPass",
    pitch: "A Pilates studio's own booking app: class schedule, memberships and class packs, coaches, and on-demand classes.",
    customer: ["Class schedule and booking", "Memberships and class packs", "Meet the coaches", "My classes, reschedule and cancel", "On-demand classes"],
    business: ["Coach's today and week"],
    flows: [f("studio", "f1-book", "Book a class"), f("studio", "f2-team", "Coaches"), f("studio", "f3-plans", "Memberships"), f("studio", "f4-account", "My classes"), f("studio", "f5-provider", "Coach: today")],
    note: "Class types and plans need seeding; booking runs on the engine's reservations.",
  },
  {
    id: "medical", hide: ["/book", "/team", "f1-book", "f2-team", "f3-plans", "f4-account"], category: "Doctor's office", like: "Zocdoc · One Medical",
    pitch: "A family practice where patients book a visit with the right clinician, fill in intake, and manage appointments.",
    customer: ["Book a visit by type and time", "Our clinicians", "Intake form at booking", "Appointments: reschedule and cancel"],
    business: ["Clinician's today and schedule"],
    flows: [f("medical", "f1-book", "Book a visit"), f("medical", "f2-team", "Clinicians"), f("medical", "f3-plans", "Plans"), f("medical", "f4-account", "Appointments")],
    note: "Visit types need seeding; booking runs on the engine's reservations.",
  },
  {
    id: "law-firm", hide: ["/team"], category: "Law firm", like: "Clio client portal",
    pitch: "A firm's client portal: book a consultation with an intake form, then follow your matters, documents and messages in one place.",
    customer: ["Book a consultation with intake questions", "Booked confirmation with details", "My matters: reschedule or cancel with a reason", "Book as a guest without an account", "Documents and secure messages"],
    business: ["Attorney's today and calendar"],
    flows: [f("law-firm", "f1-pick", "Pick a time"), f("law-firm", "f2-intake", "Intake form"), f("law-firm", "f3-booked", "Booked"), f("law-firm", "f4-mine", "My matters"), f("law-firm", "f5-reschedule", "Reschedule"), f("law-firm", "f6-cancelled", "Cancelled")],
  },
  {
    id: "academy", category: "Online courses", like: "Coursera · Maven",
    pitch: "Courses built in Content Studio: start a course, work through lessons, take quizzes marked by the engine, and pick up where you left off. Paid courses sell through the store.",
    customer: ["Course landing pages with the full curriculum", "Start free or preview the first lesson", "Focused lesson player with outline and progress", "Quizzes graded by the engine; sections unlock as you pass", "My learning: pick up where you left off"],
    flows: [f("academy", "f1", "Course page"), f("academy", "f2", "Lesson player"), f("academy", "f3", "Quiz"), f("academy", "f4", "Graded"), f("academy", "f5", "My learning")],
  },
  {
    id: "shop", category: "Online store", like: "Allbirds · Aesop (Shopify brand stores)",
    pitch: "Fernwood, a furniture brand's own store: dining tables, nightstands, consoles, desks and storage. Collections, rich product pages with an image and video slider, a bag drawer, a one-page checkout, order tracking and returns.",
    customer: ["Shop the room: in-room photos with pins on the pieces for sale", "Shop by room and by material (walnut, oak, marble, travertine)", "Collections with room tiles, search and sort", "Product page: media slider, sticky buy box, delivery and returns up front", "Reviews on every product", "Bag drawer and one-page card checkout", "Order confirmation with a progress track", "My orders with status, tracking and returns", "Gift cards"],
    flows: [f("shop", "f1", "Product page"), f("shop", "f2", "Reviews"), f("shop", "f3", "Bag"), f("shop", "f4", "Checkout"), f("shop", "f5", "Pay by card"), f("shop", "f6", "Order confirmed"), f("shop", "f7", "My orders"), f("shop", "f8", "Order details")],
    note: "Courses sold in a store get a Udemy-style product page; no course products exist in the data yet."
  },
  {
    id: "residences", category: "Property management", like: "Zillow Rentals · AppFolio · Buildium",
    pitch: "Halden, a Dallas landlord's own site and resident portal: lofts, apartments, rooms and houses, plus office, retail, restaurant and flex space. Search with real rents, apply online, then pay rent, request repairs and read building notices.",
    customer: ["Search homes by neighborhood, type, bedrooms and rent", "Building pages with every available unit, floor plan and move-in date", "Commercial space: suite table with size, $/SF/yr and lease type", "Apply online: rental application, or a commercial lease application for a business", "Track applications from submitted to approved", "Resident portal: my home, rent due and pay by card", "Request a repair with photos and follow it to done", "Building notice board"],
    business: ["Every home and suite is a listing on the engine", "Applications land as form submissions for review", "Rent billed as invoices, paid by card", "Repairs run as support tickets with the escalation workflow"],
    flows: [f("residences", "00-home", "Home")],
    note: "Homes, suites and the resident portal are being filled with the Halden portfolio; more screens follow once they are.",
  },
  {
    id: "bank", category: "Banking", like: "Chase · Mercury",
    pitch: "A community bank's online banking: accounts and balances, transactions, send and request money, cards, recipients and statements.",
    customer: ["Accounts and balances", "Transactions with search and detail", "Send, receive and request money", "Cards and limits", "Recipients and statements"],
    flows: [f("bank", "f1-accounts", "Accounts"), f("bank", "f2-account", "Account"), f("bank", "f3-send", "Send money"), f("bank", "f4-cards", "Cards"), f("bank", "f5-statements", "Statements"), f("bank", "f6-txdetail", "Transaction")],
  },
];
