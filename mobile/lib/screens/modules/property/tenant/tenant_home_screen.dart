import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/sla_policy.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/tenancy_provider.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import '../showcase/property_browse_screen.dart';
import 'new_request_screen.dart';
import 'request_detail_screen.dart';

/// Where a resident lands: my home, what I owe, what I have asked for, what
/// the building has told me.
class TenantHomeScreen extends StatefulWidget {
  const TenantHomeScreen({super.key});

  @override
  State<TenantHomeScreen> createState() => _TenantHomeScreenState();
}

class _TenantHomeScreenState extends State<TenantHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final t = context.read<TenancyProvider>();
      if (t.tenancies.isEmpty && !t.loading) t.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<TenancyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final user = context.watch<AuthProvider>().user;
    final home = t.current;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: t.load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            _Greeting(name: user?.displayName ?? ''),
            if (t.loading && t.tenancies.isEmpty && t.requests.isEmpty)
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleLoading(),
              )
            else if (t.error != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(message: t.error!, onRetry: t.load),
              )
            else if (home == null)
              _NotAResidentYet(applications: t.applications)
            else ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: _HomeCard(tenancy: home),
              ),
              const SizedBox(height: SSpace.lg),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: _RentCard(tenancy: home),
              ),
            ],
            const SizedBox(height: SSpace.xl),
            _Actions(onRepair: () {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => NewRequestScreen(tenancy: home),
              ));
            }),
            if (t.partialError('requests') != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    SSpace.lg, SSpace.lg, SSpace.lg, 0),
                child: ModuleError(
                    message: t.partialError('requests')!, onRetry: t.load),
              )
            else if (t.openRequests.isNotEmpty) ...[
              SectionHead(
                  title: 'Open ${words.lower(LexiconKeys.requests)}',
                  action: t.requests.length > 3 ? 'See all' : null),
              for (final r in t.openRequests.take(3))
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.md),
                  child: RequestRow(
                    request: r,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => RequestDetailScreen(request: r),
                    )),
                  ),
                ),
            ],
            if (t.notices.isNotEmpty) ...[
              const SectionHead(title: 'From the office'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: _NoticePeek(notice: t.notices.first),
              ),
            ],
            const SizedBox(height: SSpace.xxl),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  final String name;
  const _Greeting({required this.name});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final hour = DateTime.now().hour;
    final part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
          SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(brand.name.toUpperCase(),
                    style: const TextStyle(
                        color: SColors.faint,
                        fontSize: 10.5,
                        letterSpacing: 2,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: SSpace.xs + 2),
                Text(
                  name.isEmpty ? part : '$part, ${name.split(' ').first}',
                  style: TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: brand.displayFont,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Which home this is, and how far through the term.
class _HomeCard extends StatelessWidget {
  final Map<String, dynamic> tenancy;
  const _HomeCard({required this.tenancy});

  static DateTime? _d(dynamic v) => DateTime.tryParse('${v ?? ''}');

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    // A booking's items carry the unit and the window; the order carries the
    // customer. Both shapes appear depending on the read, so take either.
    final items = tenancy['items'];
    final first = items is List && items.isNotEmpty && items.first is Map
        ? Map<String, dynamic>.from(items.first)
        : <String, dynamic>{};

    final unit = '${first['unitNumber'] ?? first['unit'] ?? tenancy['unit'] ?? ''}'.trim();
    final place = '${first['listingTitle'] ?? first['listing'] ?? tenancy['listingTitle'] ?? tenancy['listing'] ?? ''}'.trim();
    final start = _d(first['startDate'] ?? tenancy['startDate'] ?? tenancy['start']);
    final end = _d(first['endDate'] ?? tenancy['endDate'] ?? tenancy['end']);

    double? progress;
    if (start != null && end != null && end.isAfter(start)) {
      final span = end.difference(start).inMinutes;
      final gone = DateTime.now().difference(start).inMinutes;
      progress = (gone / span).clamp(0.0, 1.0);
    }

    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [brand.primary, Color.lerp(brand.primary, Colors.black, 0.25)!],
        ),
        borderRadius: BorderRadius.circular(SRadius.xl),
        boxShadow: SShadow.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.home_rounded, size: 17, color: brand.accent),
              const SizedBox(width: SSpace.sm),
              Text('MY ${words.term(LexiconKeys.unit).toUpperCase()}',
                  style: TextStyle(
                      color: brand.accent,
                      fontSize: 10.5,
                      letterSpacing: 1.6,
                      fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: SSpace.md),
          Text(
            unit.isEmpty ? (place.isEmpty ? 'Your home' : place) : unit,
            style: const TextStyle(
                color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
          ),
          if (place.isNotEmpty && unit.isNotEmpty)
            Text(place,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75), fontSize: 13.5)),
          if (start != null || end != null) ...[
            const SizedBox(height: SSpace.lg),
            if (progress != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(SRadius.pill),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 5,
                  backgroundColor: Colors.white24,
                  valueColor: AlwaysStoppedAnimation(brand.accent),
                ),
              ),
            const SizedBox(height: SSpace.sm),
            Row(
              children: [
                Text(
                  start == null ? '' : '${words.term(LexiconKeys.lease)} from ${_fmt(start)}',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8), fontSize: 11.5),
                ),
                const Spacer(),
                if (end != null)
                  Text(
                    _until(end),
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.day} ${const [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][d.month - 1]} ${d.year}';

  static String _until(DateTime end) {
    final days = end.difference(DateTime.now()).inDays;
    if (days < 0) return 'Ended ${_fmt(end)}';
    if (days == 0) return 'Ends today';
    if (days < 62) return '$days days left';
    return 'Renews ${_fmt(end)}';
  }
}

