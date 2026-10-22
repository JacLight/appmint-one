# Appmint One — blueprint

One app, many businesses. Each business gets a **setup** that switches modules
on, renames things in its trade's words, and applies its brand. This file is
the contract a client follows when extending it.

Scope: `/Users/imzee/projects/docs/APPMINT-PORTAL-SCOPE.md`.

## Run it

```sh
flutter run -d chrome \
  --dart-define=SETUP=muvmnt \
  --dart-define-from-file=config/local.json
```

No `SETUP` is the demo build: every module on, and the setup can be changed at
runtime from **Account → Switch setup**. A build that names a setup is a
customer's app and is locked to it.

`config/local.json` holds the app credential and is gitignored — copy
`config/local.example.json`. Without it, app sign-in fails and says so.

## The shape of a module

Every module is the same four pieces. Learn one, you can write the next.

```
lib/services/<module>_api.dart        one method per real server route
lib/providers/<module>_provider.dart  ChangeNotifier: data, loading, error
lib/screens/modules/<module>/
    customer/   ...screens + <module>_customer_shell.dart
    provider/   ...screens + <module>_provider_shell.dart
```

Then one line each in `lib/main.dart` (register the provider) and
`lib/screens/root_screen.dart` (map the module to its two shells).

### Rules that keep the setups looking like one product

1. **Never hardcode a noun.** Use `CurrentSetup.term(LexiconKeys.booking)` and
   friends. The same screen must read "Appointment" in a clinic and "Matter" in
   a law firm.
2. **Never hardcode a brand.** `CurrentSetup.brand`, and `BrandWordmark` for the
   logo — it falls back to the brand name set in type when a setup has no
   artwork, so no setup ever wears another's logo. The theme itself is built
   per setup (`StowboTheme.forBrand`), so buttons, focus rings, cursors and
   fonts are the business's own. Shapes, spacing and surfaces stay shared —
   those are the design system, not the branding. A brand's font must be
   resolved by name in `_display` / `_bodyTheme`: `GoogleFonts.getFont(name)`
   with a variable keeps the whole font catalogue through tree-shaking and
   cost 9MB of APK the one time it was written that way.
3. **Use the shared states.** `ModuleLoading`, `ModuleError`, `ModuleEmpty` from
   `lib/screens/modules/shared/module_states.dart`. Loading, empty and failure
   are already decided; do not reinvent them per screen.
4. **The server owns truth.** Prices, statuses and stages come from the server
   and are never computed locally. A status the app does not recognise is
   rendered, not guessed at.
5. **Fail out loud.** Show the server's own message. No silent no-ops, no
   fake-working UI. A missing permission or a dead endpoint says which.

## Modules

| Module | API | Customer | Provider |
|---|---|---|---|
| `logistics` | `/client/logistics`, `/logistics/delivery` | order, track, deliveries | online, feed, job stages, earnings |
| `scheduling` | `/client-data`, `/checkin` | bookings | today, queue, check-in, no-show |
| `money` | `/client/finance`, `/finance/customer-wallets` | balance, activity, banks | — |
| `rentals` | `/client/stowbo` | browse, book, custody | listings, bookings, handover, earnings |
| `store` | `/storefront` | browse, cart, checkout | — |
| `property` | `/client/stowbo`, `/client-data/tickets`, `/notice` | showcase, apply, rent, repairs, notices | portfolio, unit board, leasing, SLA queue, announcements |
| `lms` | `/client/content-catalog`, `/client/content-studio` | catalogue, enrol, player | not written yet — staff-guarded API |

`events` is deliberately absent — EventOxygen stays its own app.

## Known API gaps

Build the screen, show "not available yet", and name the endpoint. These are
the ones found so far:

Before adding an endpoint, find the one that already answers it. The manager
queue, applications and notices all run on existing staff routes
(`crm/tickets/list`, `crm/forms/submissions`, `repository/*`), and the course
catalogue on `site/page-data/post`. A module per feature is how a codebase
ends up with folders whose names do not match their routes.

| Needed for | Missing |
|---|---|
| Answering a quiz | Questions are HTML inputs inside the page; marking is by input name. Needs a structured `page.questions[]`, not a parser guessing at markup |
| Instructor screens | Enrolments, review queue and cohorts are all `@Controller('content-studio')`, which is staff-guarded — a coach signed in as a customer cannot reach them |
| A building-scoped notice | `site_notice` targets by `site`; `notice/inbox` does not filter on `listing`, so the app filters instead |
| SLA | No targets or breach clock on `ticket` — the policy is declared in `lib/config/sla_policy.dart` and should move to org config |
| Booking a service | Nothing lists `reservation_definition`, so a customer cannot discover what is bookable |
| Send / request money | No wallet-to-wallet transfer; no money-request object |
| Receiving money | A wallet has no account or routing number |
| Cards | No issuer integration |
| Live tracking | No logistics socket gateway — tracking polls |
| Map search | No `$near` / geoWithin query for listings or agents |

## Reference, not code

`reference/appmint_mobile/` is appmint_mobile's operations and POS closure,
kept as a spec for behaviour and endpoints. It is outside `lib/` on purpose: it
carries its own theme and HTTP client, and wiring it in would put two design
languages in one app. Read it, then write the screen natively.
