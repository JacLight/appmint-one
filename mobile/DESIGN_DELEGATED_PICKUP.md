# Delegated pickup — design

Status: design, not built. 2026-09-02.

## One sentence

The person who booked can hand the pickup to someone else: they set who may collect and what the host must check, the collector shows a QR (plus physical ID when required), the host hands over, and everyone gets a record.

Nothing else changes. Same booking, same host flow, same codes, same fees, same payout.

## Rules

- The owner (the customer on the booking) owns the booking end to end. The delegate never becomes the customer.
- A booking can have many hand-offs (different boxes to different people). An item is on at most one active hand-off at a time; revoking one returns its items to the owner's code.
- The owner sets the pickup requirements, like shipping options: who, how they prove it, until when.
- The delegate needs no account and no app. Their link opens the pickup pass: QR, place, hours, note, photo.
- How the pickup physically happens comes from the listing we already control (attended today; lock box or smart lock later). The pass renders whatever that listing needs. Nothing new to model for that now.
- Proof is recorded where custody already records it: the movement out on the booking item. Reports read that, never a separate log.
- Server is the only source of truth for what is allowed at handover. The host app shows the checklist the server sends and confirms it back; it does not decide.

## SDK

A booking can hold several units and each can go to a different person, so a delegation is **per hand-off, not per booking**: one record covers one or more items of one booking, and a booking can have many. It gets its own collection so the public pass can look it up by token and the reports can query it by listing, period and status.

### New: `stowbo-pickup-delegation.ts` — `DataType.stowbo_pickup_delegation`

```ts
name:        { type: 'string', readOnly: true },                 // reference, e.g. pd_7f3k…
booking:     { type: 'string', group: 'link' },                  // booking sk
items:       { type: 'array', items: { type: 'string' }, group: 'link' },  // booking-item sks on that booking (one or more)
customer:    { type: 'string', group: 'link' },                  // the owner (booking customer)
listing:     { type: 'string', group: 'link' },                  // denormalised for host queries

delegate: {                                                      // who may collect
  type: 'object', group: 'who',
  properties: {
    name:  { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
},
verify:      { type: 'string', enum: ['qr', 'qr_name', 'qr_id'], default: 'qr_id', group: 'who' },
validUntil:  { type: 'string', format: 'date-time', group: 'who' },   // defaults to the booking end
note:        { type: 'string', 'x-control-variant': 'textarea', group: 'who' },
photo:       { type: 'string', group: 'who' },

code:        { type: 'string', readOnly: true, group: 'handoff' },    // this hand-off's own pickup code (the QR)
token:       { type: 'string', readOnly: true, group: 'handoff' },    // pass-link token, hashed at rest
sentAt:      { type: 'string', format: 'date-time', readOnly: true, group: 'handoff' },
sentVia:     { type: 'string', enum: ['sms', 'email', 'both'], readOnly: true, group: 'handoff' },

status:      { type: 'string', enum: ['active', 'revoked', 'completed', 'expired'], default: 'active', group: 'status' },
revokedAt:   { type: 'string', format: 'date-time', readOnly: true, group: 'status' },
completedAt: { type: 'string', format: 'date-time', readOnly: true, group: 'status' },
collectedBy: { type: 'string', readOnly: true, group: 'status' },    // name confirmed at the counter
```

Rules the record carries: an item can be on at most one active delegation; the owner's booking `pickupCode` no longer releases an item that is on an active delegation; `validUntil` cannot pass the booking end.

### `stowbo-booking-item.ts` — the outcome stays on the item

Movements already exist (`movements[]` with `at`, `direction`, `by`, `photos`, `note`). Add to each movement:

```ts
collectedBy: {                       // who physically took it, when direction = 'out'
  type: 'object',
  properties: {
    role:       { type: 'string', enum: ['owner', 'delegate', 'host'] },
    delegation: { type: 'string' },  // stowbo_pickup_delegation sk when role = 'delegate'
    name:       { type: 'string' },
  },
},
verified: {                          // what the host confirmed at handover
  type: 'array', items: { type: 'string', enum: ['qr', 'name', 'id', 'photo'] },
},
```

And on the item itself (not per movement, since a refusal is not a movement):

```ts
refusals: {                          // every time the host turned someone away; can happen more than once
  type: 'array',
  items: {
    type: 'object',
    properties: {
      at:         { type: 'string', format: 'date-time' },
      by:         { type: 'string' },                // host who refused
      delegation: { type: 'string' },                // which hand-off they claimed, if any
      who:        { type: 'string' },                // name given at the counter, if any
      reason:     { type: 'string', enum: ['wrong_person', 'expired', 'revoked', 'id_mismatch', 'other'] },
      note:       { type: 'string' },
    },
  },
},
```

