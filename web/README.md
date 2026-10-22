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
