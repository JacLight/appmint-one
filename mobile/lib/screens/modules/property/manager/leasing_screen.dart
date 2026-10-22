import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';
import 'building_detail_screen.dart' show TenancyRow;

/// Leasing: who is coming in, who is due to renew, who has not paid.
class LeasingScreen extends StatefulWidget {
  const LeasingScreen({super.key});

  @override
  State<LeasingScreen> createState() => _LeasingScreenState();
}

class _LeasingScreenState extends State<LeasingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PropertyProvider>();
      if (p.leases.isEmpty && !p.leasingLoading) p.loadLeasing();
    });
  }

  /// Approve, screen or decline. A decline asks for the reason before it
  /// sends — the server refuses one without it, and the reason is what the
  /// applicant is owed and what gets produced if the decision is questioned.
  void _decide(BuildContext context, Map<String, dynamic> application) {
    final values = application['values'];
    final v = values is Map ? Map<String, dynamic>.from(values) : application;
    final who = '${v['fullName'] ?? v['name'] ?? v['email'] ?? 'Applicant'}';
    final id = '${application['sk'] ?? application['name'] ?? ''}';
    final p = context.read<PropertyProvider>();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (_) => _DecisionSheet(who: who, values: v, onDecide: (d, r) async {
        final err = await p.decide(id, d, reason: r);
        return err;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: p.loadLeasing,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Text(
                'Leasing',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                ),
              ),
            ),

            // Three numbers that decide a manager's week.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: Row(
                children: [
                  _Stat(
                    value: '${p.leases.length}',
                    label: 'Active ${words.lower(LexiconKeys.leases)}',
                  ),
                  const SizedBox(width: SSpace.sm),
                  _Stat(
                    value: '${p.expiring.length}',
                    label: 'Renew ≤60d',
                    colour: p.expiring.isEmpty ? null : SColors.amber,
                  ),
                  const SizedBox(width: SSpace.sm),
                  _Stat(
                    value: p.totalArrears <= 0
                        ? '0'
                        : p.totalArrears.toStringAsFixed(0),
                    label: 'In arrears',
                    colour: p.totalArrears <= 0 ? null : SColors.danger,
                  ),
                ],
              ),
            ),

            // ── Applications ───────────────────────────────────────────────
            const SectionHead(title: 'Applications'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: p.applicationError != null
                  ? ModuleError(
                      message: p.applicationError!, onRetry: p.loadLeasing)
                  : p.applications.isEmpty
                      ? const ModuleEmpty(
                          icon: Icons.how_to_reg_rounded,
                          title: 'No applications waiting',
                          body:
                              'An application sent from the app lands here to '
                              'screen, approve or decline.',
                        )
                      : Column(
                          children: [
                            for (final a in p.applications)
                              Padding(
                                padding:
                                    const EdgeInsets.only(bottom: SSpace.sm),
                                child: _ApplicationRow(
                                application: a,
                                onTap: () => _decide(context, a),
                              ),
                              ),
                          ],
                        ),
            ),

            // ── Renewals ───────────────────────────────────────────────────
            if (p.leasingLoading && p.leases.isEmpty)
              const ModuleLoading()
            else if (p.leaseError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child:
                    ModuleError(message: p.leaseError!, onRetry: p.loadLeasing),
              )
            else ...[
              if (p.expiring.isNotEmpty) ...[
                SectionHead(title: 'Up for renewal · ${p.expiring.length}'),
                for (final l in p.expiring)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, 0, SSpace.lg, SSpace.sm),
                    child: TenancyRow(tenancy: l),
                  ),
              ],
              if (p.arrears.isNotEmpty) ...[
                SectionHead(title: 'Behind on rent · ${p.arrears.length}'),
                for (final l in p.arrears)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, 0, SSpace.lg, SSpace.sm),
                    child: TenancyRow(tenancy: l),
                  ),
              ],
              SectionHead(
                  title: 'All ${words.lower(LexiconKeys.leases)} · ${p.leases.length}'),
              if (p.leases.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                  child: ModuleEmpty(
                    icon: Icons.assignment_rounded,
                    title: 'No ${words.lower(LexiconKeys.leases)} yet',
                    body:
                        'An approved application becomes a '
                        '${words.lower(LexiconKeys.lease)}, and every one of '
                        'them is listed here with its term and its balance.',
                  ),
                )
              else
                for (final l in p.leases)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, 0, SSpace.lg, SSpace.sm),
                    child: TenancyRow(tenancy: l),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final String value, label;
  final Color? colour;
  const _Stat({required this.value, required this.label, this.colour});

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: SSpace.md, vertical: SSpace.lg),
          decoration: BoxDecoration(
            color: SColors.card,
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(color: SColors.line),
          ),
          child: Column(
            children: [
              Text(value,
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: colour ?? SColors.ink)),
              const SizedBox(height: 2),
              Text(label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: const TextStyle(
                      color: SColors.muted, fontSize: 10.5, height: 1.2)),
            ],
          ),
        ),
      );
}

class _ApplicationRow extends StatelessWidget {
  final Map<String, dynamic> application;
  final VoidCallback? onTap;
  const _ApplicationRow({required this.application, this.onTap});