### Booking and listing

Booking: no new field. Its timeline records delegated / replaced / revoked / refused / picked-up events. Listing: no change. `staffing` already says attended or not; `accessHours` already says when.

## Server (appengine, stowbo module)

### Owner

| Method | Route | Does |
|---|---|---|
| POST | `client/stowbo/bookings/:bookingId/delegations` | Body `{items[], name, phone?, email?, verify?, validUntil?, note?, photo?}`. Booking must be the caller's; every item must be on it, in custody, and not on another active delegation. Creates the record with its own `code` and `token`, sends the pass (SMS if phone, email if email, both if both), timeline `pickup_delegated`. |
| GET | `client/stowbo/bookings/:bookingId/delegations` | The booking's hand-offs with status, so the owner sees which box goes to whom. |
| POST | `client/stowbo/delegations/:id/resend` | Re-sends the pass. |
| DELETE | `client/stowbo/delegations/:id` | Revokes: status `revoked`, token voided, delegate told, items released back to the owner's code, timeline `pickup_delegation_revoked`. |

Validation lives in `StowboService.createDelegation`: at least one item, one of phone/email required, `validUntil` within the booking window, `verify` in the enum, no item already on an active delegation. The pass token is random, stored hashed, single-use for completion, and carries no PII.

### Third party (public, token only — same pattern as the pay page)

