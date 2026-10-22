# src/api — every engine call lives here

One file per domain. Components, pages and server actions never write an engine route string; they call a function from here.

| File | Domain | Engine routes it owns |
|---|---|---|
| `account.ts` | sign-in, profile, settings, wallet, messages, support (Stowbo common) | `profile/customer/*`, `client/community/*`, `client/finance/*`, … |
| `store.ts` | catalog, cart, checkout, orders, returns, gift cards (retail + food + course products) | `storefront/*`, `cart/*`, `checkout-cart`, … |
| `logistics.ts` | delivery quote (fixed price), orders, tracking for food delivery | `client/logistics/*` |
| `reservations.ts` | scheduling: definitions, availability, book, mine, reschedule, cancel, forms, invoices, subscriptions | `crm/reservations/*`, `client-data/reservations*`, … |
| `events.ts` | events, ticket purchase, my tickets, QR, transfer, orders | `client/events/*` |
| `content.ts` | LMS learning: outline, enroll, items, progress, answers | `client/content-studio/*` |
| `rentals.ts` | Stowbo listings, availability, checkout, bookings, host | `client/stowbo/*` |
| `property.ts` | repair requests (tickets) and building notice boards (homes are `rentals.ts`, applications and rent are `reservations.ts`) | `client-data/tickets*`, `crm/tickets/messages/:id`, `client/community/pages/*`, `client/community/announcements/:id` |
| `money.ts` | banking contract adapter (no engine yet) | see docs/APPMINT-MONEY-API-CONTRACT.md |

## Rules
- Start every file with `import "server-only";` and call the engine only through `apiReq` from `@/lib/api`. It carries the app token plus the customer JWT.
- Export small typed functions (`listProducts(q)`, `bookReservation(input)`), not a generic `request(path)`. Put the response types next to them.
- Keep one function per engine operation, and don't duplicate one across files. If two modules need the same call, both import it.
- Client components reach these through server actions (`"use server"` files under the module) or receive data from server components. The browser only talks to the engine directly through the `/api/[...slug]` proxy, and only for the allow-listed paths (chat, uploads).
- Ported base-app/stowbo code: replace its own fetch/axios/runtime calls with the matching function here. Keep its logic otherwise unchanged.
