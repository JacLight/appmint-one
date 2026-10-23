# Appmint One

One web app for every business setup on AppMint, headless over appengine. It is the
web side of the mobile portal (`appmint_go/appmint_portal`): same setup ids, modules,
roles and words. It was built from stowbo-web. Stowbo's marketplace became the
**Rentals** module, and the `stowbo` setup looks and works like stowbo-web.

## Run locally

```bash
npm install
npm run dev                         # http://localhost:3710, setup from .env.development.local
PORTAL_SETUP=muvmnt npm run dev     # or pick a setup per run
```

`.env.local` holds the engine connection (org, app keys, OAuth, maps). Never commit it.

## Setups

`PORTAL_SETUP` picks the setup at **runtime**, so one image serves all of them. The
match ignores case. If the value is missing or unknown, the app falls back to `demo`,
and in dev a banner says so.

| id | modules |
|---|---|
| `muvmnt` | logistics |
| `event-oxygen` | events, store |
| `stowbo` | rentals (Stowbo's own pages) |
| `rental` | rentals |
| `law-firm` | scheduling |
| `medical` | scheduling |
| `studio` | scheduling, store, lms |
| `bank` | money |
| `demo` | everything |

Setups live in `src/setups/*.ts` and are typed by `src/setups/types.ts`. A setup holds
the brand (colours, fonts and logo, injected as CSS tokens), modules, lexicon, roles,
nav per role, home sections, footer, legal and support.

Module facts (paths, built or not) are in `src/setups/modules.ts`. A module that is
not built yet shows a "coming soon" page at its path, so no link is dead.

### Customer banking

The `bank` setup is the separate banking client, with its Flutter counterpart in
`../mobile`. It is independent of the staff banking app; base-app is not part of
this client.

Run against the existing AppEngine customer API with your normal app credentials:

```bash
PORTAL_SETUP=bank PORTAL_MONEY_API=engine npm run dev
```

Set `APPENGINE_ENDPOINT`, `ORG_ID`, `APP_ID`, `APP_KEY` and `APP_SECRET` in the
ignored local environment. The engine adapter uses the platform's existing
account, payment, payee, card, loan, private-file and document services. It maps
complete activity and statement archives, business account opening, disputes,
card shipping/lifecycle and personal limits under bank ceilings, loan corrections
and condition evidence, and authenticated statement/payoff/sent-notice PDFs.
Customer condition responses remain subject to the bank's review.

Own-account, external ACH, opted-in member and bank-request payments use the same
server-signed review/confirmation flow and Redis reservations. Payment keys stay
stable across uncertain retries; pending or unknown outcomes are not presented as
paid. External ACH requests and card orders still require the bank's actual
network/processor handling; preparation is not a delivery or settlement promise.

Additional money verification is optional and defaults off. When enabled in bank
policy, customers enroll through the existing authenticator setup and the bank
independently approves the exact factor through its common approval workflow.
The shared confirmation uses that approved authenticator, with scoped one-use
proofs, live revocation checks and durable retry recovery. Newly enrolled factors
are never trusted automatically. Redis and the platform's authenticator method
must be available; recovering a lost approved factor requires bank review.

Automatic loan payments also default off. They require reviewed bank policy and
an existing configured signing form. Customers request the bank's agreement,
sign through its existing signing flow, check actual completion/review, and may
revoke future debits. Requesting an agreement is not signing it or enabling a
payment. Execution uses existing loan allocation and end-of-day services.

Member receiving is an explicit customer opt-in with a designated owned account.
Resolution uses an exact existing username and a short-lived caller-bound token;
it is not a global customer directory or phone/email search. Bank money requests
support full-amount USD same-bank payments, paged incoming/outgoing views,
cancellation/decline and authenticated share links. Creating a request sends no
message. Share entry preserves the capability while the existing sign-in flow
opens in another tab; no sign-in or bank verification is simulated.

Receiving details use the owner's configured account/bank instructions. Show/Hide
is a local privacy control, and unavailable bank address, wire instructions or
arrival timing are omitted. The mobile client's `BANK_PORTAL_URL` build setting
must name the banking website before it can copy complete request share links.

`PORTAL_MONEY_SAMPLE=1` explicitly selects the labeled demonstration mode. A
custom banking contract can still use `PORTAL_MONEY_API_URL`. Sample/custom
connections retain their own adapter contracts. Source tests and builds do not
attest live customer browser/device journeys or external bank settlement.

Every setup gets auth, account, settings, messages, support, wallet and documents.

## Layout

- `src/app/(rentals)/**` and `src/app/account/(rentals)/**`: Rentals routes, served
  only when the setup has `rentals` on. Everything else returns 404.
- `src/modules/rentals/**`: Rentals libs, components, actions, and Stowbo's home,
  help and legal pages.
- `src/app/[module]`, `src/app/account/[module]`, `src/app/provider`: coming-soon pages.
- `src/lib/setup.ts`: `getSetup()`, server-only and cached per request.
- `src/lib/auth.ts`: `getSession()`, a generic session cached per request.
- `src/lib/theme.ts`: turns the brand into CSS tokens.

## Build and deploy

```bash
npm run build
./build-docker.sh <setup> [tag]      # image jaclight/appmint-one:<setup>-<version>, loaded locally
```

No keys are baked into the image. `k8-deploy.template.yaml` reads everything secret
from a per-setup k8s Secret (`appmint-one-<setup>-env`); the file header lists its
keys. Render it with `envsubst` (SETUP, NAMESPACE, HOST, IMAGE) and apply it.

Never commit a rendered `k8-deploy.yaml`.
