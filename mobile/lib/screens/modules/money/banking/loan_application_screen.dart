import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import 'banking_widgets.dart';
import 'loan_detail_screen.dart';

/// One loan application, as the applicant may read it.
///
/// The bank's side of the file never reaches this screen — the server leaves
/// out the officer, the ratios, the credit data beyond the notice and the
/// reason codes before it answers. What is left is what the applicant is owed:
/// where it stands, in the bank's own sentences; the decision and the Truth in
/// Lending figures behind it; the notice if it was declined; and what they
/// still have to do.
///
/// Every button here is switched on by the server's `actions` map, never by
/// this screen reading a status.
class LoanApplicationScreen extends StatefulWidget {
  final String applicationId;
  const LoanApplicationScreen({super.key, required this.applicationId});

  @override
  State<LoanApplicationScreen> createState() => _LoanApplicationScreenState();
}

class _LoanApplicationScreenState extends State<LoanApplicationScreen> {
  Map<String, dynamic> _application = const {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _application.isEmpty;
      _error = null;
    });
    try {
      final a = await context
          .read<BankingProvider>()
          .loanApplication(widget.applicationId);
      if (!mounted) return;
      setState(() {
        _application = a;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (_application.isEmpty) {
          _error = e.toString().replaceAll('Exception: ', '');
        }
      });
    }
  }

  Future<void> _answer(bool accept) async {
    final b = context.read<BankingProvider>();
    final failure =
        await b.answerCounteroffer(widget.applicationId, accept: accept);
    if (!mounted) return;
    if (failure != null) {
      setState(() => _error = failure);
      return;
    }
    await _load();
  }

  Future<void> _withdraw() async {
    final reason = await showDialog<String?>(
      context: context,
      builder: (_) => const _WithdrawDialog(),
    );
    // Dismissing the dialog is not a decision to withdraw.
    if (reason == null || !mounted) return;

    final b = context.read<BankingProvider>();
    final failure =
        await b.withdrawApplication(widget.applicationId, reason: reason);
    if (!mounted) return;
    if (failure != null) {
      setState(() => _error = failure);
      return;
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final a = _application;
    final status = '${a['status'] ?? ''}';
    final statusText = '${a['statusText'] ?? ''}'.trim();
    final actions = a['actions'];
    final canWithdraw = actions is Map && actions['withdraw'] == true;
    final counteroffer = a['counteroffer'];
    final needsAnswer =
        actions is Map && actions['answerCounteroffer'] == true;
    final product = a['product'];
    final loanId = '${a['loan'] ?? ''}'.trim();

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text(product is Map
            ? '${product['title'] ?? 'Application'}'
            : 'Application'),
      ),
      body: _loading
          ? const ModuleLoading()
          : _error != null && a.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(message: _error!, onRetry: _load),
                )
              : RefreshIndicator(
                  color: Theme.of(context).colorScheme.primary,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                        SSpace.lg, SSpace.lg, SSpace.lg, SSpace.xxl),
                    children: [
                      if ('${a['number'] ?? ''}'.isNotEmpty)
                        Text('${a['number']}',
                            style: const TextStyle(
                                fontSize: 11.5,
                                letterSpacing: 0.5,
                                color: SColors.faint)),
                      const SizedBox(height: SSpace.sm),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          StatusPill(look: applicationStatus(status)),
                          const SizedBox(width: SSpace.sm),
                          // The bank's sentence for where this stands, as sent.
                          Expanded(
                            child: Text(
                              statusText,
                              style: const TextStyle(
                                  fontSize: 14,
                                  height: 1.35,
                                  fontWeight: FontWeight.w600,
                                  color: SColors.ink),
                            ),
                          ),
                        ],
                      ),

                      if (_error != null) ...[
                        const SizedBox(height: SSpace.md),
                        ModuleError(message: _error!),
                      ],

                      // What is still missing, when the bank closed it for
                      // that reason. Its words, not a rewrite.
                      if ('${a['missingInformation'] ?? ''}'.isNotEmpty)
                        _Block(
                          tone: SColors.danger,
                          background: const Color(0xFFFBEBEB),
                          title: 'What was missing',
                          body: '${a['missingInformation']}',
                        ),

                      if (needsAnswer)
                        _Counteroffer(
                          decision: a['decision'],
                          busy: b.busy,
                          onAccept: () => _answer(true),
                          onDecline: () => _answer(false),
                        ),

                      _Requested(application: a),
                      _Decision(decision: a['decision']),
                      _Conditions(conditions: a['conditions']),
                      _AdverseAction(notice: a['adverseAction']),
                      _AboutMe(application: a),

                      if (counteroffer is Map &&
                          counteroffer['pending'] != true &&
                          ('${counteroffer['acceptedAt'] ?? ''}'.isNotEmpty ||
                              '${counteroffer['declinedAt'] ?? ''}'
                                  .isNotEmpty))
                        _Block(
                          tone: SColors.muted,
                          background: SColors.paper2,
                          title: 'The bank’s revised offer',
                          body: '${counteroffer['acceptedAt'] ?? ''}'.isNotEmpty
                              ? 'You accepted it on ${counteroffer['acceptedAt']}.'
                              : 'You declined it on ${counteroffer['declinedAt']}.',
                        ),

                      if (loanId.isNotEmpty) ...[
                        const SizedBox(height: SSpace.xl),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: () {
                              context
                                  .read<BankingProvider>()
                                  .openLoanView(loanId);
                              Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) =>
                                      LoanDetailScreen(loanId: loanId)));
                            },
                            icon: const Icon(Icons.open_in_new_rounded,
                                size: 18),
                            label: const Text('Open the loan'),
                          ),
                        ),
                      ],

                      if (canWithdraw) ...[
                        const SizedBox(height: SSpace.md),
                        Center(
                          child: TextButton(
                            onPressed: b.busy ? null : _withdraw,
                            style: TextButton.styleFrom(
                                foregroundColor: SColors.danger),
                            child: const Text('Withdraw this application'),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}

/// The offer waiting on an answer, with both answers side by side. Accepting
/// is not made the louder of the two: the terms changed, and which answer is
/// right is the applicant's to decide.
class _Counteroffer extends StatelessWidget {
  final dynamic decision;
  final bool busy;
  final VoidCallback onAccept, onDecline;

  const _Counteroffer({
    required this.decision,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final d = decision is Map ? Map<String, dynamic>.from(decision) : null;
    final approved = d?['approved'];
    final offer = approved is Map ? Map<String, dynamic>.from(approved) : null;

    return Container(
      margin: const EdgeInsets.only(top: SSpace.lg),
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.claySoft,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.clay),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('The terms we can offer',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: SColors.clay2)),
          if (offer != null) ...[
            const SizedBox(height: SSpace.sm),
            FactRow(
                label: 'Amount',
                value: Money.format(offer['amount']),
                strong: true),
            if (offer['termMonths'] != null)
              FactRow(label: 'Term', value: '${offer['termMonths']} months'),
            if (offer['rateBps'] != null)
              FactRow(label: 'Rate', value: Rate.format(offer['rateBps'])),
          ],
          const SizedBox(height: SSpace.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onDecline,
                  style: OutlinedButton.styleFrom(
                      foregroundColor: SColors.ink2,
                      side: const BorderSide(color: SColors.line)),
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onAccept,
                  child: const Text('Accept'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Requested extends StatelessWidget {
  final Map<String, dynamic> application;
  const _Requested({required this.application});

  @override
  Widget build(BuildContext context) {
    final raw = application['request'];
    if (raw is! Map) return const SizedBox.shrink();
    final r = Map<String, dynamic>.from(raw);
    final linked = application['linkedAccount'];
    final submitted = '${application['submittedAt'] ?? ''}'.trim();

    return _Section(
      title: 'What you asked for',
      children: [
        if (r['amount'] != null)
          FactRow(
              label: 'Amount', value: Money.format(r['amount']), strong: true),
        if (r['termMonths'] != null)
          FactRow(label: 'Term', value: '${r['termMonths']} months'),
        if ('${r['purpose'] ?? ''}'.isNotEmpty)
          FactRow(label: 'Purpose', value: '${r['purpose']}'),
        if (linked is Map && '${linked['label'] ?? ''}'.isNotEmpty)
          FactRow(label: 'Pays into', value: '${linked['label']}'),
        if (submitted.isNotEmpty)
          FactRow(label: 'Sent to the bank', value: submitted),
      ],
    );
  }
}

/// The decision, and the Truth in Lending figures that must accompany it.
class _Decision extends StatelessWidget {
  final dynamic decision;
  const _Decision({required this.decision});

  @override
  Widget build(BuildContext context) {
    if (decision is! Map) return const SizedBox.shrink();
    final d = Map<String, dynamic>.from(decision as Map);
    final approved = d['approved'];
    final tila = d['truthInLending'];
    final schedule = d['schedule'];

    return Column(
      children: [
        _Section(
          title: 'The decision',
          children: [
            FactRow(
                label: 'Outcome',
                value: '${d['outcome'] ?? ''}'.replaceAll('_', ' '),
                strong: true),
            if ('${d['decidedAt'] ?? ''}'.isNotEmpty)
              FactRow(label: 'Decided', value: '${d['decidedAt']}'),
            if (approved is Map) ...[
              FactRow(
                  label: 'Approved amount',
                  value: Money.format(approved['amount'])),
              if (approved['termMonths'] != null)
                FactRow(
                    label: 'Term', value: '${approved['termMonths']} months'),
              if (approved['rateBps'] != null)
                FactRow(
                    label: 'Rate', value: Rate.format(approved['rateBps'])),
            ],
          ],
        ),
        if (tila is Map)
          _Section(
            title: 'Truth in Lending',
            note: 'The cost of this credit, stated the way the law requires.',
            children: [
              if (tila['aprBps'] != null)
                FactRow(
                    label: 'APR',
                    value: Rate.format(tila['aprBps']),
                    strong: true),
              if (tila['amountFinanced'] != null)
                FactRow(
                    label: 'Amount financed',
                    value: Money.format(tila['amountFinanced'])),
              if (tila['financeCharge'] != null)
                FactRow(
                    label: 'Finance charge',
                    value: Money.format(tila['financeCharge'])),
              if (tila['totalOfPayments'] != null)
                FactRow(
                    label: 'Total of payments',
                    value: Money.format(tila['totalOfPayments'])),
              if (tila['paymentAmount'] != null)
                FactRow(
                    label: 'Each payment',
                    value: Money.format(tila['paymentAmount'])),
              if (tila['paymentCount'] != null)
                FactRow(
                    label: 'Number of payments',
                    value: '${tila['paymentCount']}'),
              if ('${tila['firstPaymentDate'] ?? ''}'.isNotEmpty)
                FactRow(
                    label: 'First payment',
                    value: '${tila['firstPaymentDate']}'),
            ],
          ),
        if (schedule is Map)
          _Section(
            title: 'How it would be repaid',
            children: [
              if (schedule['paymentAmount'] != null)
                FactRow(
                    label: 'Payment',
                    value: Money.format(schedule['paymentAmount'])),
              if (schedule['paymentCount'] != null)
                FactRow(
                    label: 'Payments',
                    value: '${schedule['paymentCount']}'),
              if ('${schedule['frequency'] ?? ''}'.isNotEmpty)
                FactRow(
                    label: 'How often',
                    value: '${schedule['frequency']}'.replaceAll('_', ' ')),
              if ('${schedule['firstPaymentDate'] ?? ''}'.isNotEmpty)
                FactRow(
                    label: 'First payment',
                    value: '${schedule['firstPaymentDate']}'),
              if ('${schedule['maturityDate'] ?? ''}'.isNotEmpty)
                FactRow(
                    label: 'Paid off by',
                    value: '${schedule['maturityDate']}'),
              if ((schedule['originationFee'] as num? ?? 0) != 0)
                FactRow(
                    label: schedule['feeFinanced'] == true
                        ? 'Origination fee (added to the loan)'
                        : 'Origination fee',
                    value: Money.format(schedule['originationFee'])),
            ],
          ),
      ],
    );
  }
}

/// What the bank still needs before it can go ahead. Each line is the bank's
/// own text with its own status word.
class _Conditions extends StatelessWidget {
  final dynamic conditions;
  const _Conditions({required this.conditions});

  @override
  Widget build(BuildContext context) {
    if (conditions is! List || (conditions as List).isEmpty) {
      return const SizedBox.shrink();
    }
    final rows = [
      for (final c in conditions as List)
        if (c is Map) Map<String, dynamic>.from(c),
    ];

    return _Section(
      title: 'Before we can go ahead',
      children: [
        for (final c in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: SSpace.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  '${c['status']}' == 'open'
                      ? Icons.radio_button_unchecked_rounded
                      : Icons.check_circle_rounded,
                  size: 16,
                  color: '${c['status']}' == 'open'
                      ? SColors.amber
                      : SColors.green,
                ),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${c['text'] ?? ''}',
                          style: const TextStyle(
                              fontSize: 13,
                              height: 1.35,
                              color: SColors.ink)),
                      Text('${c['statusText'] ?? ''}',
                          style: const TextStyle(
                              fontSize: 11.5, color: SColors.muted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The adverse-action notice. Before it is sent, the server says only when it
/// will be — and that promise is shown, because a declined applicant has a
/// legal right to the reasons and should know they are coming.
class _AdverseAction extends StatelessWidget {
  final dynamic notice;
  const _AdverseAction({required this.notice});

  @override
  Widget build(BuildContext context) {
    if (notice is! Map) return const SizedBox.shrink();
    final n = Map<String, dynamic>.from(notice as Map);
    final sent = '${n['sentAt'] ?? ''}'.trim();
    final body = '${n['notice'] ?? n['text'] ?? ''}'.trim();
    if (body.isEmpty && sent.isEmpty) return const SizedBox.shrink();

    return _Block(
      tone: SColors.ink2,
      background: SColors.paper2,
      title: sent.isEmpty ? 'Our notice is on its way' : 'Why we decided this',
      body: body.isEmpty ? 'Sent $sent.' : body,
      footer: sent.isEmpty ? null : 'Sent $sent',
    );
  }
}

/// What the applicant told the bank about themselves, so they can check it is
/// what they meant to say.
class _AboutMe extends StatelessWidget {
  final Map<String, dynamic> application;
  const _AboutMe({required this.application});

  @override
  Widget build(BuildContext context) {
    final raw = application['mine'];
    if (raw is! Map) return const SizedBox.shrink();
    final m = Map<String, dynamic>.from(raw);
    final income = m['income'];
    final employment = m['employment'];

    final rows = <Widget>[
      if (income is Map && income['grossMonthly'] != null)
        FactRow(
            label: 'Income a month',
            value: Money.format(income['grossMonthly'])),
      if (income is Map && '${income['source'] ?? ''}'.isNotEmpty)
        FactRow(label: 'Income from', value: '${income['source']}'),
      if (employment is Map && '${employment['employer'] ?? ''}'.isNotEmpty)
        FactRow(label: 'Employer', value: '${employment['employer']}'),
      if (employment is Map && '${employment['title'] ?? ''}'.isNotEmpty)
        FactRow(label: 'Job title', value: '${employment['title']}'),
      if (employment is Map && '${employment['since'] ?? ''}'.isNotEmpty)
        FactRow(label: 'Since', value: '${employment['since']}'),
      if (m['housingPayment'] != null)
        FactRow(
            label: 'Rent or mortgage',
            value: Money.format(m['housingPayment'])),
      if ('${m['consentToCreditCheckAt'] ?? ''}'.isNotEmpty)
        FactRow(
            label: 'Credit check agreed',
            value: '${m['consentToCreditCheckAt']}'),
    ];

    return _Section(title: 'What you told us', children: rows);
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String? note;
  final List<Widget> children;
  const _Section({required this.title, required this.children, this.note});

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: SSpace.lg),
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink)),
          if (note != null) ...[
            const SizedBox(height: 2),
            Text(note!,
                style: const TextStyle(
                    fontSize: 11.5, height: 1.3, color: SColors.muted)),
          ],
          const SizedBox(height: SSpace.sm),
          ...children,
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  final Color tone, background;
  final String title, body;
  final String? footer;
  const _Block({
    required this.tone,
    required this.background,
    required this.title,
    required this.body,
    this.footer,
  });

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(top: SSpace.lg),
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(SRadius.xl),
          border: Border.all(color: tone.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w800, color: tone)),
            const SizedBox(height: SSpace.xs),
            Text(body,
                style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: tone.withValues(alpha: 0.9))),
            if (footer != null) ...[
              const SizedBox(height: SSpace.sm),
              Text(footer!,
                  style: TextStyle(
                      fontSize: 11, color: tone.withValues(alpha: 0.7))),
            ],
          ],
        ),
      );
}

/// Withdrawing is permanent, so it is confirmed rather than done on one tap.
/// The reason is optional — the server treats it that way, and demanding one
/// to let somebody leave would be a toll.
class _WithdrawDialog extends StatefulWidget {
  const _WithdrawDialog();

  @override
  State<_WithdrawDialog> createState() => _WithdrawDialogState();
}

class _WithdrawDialogState extends State<_WithdrawDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Withdraw this application?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'The bank stops work on it. You would have to apply again to '
              'pick it back up.',
              style: TextStyle(color: SColors.muted, height: 1.4),
            ),
            const SizedBox(height: SSpace.lg),
            TextField(
              controller: _reason,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Keep it'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(_reason.text.trim()),
            style: FilledButton.styleFrom(backgroundColor: SColors.danger),
            child: const Text('Withdraw'),
          ),
        ],
      );
}