  @override
  Widget build(BuildContext context) {
    // A submission carries its answers under `values` (inline forms) or on the
    // record itself (collection-bound forms). Read either.
    final values = application['values'];
    final v = values is Map
        ? Map<String, dynamic>.from(values)
        : application;
    final who = '${v['fullName'] ?? v['name'] ?? v['email'] ?? 'Applicant'}';
    final wants = '${v['listingTitle'] ?? v['listing'] ?? ''}'.trim();
    final unit = '${v['unit'] ?? ''}'.trim();
    final income = v['monthlyIncome'];
    final status = '${application['status'] ?? 'new'}';

    return GestureDetector(
      onTap: onTap,
      child: Container(
      padding: const EdgeInsets.all(SSpace.md),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: SColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(who,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: SColors.ink)),
                const SizedBox(height: 2),
                Text(
                  [
                    if (wants.isNotEmpty) wants,
                    if (unit.isNotEmpty) unit,
                    if (income is num) 'earns ${income.round()}/mo',
                  ].join(' · '),
                  style: const TextStyle(color: SColors.muted, fontSize: 11.5),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: SSpace.sm + 2, vertical: 4),
            decoration: BoxDecoration(
              color: SColors.paper2,
              borderRadius: BorderRadius.circular(SRadius.pill),
            ),
            child: Text(status,
                style: const TextStyle(
                    color: SColors.ink2,
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      ),
    );
  }
}

/// The decision, with the application's own answers in front of the person
/// making it. Deciding from a name alone is how the wrong person gets a flat.
class _DecisionSheet extends StatefulWidget {
  final String who;
  final Map<String, dynamic> values;
  final Future<String?> Function(String decision, String reason) onDecide;
  const _DecisionSheet(
      {required this.who, required this.values, required this.onDecide});

  @override
  State<_DecisionSheet> createState() => _DecisionSheetState();
}

class _DecisionSheetState extends State<_DecisionSheet> {
  final _reason = TextEditingController();
  bool _declining = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _send(String decision) async {
    if (decision == 'declined' && _reason.text.trim().isEmpty) {
      setState(() => _declining = true);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await widget.onDecide(decision, _reason.text.trim());
    if (!mounted) return;
    if (err != null) {
      setState(() {
        _busy = false;
        _error = err;
      });
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final v = widget.values;
    final rows = <({String k, String v})>[
      if ('${v['email'] ?? ''}'.isNotEmpty) (k: 'Email', v: '${v['email']}'),
      if ('${v['phone'] ?? ''}'.isNotEmpty) (k: 'Phone', v: '${v['phone']}'),
      if ('${v['moveInDate'] ?? ''}'.isNotEmpty)
        (k: 'Move in', v: '${v['moveInDate']}'),
      if ('${v['listingTitle'] ?? v['listing'] ?? ''}'.isNotEmpty)
        (k: 'Wants', v: '${v['listingTitle'] ?? v['listing']}'),
      if ('${v['unit'] ?? ''}'.isNotEmpty) (k: 'Unit', v: '${v['unit']}'),
      if ('${v['employer'] ?? ''}'.isNotEmpty)
        (k: 'Employer', v: '${v['employer']}'),
      if (v['monthlyIncome'] != null)
        (k: 'Income', v: '${v['monthlyIncome']} /mo'),
      if (v['occupants'] != null) (k: 'People', v: '${v['occupants']}'),
      if (v['pets'] != null) (k: 'Pets', v: v['pets'] == true ? 'Yes' : 'No'),
      if ('${v['notes'] ?? ''}'.trim().isNotEmpty) (k: 'Notes', v: '${v['notes']}'),
    ];

    return Padding(
      padding: EdgeInsets.only(
        left: SSpace.lg,
        right: SSpace.lg,
        top: SSpace.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + SSpace.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.who,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                )),
            const SizedBox(height: SSpace.lg),
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) const Divider(height: SSpace.lg, color: SColors.line2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 96,
                    child: Text(rows[i].k,
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 12.5)),
                  ),
                  Expanded(
                    child: Text(rows[i].v,
                        style: const TextStyle(
                            color: SColors.ink,
                            fontWeight: FontWeight.w600,
                            fontSize: 13)),
                  ),
                ],
              ),
            ],
            if (_declining) ...[
              const SizedBox(height: SSpace.xl),
              const Text('Why it is a no',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink)),
              const SizedBox(height: SSpace.sm),
              TextField(
                controller: _reason,
                maxLines: 3,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(fontSize: 14, color: SColors.ink),
                decoration: InputDecoration(
                  hintText: 'Recorded with the decision',
                  hintStyle:
                      const TextStyle(color: SColors.faint, fontSize: 13),
                  filled: true,
                  fillColor: SColors.paper,
                  contentPadding: const EdgeInsets.all(SSpace.md),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(SRadius.md),
                    borderSide: const BorderSide(color: SColors.line),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(SRadius.md),
                    borderSide: BorderSide(color: brand.primary, width: 1.4),
                  ),
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: SSpace.lg),
              ModuleError(message: _error!),
            ],
            const SizedBox(height: SSpace.xl),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: SColors.danger,
                      side: BorderSide(
                          color: SColors.danger.withValues(alpha: 0.5)),
                      padding:
                          const EdgeInsets.symmetric(vertical: SSpace.md + 2),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(SRadius.pill)),
                    ),
                    onPressed: _busy ? null : () => _send('declined'),
                    child: Text(_declining ? 'Send decline' : 'Decline',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: brand.primary,
                      padding:
                          const EdgeInsets.symmetric(vertical: SSpace.md + 2),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(SRadius.pill)),
                    ),
                    onPressed: _busy ? null : () => _send('approved'),
                    child: _busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Text('Approve',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: SSpace.sm),
            Center(
              child: TextButton(
                onPressed: _busy ? null : () => _send('screening'),
                child: const Text('Move to screening',
                    style: TextStyle(color: SColors.muted, fontSize: 13)),
              ),
            ),
            const SizedBox(height: SSpace.sm),
            const Text(
              'Approving records the decision. Rent, term, deposit and which '
              'unit are still yours to set, so the lease is created as its own '
              'step.',
              style: TextStyle(
                  color: SColors.faint, fontSize: 11.5, height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}
