import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// A capability the portal can present. A setup switches these on; the person
/// using the app never picks them.
/// Events is deliberately absent: EventOxygen stays its own app.
enum PortalModule { scheduling, logistics, rentals, store, money, lms, property }

/// Which side of the business the signed-in person is on.
///
/// Staff and admin are deliberately absent: they stay in Studio, per the scope.
enum PortalRole { customer, provider }

/// The words one trade uses for the things every setup has.
///
/// Shared screens never hardcode a noun. A legal setup renders "Matter" where a
/// clinic renders "Visit", from the same widget. Keys are canonical concepts,
/// listed in [LexiconKeys]; anything unset falls back to the neutral word.
class Lexicon {
  final Map<String, String> _terms;
  const Lexicon(this._terms);

  static const Lexicon neutral = Lexicon({});

  static const Map<String, String> _fallbacks = {
    LexiconKeys.booking: 'Booking',
    LexiconKeys.bookings: 'Bookings',
    LexiconKeys.customer: 'Customer',
    LexiconKeys.provider: 'Provider',
    LexiconKeys.item: 'Item',
    LexiconKeys.items: 'Items',
    LexiconKeys.job: 'Job',
    LexiconKeys.jobs: 'Jobs',
    LexiconKeys.plan: 'Plan',
    LexiconKeys.course: 'Course',
    LexiconKeys.account: 'Account',
    LexiconKeys.property: 'Property',
    LexiconKeys.properties: 'Properties',
    LexiconKeys.unit: 'Unit',
    LexiconKeys.units: 'Units',
    LexiconKeys.lease: 'Lease',
    LexiconKeys.leases: 'Leases',
    LexiconKeys.request: 'Request',
    LexiconKeys.requests: 'Requests',
  };

  /// The word this setup uses. Title case, as written in the setup.
  String term(String key) =>
      _terms[key] ?? _fallbacks[key] ?? key;

  /// Same word, lowercased for mid-sentence use ("your 3 matters").
  String lower(String key) => term(key).toLowerCase();

  bool defines(String key) => _terms.containsKey(key);
}

/// The canonical concepts a setup may rename. Shared screens reference these
/// constants rather than literal strings, so adding a trade is a data change.
abstract final class LexiconKeys {
  /// The scheduled thing: appointment, consultation, visit, session, class.
  static const booking = 'booking';
  static const bookings = 'bookings';

  /// The person buying: client, patient, guest, member, rider.
  static const customer = 'customer';

  /// The person delivering: driver, coach, doctor, lawyer, host, door staff.
  static const provider = 'provider';

  /// The thing transacted: space, item, product, ticket.
  static const item = 'item';
  static const items = 'items';

  /// The unit of work in logistics: delivery, ride, errand.
  static const job = 'job';
  static const jobs = 'jobs';

  /// A membership or subscription: membership, plan, pass.
  static const plan = 'plan';

  /// An LMS course.
  static const course = 'course';

  /// A money account.
  static const account = 'account';

  /// The place let out whole: building, property, community, site.
  static const property = 'property';
  static const properties = 'properties';

  /// The lettable part of it: apartment, suite, room, bay, pad.
  static const unit = 'unit';
  static const units = 'units';

  /// The agreement to occupy: lease, tenancy, agreement, contract.
  static const lease = 'lease';
  static const leases = 'leases';

  /// What the occupant raises and the operator answers: request, ticket,
  /// work order, repair.
  static const request = 'request';
  static const requests = 'requests';
}

/// Brand identity. Bundle id, display name and icon are NOT here: those are
/// native build config and belong to the Flutter flavor (see
/// specs/PORTAL_SCOPE.md, "Mobile-specific notes").
class Brand {
  final String name;
  final Color primary;
  final Color accent;

  /// Google Fonts families. Null keeps the theme's default.
  final String? displayFont;
  final String? bodyFont;

  /// The entity named on the terms and privacy pages. Blank means the setup
  /// has not supplied one, and those pages must say so rather than invent it.
  final String legalEntity;
  final String? termsUrl;
  final String? privacyUrl;