/// What is owed. The number, then the one button.
class _RentCard extends StatelessWidget {
  final Map<String, dynamic> tenancy;
  const _RentCard({required this.tenancy});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final s = tenancy['paymentSummary'];
    final summary = s is Map ? Map<String, dynamic>.from(s) : const {};
    final balance = summary['balance'];
    final currency = '${summary['currency'] ?? tenancy['currency'] ?? 'USD'}';
    final status = '${summary['status'] ?? ''}';
    final owed = balance is num ? balance.toDouble() : null;

    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        boxShadow: SShadow.soft,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  owed == null
                      ? 'Balance'
                      : owed <= 0
                          ? 'Nothing due'
                          : 'Due now',
                  style: const TextStyle(color: SColors.muted, fontSize: 12.5),
                ),
                const SizedBox(height: 2),
                Text(
                  owed == null
                      ? 'Not shown yet'
                      : '${_sym(currency)}${owed.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: owed == null ? 17 : 26,
                    fontWeight: FontWeight.w800,
                    color: owed != null && owed > 0 ? SColors.ink : SColors.green,
                  ),
                ),
                if (status.isNotEmpty)
                  Text(
                    switch (status) {
                      'paid' => 'Paid in full',
                      'partial' => 'Part paid',
                      _ => 'Unpaid',
                    },
                    style: const TextStyle(color: SColors.muted, fontSize: 11.5),
                  ),
              ],
            ),
          ),
          if (owed != null && owed > 0)
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: brand.primary,
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.xl, vertical: SSpace.md),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              onPressed: () => DefaultTabController.maybeOf(context) == null
                  ? _goToPay(context)
                  : _goToPay(context),
              child: const Text('Pay rent',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
    );
  }

  static String _sym(String currency) => switch (currency.toUpperCase()) {
        'USD' => '\$',
        'GBP' => '£',
        'EUR' => '€',
        _ => '$currency ',
      };

  /// The Pay tab owns paying; the card's job is to get there. Two ways to
  /// start the same flow is how two flows end up diverging.
  void _goToPay(BuildContext context) {
    TenantShellScope.of(context)?.goToPay();
  }
}

/// Lets a card switch the shell's tab without knowing how the shell is built.
class TenantShellScope extends InheritedWidget {
  final VoidCallback goToPay;
  final VoidCallback goToRequests;
  final VoidCallback goToNotices;

  const TenantShellScope({
    super.key,
    required this.goToPay,
    required this.goToRequests,
    required this.goToNotices,
    required super.child,
  });

  static TenantShellScope? of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<TenantShellScope>();

  @override
  bool updateShouldNotify(TenantShellScope old) => false;
}

class _Actions extends StatelessWidget {
  final VoidCallback onRepair;
  const _Actions({required this.onRepair});

