# Appmint One

One app, many businesses. Each business gets a **setup** that switches modules
on, names things in its trade's own words, and applies its brand. Same
codebase, same backend — a muvmnt build and a residences build share every
line and look nothing alike.

The setups exist to **showcase [appengine](https://appengine.appmint.io)**.
They are not products with customers; they are the argument for the backend,
which is the thing being sold. A setup that renders empty states demonstrates
the opposite of the pitch, so these builds are only worth anything pointed at
a live server with real data.

Two of the names are different. **stowbo** (selling space) and **muvmnt**
(delivery and rides) are sister products that actually ship. Copies of those
apps will live in this repo alongside the showcase, and will be renamed to
what each one does rather than to its working title.

## Layout

| | |
|---|---|
| `web/` | Next.js storefront and portal, port 3710 |
| `mobile/` | Flutter app — iOS and Android |

## Modules

A setup switches on any combination. `home` decides which one the app opens
into, and whether the setup has a provider side at all.

`property` · `lms` · `money` · `store` · `rentals` · `scheduling` · `logistics`

Customer and provider sides are separate shells per module — a tenant and a
property manager are not the same app, and neither is a learner and an
instructor.

## Setups

`muvmnt` · `stowbo` · `rental` · `law-firm` · `medical` · `studio` · `bank` ·
`residences` · `academy` · `demo`

`demo` switches every module on at once. It is not a business.

Setups are declared in `mobile/lib/config/setup.dart`. Brand artwork resolves
from `mobile/assets/images/<setup id>_wordmark.png` and falls back to the
brand name set in type, so a setup with no logo yet never shows another
setup's.

## Running it

Credentials are **never committed**. Both clients read `APP_ID`, `APP_KEY` and
`APP_SECRET` from the environment at build time.

```sh
# mobile — copy the example, fill in the dev credential, then:
cp mobile/config/local.example.json mobile/config/local.json
cd mobile && flutter pub get
flutter run --dart-define-from-file=config/local.json

# web
cd web && npm install && npm run dev
```

`mobile/config/local.json` and `web/.env*` are gitignored. See
`mobile/config/README.md`, and `web/k8-deploy.template.yaml` for how secrets
reach a deployed build (a Kubernetes Secret, never the manifest).

Build-time values are embedded in a distributed binary. This keeps credentials
out of source control; it is not a secret vault.

## Known rough edges

- `mobile/pubspec.yaml` depends on `appmint_chat` by path into an `appmint_go`
  checkout beside this one, so **this repo does not yet build from a fresh
  clone on its own**. It resolves when the stowbo copy lands, since both
  share that package.
- The app credential is blank by default. Until it is filled in, every module
  renders its empty state and every request is refused — which is the first
  thing to check when a screen looks broken.