  /// One line under the wordmark. Optional — a setup without one shows just
  /// the name rather than borrowing another setup's words.
  final String? tagline;

  const Brand({
    required this.name,
    required this.primary,
    required this.accent,
    this.displayFont,
    this.bodyFont,
    this.legalEntity = '',
    this.termsUrl,
    this.privacyUrl,
    this.tagline,
  });
}

/// One business's configuration of the portal.
class PortalSetup {
  /// Stable key, matched against `--dart-define=SETUP=<id>`. Never change one.
  final String id;
  final Brand brand;
  final Set<PortalModule> modules;
  final Lexicon lexicon;

  /// Which module the app opens into. Must be in [modules].
  final PortalModule home;

  /// Roles this setup offers. A setup with no provider side lists only
  /// customer, and the app then never shows a role switch.
  final Set<PortalRole> roles;

  /// What each side is here to do, shown on the shared role-select screen.
  /// Unset falls back to a sentence built from the lexicon, so a new setup
  /// reads sensibly before anyone writes copy for it.
  final String? customerBlurb;
  final String? providerBlurb;

  /// One line describing the business, for the demo chooser. This is the only
  /// place a setup gets to introduce itself.
  final String pitch;

  const PortalSetup({
    required this.id,
    required this.brand,
    required this.modules,
    required this.home,
    this.lexicon = Lexicon.neutral,
    this.roles = const {PortalRole.customer},
    this.customerBlurb,
    this.providerBlurb,
    this.pitch = '',
  });

  String blurbFor(PortalRole role) {
    if (role == PortalRole.provider) {
      return providerBlurb ??
          'Work as a ${lexicon.lower(LexiconKeys.provider)}';
    }
    return customerBlurb ??
        'Book as a ${lexicon.lower(LexiconKeys.customer)}';
  }

  String labelFor(PortalRole role) => role == PortalRole.provider
      ? lexicon.term(LexiconKeys.provider)
      : lexicon.term(LexiconKeys.customer);

  bool has(PortalModule m) => modules.contains(m);
  bool get hasProviderSide => roles.contains(PortalRole.provider);

  /// Documents and wallet are common to every setup, so they are not modules.
  /// This is here so screens can ask the same way for everything.
  bool get hasDocuments => true;
  bool get hasWallet => true;
}

// ── The setups ────────────────────────────────────────────────────────────
//
// Order follows the build order in specs/PORTAL_SCOPE.md. Only muvmnt is in
// flight; the rest are declared so the shape is agreed before their screens
// exist, and so the demo build can show them.

const _muvmnt = PortalSetup(
  id: 'muvmnt',
  brand: Brand(
    name: 'muvmnt',
    primary: Color(0xFF111111),
    accent: Color(0xFF00E07A),
    displayFont: 'Space Grotesk',
    bodyFont: 'Inter',
  ),
  // Uber and Uber Eats in one: ordering from merchants, plus the courier and
  // ride legs that deliver it.
  modules: {PortalModule.logistics, PortalModule.store},
  home: PortalModule.store,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.job: 'Delivery',
    LexiconKeys.jobs: 'Deliveries',
    LexiconKeys.provider: 'Driver',
    LexiconKeys.customer: 'Customer',
  }),
  customerBlurb: 'I want something delivered',
  providerBlurb: 'I want to drive and earn',
  pitch: 'Order a delivery, watch the driver move, pay on arrival.',
);

const _stowbo = PortalSetup(
  id: 'stowbo',
  brand: Brand(
    name: 'Stowbo',
    primary: Color(0xFF14213D),
    accent: Color(0xFFFCA311),
    tagline: 'Stow it. Go enjoy. Grab it later.',
  ),
  modules: {PortalModule.rentals},
  home: PortalModule.rentals,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.item: 'Space',
    LexiconKeys.items: 'Spaces',
    LexiconKeys.booking: 'Booking',
    LexiconKeys.bookings: 'Bookings',
    LexiconKeys.provider: 'Host',
  }),
  customerBlurb: 'I want to stow something',
  providerBlurb: 'I have space to offer',
  pitch: 'Drop your bags or park, grab them later.',
);