  @override
  Widget build(BuildContext context) {
    final words = CurrentSetup.words;
    final items = <({IconData icon, String label, VoidCallback tap})>[
      (
        icon: Icons.build_rounded,
        label: 'Report a repair',
        tap: onRepair,
      ),
      (
        icon: Icons.campaign_rounded,
        label: 'Notices',
        tap: () => TenantShellScope.of(context)?.goToNotices(),
      ),
      (
        icon: Icons.receipt_long_rounded,
        label: 'Statement',
        tap: () => TenantShellScope.of(context)?.goToPay(),
      ),
      (
        icon: Icons.list_alt_rounded,
        label: 'My ${words.lower(LexiconKeys.requests)}',
        tap: () => TenantShellScope.of(context)?.goToRequests(),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: SSpace.sm),
            Expanded(
              child: GestureDetector(
                onTap: items[i].tap,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md),
                  decoration: BoxDecoration(
                    color: SColors.card,
                    borderRadius: BorderRadius.circular(SRadius.md),
                    border: Border.all(color: SColors.line),
                  ),
                  child: Column(
                    children: [
                      Icon(items[i].icon,
                          size: 20, color: CurrentSetup.brand.primary),
                      const SizedBox(height: SSpace.sm),
                      Text(
                        items[i].label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: const TextStyle(
                            fontSize: 10.5,
                            height: 1.2,
                            color: SColors.ink2,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A resident who has not got a tenancy yet — a prospect, or somebody whose
/// application is still being read. Showing them an empty rent card would be
/// a dead end; this is the way forward.
class _NotAResidentYet extends StatelessWidget {
  final List<Map<String, dynamic>> applications;
  const _NotAResidentYet({required this.applications});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final pending = applications.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
      child: Container(
        padding: const EdgeInsets.all(SSpace.xl),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          boxShadow: SShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(pending ? Icons.hourglass_top_rounded : Icons.search_rounded,
                color: brand.accent, size: 26),
            const SizedBox(height: SSpace.md),
            Text(
              pending ? 'Application in review' : 'No tenancy yet',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: SColors.ink,
                fontFamily: brand.displayFont,
              ),
            ),
            const SizedBox(height: SSpace.xs),
            Text(
              pending
                  ? 'The office has ${applications.length == 1 ? 'your application' : '${applications.length} applications'} from you. '
                      'When it is approved, your ${words.lower(LexiconKeys.lease)} and rent appear here.'
                  : 'Once you move in, rent, repairs and building notices all live on this screen.',
              style: const TextStyle(
                  color: SColors.muted, height: 1.45, fontSize: 13.5),
            ),
            const SizedBox(height: SSpace.lg),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: brand.primary,
                side: BorderSide(color: brand.primary),
                padding: const EdgeInsets.symmetric(
                    horizontal: SSpace.lg, vertical: SSpace.md),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const PropertyBrowseScreen(),
              )),
              icon: const Icon(Icons.apartment_rounded, size: 18),
              label: Text('See what is available',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

/// A request as a row, with its clock. Shared by the resident's list and the
/// manager's queue so the two sides read the same thing.
class RequestRow extends StatelessWidget {
  final Map<String, dynamic> request;
  final VoidCallback? onTap;
  final bool showWho;
  const RequestRow(
      {super.key, required this.request, this.onTap, this.showWho = false});

  @override
  Widget build(BuildContext context) {
    final clock = SlaClock.of(request);
    final title = '${request['title'] ?? 'Request'}';
    final where = '${request['unit'] ?? ''}'.trim();
    final who = '${request['reportedBy'] ?? ''}'.trim();
    final status = '${request['status'] ?? ''}';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: clock.breached && !clock.finished
                  ? SColors.danger.withValues(alpha: 0.35)
                  : SColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: SColors.paper2,
                borderRadius: BorderRadius.circular(SRadius.sm),
              ),
              child: Icon(_icon(title), size: 18, color: SColors.ink2),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: SColors.ink)),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        [
                          if (showWho && who.isNotEmpty) who,
                          if (where.isNotEmpty) where,
                          _statusWord(status),
                        ].join(' · '),
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 11.5),
                      ),
                    ],
                  ),
                  const SizedBox(height: SSpace.sm),
                  SlaChip(clock: clock, dense: true),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: SColors.faint),
          ],
        ),
      ),
    );
  }

  static String _statusWord(String status) => switch (status.toLowerCase()) {
        'new' => 'Not picked up',
        'open' => 'Open',
        'pending' => 'Waiting',
        'inprogress' => 'In progress',
        'blocked' => 'Blocked',
        'done' => 'Done',
        'canceled' => 'Cancelled',
        _ => status.isEmpty ? 'Open' : status,
      };

  /// The category is in the words the resident used, so the icon is read off
  /// them. Wrong icon, right words beats an icon that means nothing.
  static IconData _icon(String title) {
    final t = title.toLowerCase();
    if (t.contains('leak') || t.contains('water') || t.contains('plumb')) {
      return Icons.water_damage_rounded;
    }
    if (t.contains('heat') || t.contains('boiler') || t.contains('ac') ||
        t.contains('cool')) {
      return Icons.thermostat_rounded;
    }
    if (t.contains('light') || t.contains('power') || t.contains('electr')) {
      return Icons.electrical_services_rounded;
    }
    if (t.contains('door') || t.contains('lock') || t.contains('key')) {
      return Icons.lock_rounded;
    }
    if (t.contains('pest') || t.contains('roach') || t.contains('mice')) {
      return Icons.pest_control_rounded;
    }
    if (t.contains('appliance') || t.contains('fridge') || t.contains('oven')) {
      return Icons.kitchen_rounded;
    }
    return Icons.build_rounded;
  }
}

class _NoticePeek extends StatelessWidget {
  final Map<String, dynamic> notice;
  const _NoticePeek({required this.notice});

  @override
  Widget build(BuildContext context) {
    final title = '${notice['title'] ?? 'Notice'}';
    final body = '${notice['bodyText'] ?? notice['summary'] ?? ''}'.trim();

    return GestureDetector(
      onTap: () => TenantShellScope.of(context)?.goToNotices(),
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: CurrentSetup.brand.accent.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: CurrentSetup.brand.accent.withValues(alpha: 0.35)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.campaign_rounded,
                size: 18, color: CurrentSetup.brand.accent),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: SColors.ink)),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(body,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 12.5, height: 1.35)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