| Method | Route | Does |
|---|---|---|
| GET | `client/stowbo/pickup/:token` | The pass for that hand-off: the items it covers (labels, never the owner's contact), listing title, address, access hours, the note and photo, `verify` (so the page can say "bring photo ID"), `validUntil`, state (`active`, `revoked`, `expired`, `completed`), and the QR payload. |
| GET | `client/stowbo/pickup/:token/receipt` | After completion: what was collected, where, when, which host, the handover photo. This is the third-party report. |

Anything else (chat, changes) goes back to the owner. The pass shows "questions? contact the sender" with no host contact exposed beyond the address.

### Host

The handover is the existing check-out. It gains a delegation-aware pre-check and a confirmation payload.

| Method | Route | Does |
|---|---|---|
| GET | `client/stowbo/host/handover?code=` | Resolves a scanned code: the booking's own code → the owner's items; a delegation code → that hand-off's items. Returns `{ allowed, items[], collector: {role, name, delegation?}, verify: ['qr','id'], validUntil, note, refuseReasons[] }`. `allowed: false` with a reason when the code is unknown, the delegation is revoked or expired, or the items are not present. Called when the host scans. |
| POST | `client/stowbo/host/items/:itemId/checkout` | Existing. Body gains `{delegation?, verified[], photo?}`. The server rejects a delegate handover whose `verified` does not cover the delegation's `verify` level, or an item not on that delegation. Writes the movement out with `collectedBy`/`verified`; when every item on the delegation is out, sets it `completed`; timeline `picked_up_by_delegate`; notifies the owner (with the photo) and the delegate (receipt link). |
| POST | `client/stowbo/host/items/:itemId/refuse` | `{delegation?, reason, who?, note?}`. Appends to the item's `refusals`, timeline `pickup_refused`, notifies the owner. Custody continues; the owner can re-delegate or extend. |

The owner's own pickup is unchanged: same scan, `collectedBy.role = 'owner'`.

### Reports (read the movements, nothing else)

| Who | Route | Returns |
|---|---|---|
| Owner | `client/stowbo/bookings/:bookingId/timeline` (existing) | Now includes delegation events and, on the pickup event, `collectedBy`, `verified`, photo. Proof of delivery. |
| Host | `client/stowbo/host/handovers?from&to&listing&status` | The delegations on the host's listings (who, items, status, collected at, verified, photo) plus every `refusals` entry. Their liability record. |
| Third party | `client/stowbo/pickup/:token/receipt` | See above. |
| Platform | `stowbo/handovers` (admin) | Same as host, all hosts, for disputes. |

### Notifications (stowbo-notify, existing templates pattern)

- `stowbo-pickup-pass` (SMS + email) to the delegate: place, hours, until, "bring photo ID" when required, link.
- `stowbo-pickup-delegated` to the owner: confirmation with who and until when.
- `stowbo-pickup-revoked` to the delegate.
- `stowbo-picked-up` to the owner: who collected, when, photo, receipt link.
- `stowbo-pickup-refused` to the owner: reason.

### Fees

None new. Late pickup, overstay and cancellation apply to the booking exactly as today. If a delegate never comes, the owner is the one who pays or retrieves.

## Clients

### Owner (guest app, booking detail)

- Card **"Pickup"** on an active booking lists each item with who collects it ("You" by default) and a button **Let someone else pick this up** per item, or **Select items** to hand several to one person.
- Form: the items ticked, name, phone or email, verify (chips: QR only · QR + name · QR + photo ID, default QR + photo ID), valid until (date-time, defaults to booking end), note, photo. Send.
- After sending, each delegated item shows "Ada · QR + ID · until Fri 6 pm" with **Resend** and **Revoke** on the hand-off.
- Timeline shows delegated / revoked / picked up by Ada (with photo) / refused (reason).
- Host mode gets the same card when the host booked on behalf of a walk-in? No. Only the booking's customer can delegate.

### Third party (web page, stowbo-web, `/pickup?t=`)

- No sign-in. Opens the pass: big QR, "Show this at the counter", the place with a map link and hours, valid until, the note and photo, "Bring photo ID" when required.
- States: active, revoked ("this pass was revoked by the sender and is no longer valid"), expired, completed (switches to the receipt).
- Receipt page: what, where, when, handover photo. Printable.
- Later, if they have the app and sign in with the phone or email on the delegation, the same pass appears under My stuff. Not required for v1.

### Host (host app, existing handover)

- Scan the QR (existing scanner) or type the code. The app calls `handover?code=` and shows the result:
  - Owner pickup: as today.
  - Delegate pickup: banner "Delegated pickup · Ada · verify: QR + photo ID · until Fri 6 pm", the note and photo from the sender.
  - Not allowed: the reason, with **Refuse** actions (wrong person, expired, revoked, ID mismatch) that notify the owner.
- Checklist before **Hand over**: "ID matches Ada", "Item condition ok", handover photo (required for delegate pickups). The button is disabled until the server's `verify` items are ticked.
- Booking card and Today board show a small "Delegated pickup" tag so the host knows before anyone arrives.
- Host report: **Handovers** under Money or Bookings: list by period and listing, each row with collector, verified, photo. Export later.

## Sequence

1. Owner books, drops off. Custody as today.
2. Owner picks the boxes for Ada and delegates. Server creates the delegation with its own code, sends the pass.
3. Ada arrives, shows the QR. Host scans → `handover?code=` resolves the delegation → its items and checklist.
4. Host confirms, takes the photo, hands over → checkout with `collectedBy` + `verified`.
5. Owner gets "picked up by Ada, 3:12 pm" with the photo. Delegate gets the receipt. Host's handovers report has the row.

## Edge cases

- Owner arrives while a delegation is active: their own code releases only the items not delegated. To take a delegated item back they revoke that hand-off first (one tap in the app); the delegate's pass then shows "revoked by the sender".
- Delegate arrives after `validUntil`: refused as expired; owner notified; owner can extend by delegating again.
- Several items on one booking: each hand-off names its items; the rest stay on the owner's code. One item cannot be on two active hand-offs.
- Wrong person with the right QR: the `verify` level is the defence. `qr` only means the owner accepted that risk, like "no signature required".
- Lock box or smart lock (future): the pass renders the box code or an Open button from the listing's access method; the unlock event becomes the movement out with `collectedBy.role = 'delegate'`. Same record, same reports.

## Out of scope for v1

- Delegate accounts and in-app chat with the delegate (SMS carries the pass; questions go to the sender).
- Payment by the delegate at pickup (the counter can still take a payment for the booking if it is unpaid, as today).
- Lock hardware integrations.

## Files this touches

- SDK: new `sdk/src/models/stowbo/stowbo-pickup-delegation.ts` + `DataType.stowbo_pickup_delegation`; `stowbo-booking-item.ts` (movement `collectedBy`, `verified`; item `refusals[]`).
- Server: `stowbo.service.ts` (createDelegation, revoke, resolve-by-code handover pre-check, checkout verification, refuse), `stowbo-client.controller.ts` (routes above), `stowbo-notify.service.ts` (templates), `stowbo-operator.service.ts` (platform handovers report).
- Guest app: booking detail pickup card + delegate form + timeline rows.
- Host app: handover pre-check + checklist + refuse, "Delegated pickup" tag, Handovers report.
- Web: `/pickup` pass and receipt pages.