const _rentalCo = PortalSetup(
  id: 'rental',
  brand: Brand(
    name: 'Rentals',
    primary: Color(0xFF0F3D3E),
    accent: Color(0xFF68B684),
  ),
  modules: {PortalModule.rentals, PortalModule.store},
  home: PortalModule.rentals,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.booking: 'Rental',
    LexiconKeys.bookings: 'Rentals',
    LexiconKeys.item: 'Item',
    LexiconKeys.items: 'Items',
    LexiconKeys.provider: 'Host',
  }),
  pitch: 'Rent a space, a boat or a kit by the day.',
);

const _lawFirm = PortalSetup(
  id: 'law-firm',
  brand: Brand(
    name: 'Law firm',
    primary: Color(0xFF1C2541),
    accent: Color(0xFFB8860B),
  ),
  modules: {PortalModule.scheduling},
  home: PortalModule.scheduling,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.booking: 'Matter',
    LexiconKeys.bookings: 'Matters',
    LexiconKeys.customer: 'Client',
    LexiconKeys.provider: 'Attorney',
  }),
  pitch: 'Book a consultation and follow your matter.',
);

const _medical = PortalSetup(
  id: 'medical',
  brand: Brand(
    name: 'Medical practice',
    primary: Color(0xFF0B4F6C),
    accent: Color(0xFF01BAEF),
  ),
  modules: {PortalModule.scheduling},
  home: PortalModule.scheduling,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.booking: 'Appointment',
    LexiconKeys.bookings: 'Appointments',
    LexiconKeys.customer: 'Patient',
    LexiconKeys.provider: 'Clinician',
  }),
  pitch: 'Book a visit and keep your records in one place.',
);

const _studio = PortalSetup(
  id: 'studio',
  brand: Brand(
    name: 'Studio',
    primary: Color(0xFF2B2D42),
    accent: Color(0xFFEF476F),
  ),
  modules: {PortalModule.scheduling, PortalModule.store, PortalModule.lms},
  home: PortalModule.scheduling,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.booking: 'Class',
    LexiconKeys.bookings: 'Classes',
    LexiconKeys.plan: 'Membership',
    LexiconKeys.course: 'Course',
    LexiconKeys.provider: 'Coach',
    LexiconKeys.customer: 'Member',
  }),
  pitch: 'Book classes, buy a membership, take the course.',
);

const _bank = PortalSetup(
  id: 'bank',
  brand: Brand(
    name: 'Bank',
    primary: Color(0xFF003049),
    accent: Color(0xFF66D9A6),
    displayFont: 'Space Grotesk',
    bodyFont: 'Inter',
  ),
  modules: {PortalModule.money},
  home: PortalModule.money,
  lexicon: Lexicon({
    LexiconKeys.account: 'Account',
    LexiconKeys.customer: 'Customer',
  }),
  customerBlurb: 'My accounts, cards and payments',
  pitch: 'Open an account, move money, lock a card — a retail bank in hand.',
);

const _residences = PortalSetup(
  id: 'residences',
  brand: Brand(
    name: 'Residences',
    primary: Color(0xFF263040),
    accent: Color(0xFFD98A3C),
    displayFont: 'Fraunces',
    bodyFont: 'Inter',
  ),
  // Money is on because rent is the whole relationship: a tenant portal that
  // cannot take a payment is a noticeboard.
  modules: {PortalModule.property, PortalModule.money},
  home: PortalModule.property,
  roles: {PortalRole.customer, PortalRole.provider},
  lexicon: Lexicon({
    LexiconKeys.customer: 'Resident',
    LexiconKeys.provider: 'Manager',
    LexiconKeys.property: 'Building',
    LexiconKeys.properties: 'Buildings',
    LexiconKeys.unit: 'Apartment',
    LexiconKeys.units: 'Apartments',
    LexiconKeys.lease: 'Lease',
    LexiconKeys.leases: 'Leases',
    LexiconKeys.request: 'Request',
    LexiconKeys.requests: 'Requests',
    LexiconKeys.booking: 'Viewing',
    LexiconKeys.bookings: 'Viewings',
  }),
  customerBlurb: 'I live here — rent, repairs and notices',
  providerBlurb: 'I run the buildings',
  pitch: 'Tour apartments, apply, then pay rent and raise repairs in one place.',
);

