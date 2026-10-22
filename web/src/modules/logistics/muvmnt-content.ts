/**
 * muvmnt's own home-page content: the launch market, real places in it for the live
 * price cards, and the photography (free Pexels photos, credited in the alt text).
 * Prices are never written here — every number on the home page is quoted by the
 * engine through pricing.ts.
 */

const px = (id: number, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

export const MUVMNT = {
  /** The launch market: the city line and the map centre. */
  market: "Dallas–Fort Worth",
  /** Rides, package delivery and driving live in the app; the web has a page for each. */
  app: {
    /** The store listings. Null until the apps are published; the buttons then say "Coming soon". */
    storeUrl: { ios: null as string | null, android: null as string | null },
    ride: {
      kicker: "Ride",
      title: "Request a ride in the {brand} app",
      lead: "Rides are booked in the app: set your pickup, see the fixed price before you confirm, and watch your driver on the map to the door.",
      howTitle: "How riding works",
      steps: [
        { t: "Set where you’re going", d: "Your pickup fills in from your location. Type the drop-off." },
        { t: "See the price first", d: "The fare is fixed before you confirm. The price you see is the price you pay." },
        { t: "Meet your driver", d: "See their name, car and plate, and follow them on the map." },
      ],
      help: "Lost item, a fare question or a safety concern: our support team answers every message.",
    },
    send: {
      kicker: "Send a package",
      title: "Send anything across town with the {brand} app",
      lead: "Anyone can send: keys, documents, a box, a suitcase. Book the pickup in the app, pay the fixed price, and follow it to the door.",
      howTitle: "How sending works",
      steps: [
        { t: "Add the pickup and drop-off", d: "Tell us who hands it over and who receives it." },
        { t: "Pay the fixed price", d: "Priced on the route before you book. Nothing is added at drop-off." },
        { t: "Track it to the door", d: "Live on the map, with a photo when it’s delivered." },
      ],
      help: "Something late, damaged or missing: message support and we’ll sort it out.",
    },
    drive: {
      kicker: "Drive with us",
      title: "Drive with {brand}. Earn on your own time.",
      lead: "Deliver food from local kitchens, packages and rides. Go online in the driver app whenever it suits you and see what you earn for each trip before you accept.",
      howTitle: "How driving works",
      steps: [
        { t: "Apply in the driver app", d: "Add your vehicle and licence plate. We review every application." },
        { t: "Go online and accept trips", d: "Each request shows the pickup, the drop-off and your pay for it." },
        { t: "Get paid when you finish", d: "Earnings land in your wallet when a trip closes. Cash out from the app." },
      ],
      needs: ["A car, van or truck, and a valid driver’s licence", "Proof of insurance for your vehicle", "A smartphone that runs the driver app", "Age 21 or older"],
      help: "Questions about applying, payouts or a trip: driver support answers in the app and here on the web.",
    },
  },
  photos: {
    ride: { src: px(5356285), alt: "A rider with earbuds stepping out of a car, phone in hand (Pexels)" },
    deliver: { src: px(6869055), alt: "A courier handing a smiling customer her parcels at the door (Pexels)" },
    eat: { src: px(9461797), alt: "A food courier handing over a takeout order at a doorway (Pexels)" },
    drive: { src: px(4606336, 1600), alt: "A smiling driver behind the wheel (Pexels)" },
  },
} as const;
