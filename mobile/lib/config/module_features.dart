import 'package:flutter/material.dart';

import 'setup.dart';

/// One thing a business can do with a module.
///
/// `live` says whether the screen exists in this build. A directory that
/// promised everything equally would be a brochure; marking what is built
/// keeps it honest while still showing the whole offering.
class Feature {
  final String label;
  final IconData icon;
  final bool live;
  const Feature(this.label, this.icon, {this.live = false});
}

/// What each module offers, per side. Taken from the scope document so the
/// directory and the product description cannot drift apart.
abstract final class ModuleFeatures {
  static const Map<PortalModule, String> headline = {
    PortalModule.scheduling: 'Appointments, classes and cases',
    PortalModule.logistics: 'On-demand delivery and rides',
    PortalModule.rentals: 'Rent space, kit or vehicles',
    PortalModule.store: 'Catalog, cart and checkout',
    PortalModule.money: 'A bank in your pocket',
    PortalModule.lms: 'Courses, quizzes and certificates',
    PortalModule.property: 'Buildings, leases and residents',
  };

  static const Map<PortalModule, List<Feature>> customer = {
    PortalModule.scheduling: [
      Feature('Book appointments and classes', Icons.event_available_rounded, live: true),
      Feature('Manage, reschedule, cancel', Icons.edit_calendar_rounded, live: true),
      Feature('Memberships and class packs', Icons.card_membership_rounded),
      Feature('A case: intake, stages, notes, invoices', Icons.folder_open_rounded),
    ],
    PortalModule.logistics: [
      Feature('Request a delivery or ride', Icons.add_road_rounded, live: true),
      Feature('Get a price before you book', Icons.sell_rounded, live: true),
      Feature('Track the driver live', Icons.my_location_rounded, live: true),
      Feature('Chat, rate, report an issue', Icons.forum_rounded, live: true),
    ],
    PortalModule.rentals: [
      Feature('Browse and map search', Icons.map_rounded, live: true),
      Feature('Availability calendar and dates', Icons.date_range_rounded, live: true),
      Feature('Deposit, pay, extend, return', Icons.key_rounded, live: true),
      Feature('My rentals and reviews', Icons.reviews_rounded, live: true),
    ],
    PortalModule.store: [
      Feature('Browse the catalog', Icons.storefront_rounded),
      Feature('Options, cart and checkout', Icons.shopping_cart_rounded),
      Feature('Order history and returns', Icons.assignment_return_rounded),
      Feature('Gift cards', Icons.card_giftcard_rounded),
    ],
    PortalModule.money: [
      Feature('Accounts, balances, statements', Icons.account_balance_rounded, live: true),
      Feature('Identity check with documents', Icons.badge_rounded, live: true),
      Feature('Open an account', Icons.add_card_rounded, live: true),
      Feature('Transfer here, pay out, pull in', Icons.swap_horiz_rounded, live: true),
      Feature('Payees with micro-deposit checks', Icons.people_alt_rounded, live: true),
      Feature('Cards: lock, limits, replace', Icons.credit_card_rounded, live: true),
      Feature('Dispute a transaction', Icons.gavel_rounded, live: true),
    ],
    PortalModule.lms: [
      Feature('Browse and search the catalog', Icons.menu_book_rounded, live: true),
      Feature('Enrol and work through the steps', Icons.school_rounded, live: true),
      Feature('Progress the server owns, step by step', Icons.timeline_rounded, live: true),
      Feature('Quizzes and marked work', Icons.quiz_rounded),
      Feature('Certificates', Icons.workspace_premium_rounded),
    ],
    PortalModule.property: [
      Feature('Tour apartments and rooms', Icons.apartment_rounded, live: true),
      Feature('Apply, upload documents, sign', Icons.assignment_turned_in_rounded, live: true),
      Feature('Pay rent, see the balance', Icons.payments_rounded, live: true),
      Feature('Raise a repair, track the SLA', Icons.build_circle_rounded, live: true),
      Feature('Building notices, acknowledge', Icons.campaign_rounded, live: true),
    ],
  };

  static const Map<PortalModule, List<Feature>> provider = {
    PortalModule.scheduling: [
      Feature("Today's schedule", Icons.today_rounded, live: true),
      Feature('Queue and check-in', Icons.how_to_reg_rounded, live: true),
      Feature('No-show and walk-ins', Icons.person_off_rounded, live: true),
      Feature('Notes and follow-ups', Icons.sticky_note_2_rounded),
    ],
    PortalModule.logistics: [
      Feature('Go online and take work', Icons.toggle_on_rounded, live: true),
      Feature('Pickup to drop-off steps', Icons.alt_route_rounded, live: true),
      Feature('Photo proof of delivery', Icons.photo_camera_rounded, live: true),
      Feature('Earnings and payouts', Icons.payments_rounded, live: true),
    ],
    PortalModule.rentals: [
      Feature('List spaces or items', Icons.add_business_rounded, live: true),
      Feature('Pricing and availability', Icons.price_change_rounded, live: true),
      Feature('Handover and return', Icons.swap_calls_rounded, live: true),
      Feature('Deposits, coupons, earnings', Icons.savings_rounded, live: true),
    ],
    PortalModule.property: [
      Feature('Portfolio, occupancy, vacancy', Icons.domain_rounded, live: true),
      Feature('Unit board: vacant, occupied, down', Icons.grid_view_rounded, live: true),
      Feature('Applications: screen, approve, decline', Icons.how_to_reg_rounded, live: true),
      Feature('Leases, renewals, move-outs', Icons.assignment_rounded, live: true),
      Feature('Request queue with SLA breach first', Icons.timer_rounded, live: true),
      Feature('Announce to a building or everyone', Icons.campaign_rounded, live: true),
      Feature('Rent roll, arrears, payouts', Icons.account_balance_rounded, live: true),
    ],
  };

  /// Every setup has these, whatever its modules.
  static const List<Feature> common = [
    Feature('Email, magic link, Google, Facebook', Icons.login_rounded, live: true),
    Feature('Profile, addresses, settings', Icons.manage_accounts_rounded, live: true),
    Feature('Chat and messages', Icons.chat_rounded, live: true),
    Feature('Support with the business', Icons.support_agent_rounded, live: true),
    Feature('Wallet, saved cards, history', Icons.account_balance_wallet_rounded, live: true),
    Feature('Documents, templates, e-sign', Icons.draw_rounded),
  ];

  static List<Feature> forSetup(PortalSetup s, {required bool asProvider}) {
    final source = asProvider ? provider : customer;
    return [
      for (final m in s.modules)
        if (source[m] != null) ...source[m]!,
    ];
  }

  /// A short list for the directory card — the offering at a glance.
  static List<Feature> highlights(PortalSetup s) {
    final all = forSetup(s, asProvider: false);
    return all.take(3).toList();
  }
}