const _academy = PortalSetup(
  id: 'academy',
  brand: Brand(
    name: 'Academy',
    primary: Color(0xFF2D2A5C),
    accent: Color(0xFF17B890),
    displayFont: 'Fraunces',
    bodyFont: 'Inter',
  ),
  // A course can be sold, so the store is on: the catalogue is the shop
  // window and checkout is the same checkout every other setup uses.
  modules: {PortalModule.lms, PortalModule.store},
  home: PortalModule.lms,
  // Customer only for now. The instructor's side — enrolments, the review
  // queue, cohorts — has an API and no screens, and offering a role that
  // lands on nothing is worse than not offering it.
  roles: {PortalRole.customer},
  lexicon: Lexicon({
    LexiconKeys.customer: 'Learner',
    LexiconKeys.provider: 'Instructor',
    LexiconKeys.course: 'Course',
    LexiconKeys.item: 'Course',
    LexiconKeys.items: 'Courses',
  }),
  customerBlurb: 'I want to learn something',
  pitch: 'Browse courses, enrol, and work through them step by step.',
);

/// Every module on — for showing the platform, never for a customer build.
const _demo = PortalSetup(
  id: 'demo',
  brand: Brand(
    name: 'Appmint One',
    primary: Color(0xFF14213D),
    accent: Color(0xFF4DD4E8),
  ),
  modules: {
    PortalModule.scheduling,
    PortalModule.logistics,
    PortalModule.rentals,
    PortalModule.store,
    PortalModule.money,
    PortalModule.lms,
    PortalModule.property,
  },
  // Opens on a module that has screens. Landing the demo on an unbuilt one
  // puts a dead end in front of whoever opens the app first.
  home: PortalModule.rentals,
  roles: {PortalRole.customer, PortalRole.provider},
  pitch: 'Every module switched on, to see the whole platform.',
);

const List<PortalSetup> kSetups = [
  _muvmnt,
  _stowbo,
  _rentalCo,
  _lawFirm,
  _medical,
  _studio,
  _bank,
  _residences,
  _academy,
  _demo,
];

/// Which setup this build is.
///
/// `--dart-define=SETUP=muvmnt` picks one at build time. A build that names no
/// setup is the demo build: every module on, and the setup can be changed at
/// runtime from the switcher so the whole platform can be shown from one
/// install. A build that names a setup is a customer's app and cannot be
/// switched — except in debug, for development.
abstract final class CurrentSetup {
  static const String _requested = String.fromEnvironment('SETUP');

  /// Runtime override, set by the switcher. Null means use the build's.
  static PortalSetup? _runtime;

  /// True when this build allows changing setup at runtime.
  static bool get switchable => _requested.trim().isEmpty || kDebugMode;

  static PortalSetup get value {
    final override = _runtime;
    if (override != null && switchable) return override;
    final id = _requested.trim().toLowerCase();
    if (id.isEmpty) return _demo;
    for (final s in kSetups) {
      if (s.id == id) return s;
    }
    return _demo;
  }

  /// Change the active setup. Ignored on a locked customer build.
  static void use(PortalSetup setup) {
    if (!switchable) return;
    _runtime = setup;
  }

  static PortalSetup? byId(String id) {
    final want = id.trim().toLowerCase();
    for (final s in kSetups) {
      if (s.id == want) return s;
    }
    return null;
  }

  /// True when SETUP named something unknown — a build misconfiguration.
  static bool get isFallback =>
      _requested.trim().isNotEmpty && value.id == _demo.id;

  static String get requestedId => _requested;

  // Shorthands, so screens read plainly.
  static Brand get brand => value.brand;
  static Lexicon get words => value.lexicon;
  static Set<PortalModule> get modules => value.modules;
  static bool has(PortalModule m) => value.has(m);
  static String term(String key) => value.lexicon.term(key);
}
