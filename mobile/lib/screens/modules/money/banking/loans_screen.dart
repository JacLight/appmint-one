import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../property/property_widgets.dart' show SectionHead;
import '../../shared/module_states.dart';
import 'banking_widgets.dart';
import 'loan_apply_screen.dart';
import 'loan_application_screen.dart';
import 'loan_detail_screen.dart';

/// Borrowing: what I owe, what I have applied for, and what I could apply for.
///
/// Two things jump the queue to the top of this screen, because both are
/// time-bound and neither should need hunting for: a loan that is behind, and
/// an offer from the bank that is waiting on an answer.
class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key});

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final b = context.read<BankingProvider>();
      if (b.loans.isEmpty && !b.loansLoading) b.loadLoans();
    });
  }

  void _openLoan(Map<String, dynamic> loan) {
    final id = BankingProvider.idOf(loan);
    if (id.isEmpty) return;
    context.read<BankingProvider>().openLoanView(id, known: loan);
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => LoanDetailScreen(loanId: id)));
  }

  void _openApplication(Map<String, dynamic> application) {
    final id = BankingProvider.idOf(application);
    if (id.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LoanApplicationScreen(applicationId: id),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final owed = b.totalOwed;
    final pending = b.counteroffersPending;
    final late = b.pastDueLoans;

    // Applications that have become loans are represented by the loan; showing
    // both would double-count the same borrowing on one screen.
    final applications = [
      for (final a in b.applications)
        if ('${a['status'] ?? ''}' != 'booked') a,
    ];

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: b.loadLoans,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SSpace.lg,
                SSpace.xxl + SSpace.sm,
                SSpace.lg,
                SSpace.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BORROWING',
                    style: TextStyle(
                      color: SColors.faint,
                      fontSize: 10.5,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SSpace.sm),
                  // Nothing owed and no loans is not the same as a figure the
                  // app never received, so the two read differently.
                  Text(
                    owed == null
                        ? (b.loans.isEmpty ? 'No loans' : 'Balance unavailable')
                        : Money.format(owed, currency: b.currency),
                    style: TextStyle(
                      fontSize: owed == null ? 22 : 38,
                      height: 1.05,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink,
                      fontFamily: brand.displayFont,
                    ),
                  ),
                  if (owed != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      b.loans.length == 1
                          ? 'Owed on 1 loan'
                          : 'Owed across ${b.loans.length} loans',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: SColors.muted,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            if (late.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: _Callout(
                  icon: Icons.warning_amber_rounded,
                  tone: SColors.danger,
                  background: const Color(0xFFFBEBEB),
                  title: late.length == 1
                      ? 'A loan is past due'
                      : '${late.length} loans are past due',
                  body:
                      'Paying brings it current. A payment comes out of one '
                      'of your own accounts.',
                  action: 'Open',
                  onAction: () => _openLoan(late.first),
                ),
              ),

            if (pending.isNotEmpty)
              Padding(
                padding: EdgeInsets.fromLTRB(
                  SSpace.lg,
                  late.isEmpty ? 0 : SSpace.sm,
                  SSpace.lg,
                  0,
                ),
                child: _Callout(
                  icon: Icons.mark_email_unread_outlined,
                  tone: SColors.clay2,
                  background: SColors.claySoft,
                  title: pending.length == 1
                      ? 'The bank has offered different terms'
                      : '${pending.length} offers are waiting on you',
                  body: 'Read what changed, then accept or decline.',
                  action: 'Read',
                  onAction: () => _openApplication(pending.first),
                ),
              ),

            if (b.loansError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                  message: b.loansError!,
                  onRetry: b.loadLoans,
                ),
              ),

            for (final section in ['applications', 'loanProducts'])
              if (b.sectionError(section) != null)
                Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(
                    message: '$section: ${b.sectionError(section)}',
                    onRetry: b.loadLoans,
                  ),
                ),
            if (b.loansLoading && b.loans.isEmpty) const ModuleLoading(),

            if (b.loans.isNotEmpty) ...[
              const SectionHead(title: 'My loans'),
              for (final loan in b.loans)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    SSpace.lg,
                    0,
                    SSpace.lg,
                    SSpace.md,
                  ),
                  child: LoanCard(loan: loan, onTap: () => _openLoan(loan)),
                ),
            ],

            if (applications.isNotEmpty) ...[
              const SectionHead(title: 'Applications'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Column(
                  children: [
                    for (final a in applications)
                      ApplicationRow(
                        application: a,
                        onTap: () => _openApplication(a),
                      ),
                  ],
                ),
              ),
            ],

            if (!b.loansLoading &&
                b.loansError == null &&
                b.sectionError('applications') == null &&
                b.loans.isEmpty &&
                applications.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: SSpace.xl),
                child: ModuleEmpty(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'No borrowing yet',
                  body:
                      'When you apply for a loan it appears here, with where '
                      'it stands and what you owe.',
                ),
              ),

            Padding(
              padding: const EdgeInsets.fromLTRB(
                SSpace.lg,
                SSpace.xl,
                SSpace.lg,
                0,
              ),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoanApplyScreen()),
                  ),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: Text(
                    b.loans.isEmpty ? 'Apply for a loan' : 'Apply for another',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A short, coloured call to action at the top of the screen.
class _Callout extends StatelessWidget {
  final IconData icon;
  final Color tone, background;
  final String title, body, action;
  final VoidCallback onAction;

  const _Callout({
    required this.icon,
    required this.tone,
    required this.background,
    required this.title,
    required this.body,
    required this.action,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(SSpace.md),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(SRadius.md),
      border: Border.all(color: tone.withValues(alpha: 0.5)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: tone),
        const SizedBox(width: SSpace.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13.5,
                  color: tone,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                body,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.35,
                  color: tone.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(
            foregroundColor: tone,
            padding: const EdgeInsets.symmetric(horizontal: SSpace.sm),
            minimumSize: const Size(0, 32),
          ),
          child: Text(
            action,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
          ),
        ),
      ],
    ),
  );
}
