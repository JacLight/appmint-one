// Stand-in for base-app/src/lib/rental-api.ts: rentals are the Rentals module (Stowbo),
// not this store, so a rental line never reaches this checkout.
const unavailable = async () => { throw new Error('Rentals are not sold in this store'); };
export const rentalAPI: any = new Proxy({}, { get: () => unavailable });
