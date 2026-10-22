# Reference only — not compiled

`appmint_mobile/` is the dependency closure of appmint_mobile's `operations/`
screens (Scheduling) and `pos/` (Store), copied here on 2026-10-21.

**It is deliberately outside `lib/`, so it is not part of the build.** It was
briefly inside and that was wrong: it carries its own theme (HaHo), its own
HTTP client and its own providers, so wiring it in would have produced two
design languages and two auth stacks in one app.

Use it the way you would use a spec:

- what each screen does, and in what order
- which endpoints it calls, with what payloads
- the edge cases it already handles (stock, 86'd items, split tabs, no-show)

Then build the screen natively in this app — `SColors` / `SSpace` / `SRadius`,
`AppengineHttpClient`, this app's providers — so every setup looks like one
product.
