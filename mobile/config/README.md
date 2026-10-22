# Local device configuration

Copy `local.example.json` to `local.json` and fill in the local development
app credential and Mac LAN address. Use the credential configured for the
development organization, not a customer's sign-in password.

Run the app with:

```sh
flutter run --dart-define-from-file=config/local.json
```

`local.json` is ignored by Git. Keep it private. Build-time values are embedded
in the app, so this file keeps credentials out of source control but is not a
secret vault for a distributed mobile binary.

Reader pairing uses the signed-in, approved Stowbo host's listing address.
Complete the listing's street, city, state where required, postal code, and
country before pairing.
