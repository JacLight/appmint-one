import 'package:flutter/material.dart';

import 'haho_theme.dart';

/// Metadata for one app on the home screen. No navigation here — the dashboard
/// maps [id] to an onTap and a live count. Keeping this pure lets the System
/// settings screen list the same apps to toggle their visibility.
class AppDescriptor {
  final String id; // stable key used for persistence — never change it
  final String label;
  final IconData icon;
  final Color color;

  /// Whether this starts switched on for a brand-new install.
  ///
  /// Almost everything is **off**: the app covers far more ground than any one
  /// operator uses, and showing all of it at once is what made it hard to read.
  /// Comms and phone are the exception — they are what the app is for out of
  /// the box — and even those can be switched off.
  final bool defaultOn;

  /// Who this is for before anyone edits a role, mirroring `access` in the SDK
  /// catalogue (sdk/src/types/mobile-app-menu.ts). Tiers widen
  /// everyone → maker → manager → admin, and a role's `default` tier grants
  /// every item at or below it.
  final String access;

  const AppDescriptor(
    this.id,
    this.label,
    this.icon,
    this.color, {
    this.defaultOn = false,
    this.access = 'everyone',
  });
}

/// A home group (BusinessMade / CRM / Event / System) and its apps.
class HomeAppGroup {
  final String id; // stable key used for persistence
  final String title;
  final List<AppDescriptor> items;

  /// Whether the whole section starts switched on. See [AppDescriptor.defaultOn].
  final bool defaultOn;

  /// One line saying what the section is for, shown on the settings screen so
  /// the choice is not a guess.
  final String? blurb;

  const HomeAppGroup(
    this.id,
    this.title,
    this.items, {
    this.defaultOn = false,
    this.blurb,
  });
}

/// The single source of truth for the home app grouping. The dashboard renders
/// it (filtered by [AppVisibilityProvider]) and the settings screen toggles it.
const List<HomeAppGroup> kHomeAppGroups = [
  // The only section that starts on. Everything below it is opt-in.
  HomeAppGroup(
    'comms',
    'Comms & phone',
    [
      AppDescriptor(
        'phone',
        'Phone',
        Icons.phone,
        HaHoColors.primary,
        defaultOn: true,
      ),
      AppDescriptor(
        'live_chat',
        'Live Chat',
        Icons.bolt,
        HaHoColors.primary,
        defaultOn: true,
      ),
      AppDescriptor(
        'sms',
        'SMS',
        Icons.sms_outlined,
        HaHoColors.accent,
        defaultOn: true,
      ),
      AppDescriptor(
        'inbox',
        'Inbox',
        Icons.inbox_outlined,
        HaHoColors.accent,
        defaultOn: true,
      ),
    ],
    defaultOn: true,
    blurb:
        'Calls, chat, SMS and the inbox. On by default — turn it off if this '
        'device is not used for talking to customers.',
  ),
  HomeAppGroup('businessmade', 'BusinessMade', [
    AppDescriptor(
      'pos',
      'POS',
      Icons.point_of_sale_outlined,
      HaHoColors.primary,
      access: 'maker',
    ),
    AppDescriptor(
      'tabs',
      'Tabs',
      Icons.receipt_long_outlined,
      HaHoColors.primary,
      access: 'maker',
    ),
    AppDescriptor(
      'floor',
      'Floor',
      Icons.event_seat_outlined,
      HaHoColors.warning,
      access: 'maker',
    ),
    AppDescriptor(
      'reservations',
      'Reservations',
      Icons.event_available_outlined,
      HaHoColors.accent,
      access: 'maker',
    ),
    AppDescriptor(
      'checkin',
      'Check-in',
      Icons.how_to_reg_outlined,
      HaHoColors.accent,
      access: 'maker',
    ),
    AppDescriptor(
      'kitchen',
      'Prep',
      Icons.fact_check_outlined,
      HaHoColors.warning,
      access: 'maker',
    ),
    AppDescriptor(
      'take_payment',
      'Take payment',
      Icons.bolt,
      HaHoColors.accent,
      access: 'maker',
    ),
  ], blurb: 'Sales, service and production: POS, reservations and prep.'),
  HomeAppGroup('crm', 'CRM', [
    AppDescriptor(
      'pipelines',
      'Pipelines',
      Icons.account_tree_outlined,
      HaHoColors.success,
      access: 'maker',
    ),
    AppDescriptor(
      'tasks',
      'Tasks',
      Icons.task_outlined,
      HaHoColors.textGray,
      access: 'everyone',
    ),
    AppDescriptor(
      'contacts',
      'Contacts',
      Icons.contacts_outlined,
      HaHoColors.primary,
      access: 'maker',
    ),
    AppDescriptor(
      'leads',
      'Leads',
      Icons.people_outline,
      HaHoColors.accent,
      access: 'maker',
    ),
    AppDescriptor(
      'support',
      'Support',
      Icons.confirmation_number_outlined,
      HaHoColors.warning,
      access: 'maker',
    ),
  ], blurb: 'Pipelines, contacts, leads and support tickets.'),
  HomeAppGroup('event', 'Event', [
    AppDescriptor(
      'events',
      'Events',
      Icons.event_outlined,
      HaHoColors.success,
      access: 'maker',
    ),
    AppDescriptor(
      'scan',
      'Scan',
      Icons.qr_code_scanner,
      HaHoColors.cardDark,
      access: 'maker',
    ),
    AppDescriptor(
      'info',
      'Info',
      Icons.info_outline,
      HaHoColors.accent,
      access: 'maker',
    ),
    AppDescriptor(
      'stats',
      'Stats',
      Icons.dashboard_outlined,
      HaHoColors.primary,
      access: 'manager',
    ),
    AppDescriptor(
      'badge',
      'Badge',
      Icons.badge_outlined,
      HaHoColors.success,
      access: 'maker',
    ),
    AppDescriptor(
      'tickets',
      'Tickets',
      Icons.confirmation_number,
      HaHoColors.warning,
      access: 'maker',
    ),
    AppDescriptor(
      'schedule',
      'Schedule',
      Icons.calendar_today,
      HaHoColors.textGray,
      access: 'maker',
    ),
    AppDescriptor(
      'people',
      'People',
      Icons.people,
      HaHoColors.accent,
      access: 'maker',
    ),
    AppDescriptor(
      'manage',
      'Manage',
      Icons.settings,
      HaHoColors.cardDark,
      access: 'manager',
    ),
    AppDescriptor(
      'book',
      'Book',
      Icons.calendar_month_outlined,
      HaHoColors.cardDark,
      access: 'maker',
    ),
  ], blurb: 'Running an event: tickets, check-in, badges, schedule.'),
  HomeAppGroup('system', 'System', [
    AppDescriptor(
      'devices',
      'Devices',
      Icons.devices_other,
      HaHoColors.success,
      access: 'admin',
    ),
  ], blurb: 'Hardware paired with this phone.'),

  // Not on the home grid — these gate the More menu. Listed here so one screen
  // controls the whole app rather than two half-systems.
  HomeAppGroup('team', 'Workspaces & AI', [
    AppDescriptor(
      'workspaces',
      'Workspaces',
      Icons.workspaces_outline,
      HaHoColors.accent,
    ),
    AppDescriptor(
      'ai_employees',
      'AI employees',
      Icons.smart_toy_outlined,
      HaHoColors.accent,
      access: 'manager',
    ),
    AppDescriptor(
      'approvals',
      'Approvals',
      Icons.approval_outlined,
      HaHoColors.primary,
      access: 'manager',
    ),
  ], blurb: 'Shared workspaces, your AI employees, and approval requests.'),
];
