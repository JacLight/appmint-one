import 'bank_autopay.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import 'banking_widgets.dart';

/// One loan, in full: what is owed and how it splits, the terms it was written
/// on, what closing it today would cost, the schedule, and every payment with
/// how the bank applied it.
///
/// Whether a payment can be made is the server's call — it sends
/// `actions.pay` — so this screen never works it out from a status.
class LoanDetailScreen extends StatelessWidget {
  final String loanId;
  const LoanDetailScreen({super.key, required this.loanId});

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final loan = b.loan;
    final brand = CurrentSetup.brand;

    final status = '${loan['status'] ?? ''}';
    final statusText = '${loan['statusText'] ?? ''}'.trim();
    final actions = loan['actions'];
    final canPay = actions is Map && actions['pay'] == true;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text('${loan['product'] ?? 'Loan'}'),
      ),
      body: b.loanLoading && loan.isEmpty
          ? const ModuleLoading()
          : b.loanError != null && loan.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(SSpace.lg),
              child: ModuleError(message: b.loanError!, onRetry: b.refreshLoan),
            )
          : RefreshIndicator(
              color: brand.primary,
              onRefresh: b.refreshLoan,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  SSpace.lg,
                  0,
                  SSpace.lg,
                  SSpace.xxl,
                ),
                children: [
                  _Owed(loan: loan),
                  BankAutopayPanel(loanId: loanId, accounts: b.accounts),
                  if (statusText.isNotEmpty) ...[
                    const SizedBox(height: SSpace.md),
                    Row(
                      children: [
                        StatusPill(look: loanStatus(status)),
                        const SizedBox(width: SSpace.sm),
                        // The bank's sentence, unedited.
                        Expanded(
                          child: Text(
                            statusText,
                            style: const TextStyle(
                              fontSize: 12.5,
                              height: 1.3,
                              color: SColors.muted,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  _Breakdown(loan: loan),
                  _Payoff(payoff: b.payoff),
                  if (b.payoff.isNotEmpty)
                    TextButton.icon(
                      onPressed: () => shareBankPdf(
                        context,
                        b.payoffPdf(loanId),
                        'payoff-$loanId.pdf',
                      ),
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: const Text('Download payoff PDF'),
                    ),
                  _Terms(loan: loan),
                  _Scra(loan: loan),
                  _Schedule(loan: loan),
                  _Payments(loan: loan),
                  _LateFees(loan: loan),
                ],
              ),
            ),
      bottomNavigationBar: canPay
          ? SafeArea(
              minimum: const EdgeInsets.all(SSpace.lg),
              child: FilledButton(
                onPressed: () => _pay(context, loan),
                child: const Text('Make a payment'),
              ),
            )
          : null,
    );
  }

  void _pay(BuildContext context, Map<String, dynamic> loan) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.paper,
      builder: (_) => _PaySheet(loanId: loanId, loan: loan),
    );
  }
}

class _Owed extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Owed({required this.loan});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final owed = loan['owed'];
    final pastDue = loan['pastDue'];
    final dpd = loan['daysPastDue'];
    final late = dpd is num && dpd > 0;
    final number = '${loan['number'] ?? ''}'.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (number.isNotEmpty)
          Text(
            number,
            style: const TextStyle(
              fontSize: 11.5,
              letterSpacing: 0.5,
              color: SColors.faint,
            ),
          ),
        const SizedBox(height: SSpace.xs),
        Text(
          owed == null ? 'Balance unavailable' : Money.format(owed),
          style: TextStyle(
            fontSize: owed == null ? 20 : 34,
            height: 1.05,
            fontWeight: FontWeight.w800,
            color: late ? SColors.danger : SColors.ink,
            fontFamily: brand.displayFont,
          ),
        ),
        const Text(
          'Owed',
          style: TextStyle(fontSize: 12, color: SColors.muted),
        ),
        if (pastDue is num && pastDue > 0) ...[
          const SizedBox(height: SSpace.sm),
          Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
              color: const Color(0xFFFBEBEB),
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.danger, width: 0.8),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  size: 17,
                  color: SColors.danger,
                ),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: Text(
                    '${Money.format(pastDue)} past due'
                    '${late ? ' · $dpd ${dpd == 1 ? 'day' : 'days'}' : ''}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: SColors.danger,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// How the balance divides. Shown because a borrower paying off a loan is
/// entitled to know how much of it is interest and fees rather than principal.
class _Breakdown extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Breakdown({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['balances'];
    if (raw is! Map) return const SizedBox.shrink();
    final b = Map<String, dynamic>.from(raw);

    return _Card(
      title: 'What makes up the balance',
      children: [
        FactRow(label: 'Principal', value: Money.format(b['principal'])),
        FactRow(label: 'Interest', value: Money.format(b['interest'])),
        if ((b['fees'] as num? ?? 0) != 0)
          FactRow(label: 'Fees', value: Money.format(b['fees'])),
        if ((b['lateFees'] as num? ?? 0) != 0)
          FactRow(
            label: 'Late fees',
            value: Money.format(b['lateFees']),
            valueColor: SColors.danger,
          ),
        if ((b['unapplied'] as num? ?? 0) != 0)
          FactRow(
            label: 'Paid, not yet applied',
            value: Money.format(b['unapplied']),
            valueColor: SColors.green,
          ),
      ],
    );
  }
}

/// Today's payoff quote. Absent on a loan the server will not quote — one not
/// yet paid out has nothing to pay off, and that is better said by showing
/// nothing than by quoting a figure of zero.
class _Payoff extends StatelessWidget {
  final Map<String, dynamic> payoff;
  const _Payoff({required this.payoff});

  @override
  Widget build(BuildContext context) {
    if (payoff.isEmpty || payoff['amount'] == null) {
      return const SizedBox.shrink();
    }
    final goodThrough = '${payoff['goodThrough'] ?? ''}'.trim();
    final perDiem = payoff['perDiem'];

    return _Card(
      title: 'To pay it off',
      children: [
        FactRow(
          label: goodThrough.isEmpty
              ? 'Payoff today'
              : 'Good through $goodThrough',
          value: Money.format(payoff['amount']),
          strong: true,
        ),
        FactRow(label: 'Principal', value: Money.format(payoff['principal'])),
        FactRow(label: 'Interest', value: Money.format(payoff['interest'])),
        if ((payoff['fees'] as num? ?? 0) != 0)
          FactRow(label: 'Fees', value: Money.format(payoff['fees'])),
        if ((payoff['lateFees'] as num? ?? 0) != 0)
          FactRow(label: 'Late fees', value: Money.format(payoff['lateFees'])),
        if (perDiem != null)
          FactRow(
            label: 'Interest per day after that',
            value: Money.format(perDiem),
          ),
      ],
    );
  }
}

class _Terms extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Terms({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['terms'];
    if (raw is! Map) return const SizedBox.shrink();
    final t = Map<String, dynamic>.from(raw);

    final frequency = '${t['frequency'] ?? ''}'.replaceAll('_', ' ').trim();

    return _Card(
      title: 'Your terms',
      children: [
        FactRow(label: 'Amount borrowed', value: Money.format(t['principal'])),
        if (t['rateBps'] != null)
          FactRow(label: 'Interest rate', value: Rate.format(t['rateBps'])),
        if (t['aprBps'] != null)
          FactRow(label: 'APR', value: Rate.format(t['aprBps'])),
        if (t['termMonths'] != null)
          FactRow(label: 'Term', value: '${t['termMonths']} months'),
        if (t['paymentAmount'] != null)
          FactRow(
            label: frequency.isEmpty ? 'Payment' : 'Payment ($frequency)',
            value: Money.format(t['paymentAmount']),
          ),
        if ('${t['firstPaymentDate'] ?? ''}'.isNotEmpty)
          FactRow(label: 'First payment', value: '${t['firstPaymentDate']}'),
        if ('${t['maturityDate'] ?? ''}'.isNotEmpty)
          FactRow(label: 'Last payment', value: '${t['maturityDate']}'),
        if (t['graceDays'] != null)
          FactRow(label: 'Grace period', value: '${t['graceDays']} days'),
        if (t['lateFee'] != null)
          FactRow(label: 'Late fee', value: Money.format(t['lateFee'])),
        if ((t['originationFee'] as num? ?? 0) != 0)
          FactRow(
            label: 'Origination fee',
            value: Money.format(t['originationFee']),
          ),
      ],
    );
  }
}

/// The Servicemembers Civil Relief Act rate cap, when the bank has applied it.
/// Shown only when there is something to show: it is the borrower's benefit
/// and the credited interest is money back to them.
class _Scra extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Scra({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['scra'];
    if (raw is! Map) return const SizedBox.shrink();
    final s = Map<String, dynamic>.from(raw);
    if (s['applied'] != true) return const SizedBox.shrink();

    return _Card(
      title: 'Military rate cap applied',
      children: [
        if (s['rateBps'] != null)
          FactRow(label: 'Capped rate', value: Rate.format(s['rateBps'])),
        if ((s['creditedInterest'] as num? ?? 0) != 0)
          FactRow(
            label: 'Interest credited back',
            value: Money.format(s['creditedInterest']),
            valueColor: SColors.green,
          ),
        if ('${s['serviceStart'] ?? ''}'.isNotEmpty)
          FactRow(label: 'Service from', value: '${s['serviceStart']}'),
        if ('${s['serviceEnd'] ?? ''}'.isNotEmpty)
          FactRow(label: 'Service to', value: '${s['serviceEnd']}'),
      ],
    );
  }
}

class _Schedule extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Schedule({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['schedule'];
    if (raw is! List || raw.isEmpty) return const SizedBox.shrink();
    final rows = [
      for (final r in raw)
        if (r is Map) Map<String, dynamic>.from(r),
    ];

    // The next unpaid instalment is the one being asked about; the rest are
    // reference, so the list opens there rather than at instalment one.
    final nextIndex = rows.indexWhere((r) => '${r['status']}' != 'paid');

    return _Card(
      title: 'Payment schedule',
      initiallyExpanded: false,
      subtitle: '${rows.length} payments',
      children: [
        for (var i = 0; i < rows.length; i++)
          _ScheduleRow(row: rows[i], isNext: i == nextIndex),
      ],
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  final Map<String, dynamic> row;
  final bool isNext;
  const _ScheduleRow({required this.row, required this.isNext});

  @override
  Widget build(BuildContext context) {
    final status = '${row['status'] ?? ''}'.toLowerCase();
    final paid = status == 'paid';
    final lateFee = row['lateFee'];

    return Container(
      margin: const EdgeInsets.only(bottom: SSpace.xs),
      padding: const EdgeInsets.symmetric(
        horizontal: SSpace.sm,
        vertical: SSpace.sm,
      ),
      decoration: BoxDecoration(
        color: isNext ? SColors.paper2 : Colors.transparent,
        borderRadius: BorderRadius.circular(SRadius.sm),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 26,
            child: Text(
              '${row['number'] ?? ''}',
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: SColors.faint,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${row['dueDate'] ?? ''}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isNext ? FontWeight.w800 : FontWeight.w600,
                    color: paid ? SColors.muted : SColors.ink,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  [
                    'Principal ${Money.format(row['principal'])}',
                    'Interest ${Money.format(row['interest'])}',
                    if (lateFee is num && lateFee > 0)
                      'Late fee ${Money.format(lateFee)}',
                  ].join(' · '),
                  style: const TextStyle(fontSize: 10.5, color: SColors.faint),
                ),
              ],
            ),
          ),
          const SizedBox(width: SSpace.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                Money.format(row['payment']),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: paid ? SColors.muted : SColors.ink,
                ),
              ),
              Text(
                paid ? 'Paid' : (isNext ? 'Next' : 'Due'),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: paid ? SColors.green : SColors.faint,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Every payment, and how the bank split it. The split is the part a borrower
/// cannot work out for themselves, so it is shown rather than summarised.
class _Payments extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _Payments({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['payments'];
    if (raw is! List || raw.isEmpty) return const SizedBox.shrink();
    final rows = [
      for (final r in raw)
        if (r is Map) Map<String, dynamic>.from(r),
    ];

    return _Card(
      title: 'Payments',
      subtitle: '${rows.length} made',
      initiallyExpanded: false,
      children: [for (final p in rows) _PaymentRow(payment: p)],
    );
  }
}

class _PaymentRow extends StatelessWidget {
  final Map<String, dynamic> payment;
  const _PaymentRow({required this.payment});

  @override
  Widget build(BuildContext context) {
    final allocation = payment['allocation'];
    final a = allocation is Map ? Map<String, dynamic>.from(allocation) : null;
    final reversed = '${payment['reverses'] ?? ''}'.isNotEmpty;
    final status = '${payment['status'] ?? ''}'.toLowerCase();

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${payment['effectiveDate'] ?? payment['postedAt'] ?? ''}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: SColors.ink,
                  ),
                ),
              ),
              Text(
                Money.format(payment['amount']),
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: reversed ? SColors.faint : SColors.green,
                  decoration: reversed ? TextDecoration.lineThrough : null,
                ),
              ),
            ],
          ),
          if (a != null) ...[
            const SizedBox(height: 1),
            Text(
              [
                'Principal ${Money.format(a['principal'])}',
                'Interest ${Money.format(a['interest'])}',
                if ((a['fees'] as num? ?? 0) != 0)
                  'Fees ${Money.format(a['fees'])}',
                if ((a['lateFees'] as num? ?? 0) != 0)
                  'Late fees ${Money.format(a['lateFees'])}',
                if ((a['unapplied'] as num? ?? 0) != 0)
                  'Held ${Money.format(a['unapplied'])}',
              ].join(' · '),
              style: const TextStyle(fontSize: 10.5, color: SColors.faint),
            ),
          ],
          if (status.isNotEmpty && status != 'posted')
            Text(
              status,
              style: const TextStyle(fontSize: 10.5, color: SColors.amber),
            ),
        ],
      ),
    );
  }
}

class _LateFees extends StatelessWidget {
  final Map<String, dynamic> loan;
  const _LateFees({required this.loan});

  @override
  Widget build(BuildContext context) {
    final raw = loan['lateFees'];
    if (raw is! List || raw.isEmpty) return const SizedBox.shrink();
    final rows = [
      for (final r in raw)
        if (r is Map) Map<String, dynamic>.from(r),
    ];

    return _Card(
      title: 'Late fees',
      initiallyExpanded: false,
      children: [
        for (final f in rows)
          FactRow(
            label: [
              '${f['effectiveDate'] ?? ''}',
              if (f['installment'] != null) 'payment ${f['installment']}',
            ].where((s) => s.isNotEmpty).join(' · '),
            value: f['waived'] == true ? 'Waived' : Money.format(f['amount']),
            valueColor: f['waived'] == true ? SColors.green : SColors.danger,
          ),
      ],
    );
  }
}

/// A titled block. Optionally collapsed, for the long lists that are reference
/// rather than the answer somebody came for.
class _Card extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool initiallyExpanded;

  const _Card({
    required this.title,
    required this.children,
    this.subtitle,
    this.initiallyExpanded = true,
  });

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );

    return Container(
      margin: const EdgeInsets.only(top: SSpace.lg),
      padding: EdgeInsets.fromLTRB(
        SSpace.lg,
        initiallyExpanded ? SSpace.lg : 0,
        SSpace.lg,
        initiallyExpanded ? SSpace.lg : 0,
      ),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line),
      ),
      child: initiallyExpanded
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                  ),
                ),
                const SizedBox(height: SSpace.sm),
                body,
              ],
            )
          : Theme(
              data: Theme.of(
                context,
              ).copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: SSpace.lg),
                shape: const Border(),
                collapsedShape: const Border(),
                title: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                  ),
                ),
                subtitle: subtitle == null
                    ? null
                    : Text(
                        subtitle!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: SColors.muted,
                        ),
                      ),
                children: [body],
              ),
            ),
    );
  }
}

/// Paying a loan from a deposit account.
///
/// Two things are deliberate. The amount defaults to the scheduled payment,
/// because that is what somebody opening this almost always wants. And the
/// account list excludes loan accounts and anything not open, because the
/// server rejects both and finding that out after typing an amount is a worse
/// way to learn it.
class _PaySheet extends StatefulWidget {
  final String loanId;
  final Map<String, dynamic> loan;
  const _PaySheet({required this.loanId, required this.loan});

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  bool _pending = false;
  final _amount = TextEditingController();
  String? _from;
  String? _error;

  @override
  void initState() {
    super.initState();
    final terms = widget.loan['terms'];
    final scheduled = terms is Map ? terms['paymentAmount'] : null;
    final pastDue = widget.loan['pastDue'];
    // Behind on the loan: the figure that brings it current is the one worth
    // offering first.
    final preset = (pastDue is num && pastDue > 0) ? pastDue : scheduled;
    if (preset is num) {
      _amount.text = (preset / 100).toStringAsFixed(2);
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _payFrom(BankingProvider b) => [
    for (final a in b.accounts)
      if ('${a['status'] ?? ''}'.toLowerCase() == 'open' &&
          '${a['kind'] ?? ''}'.toLowerCase() != 'loan')
        a,
  ];

  Future<void> _submit() async {
    final b = context.read<BankingProvider>();
    final cents = Money.parse(_amount.text);
    if (cents == null || cents <= 0) {
      setState(() => _error = 'Enter the amount you want to pay.');
      return;
    }
    final from = _from;
    if (from == null) {
      setState(() => _error = 'Choose the account the payment comes from.');
      return;
    }

    setState(() => _error = null);
    String? receiptStatus;
    final failure = await b.payLoan(
      loanId: widget.loanId,
      amountCents: cents,
      fromAccount: from,
      onReceipt: (status) => receiptStatus = status,
    );
    if (!mounted) return;
    if (failure != null) {
      setState(() => _error = failure);
      return;
    }
    if (receiptStatus != 'posted') {
      setState(() => _pending = true);
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final accounts = _payFrom(b);
    final payoffAmount = b.payoff['amount'];

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
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Pay this loan',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: SSpace.lg),
            TextField(
              controller: _amount,
              enabled: !_pending,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Amount',
                prefixText: '\$ ',
              ),
            ),
            if (payoffAmount != null) ...[
              const SizedBox(height: SSpace.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _pending
                      ? null
                      : () => setState(
                          () => _amount.text = ((payoffAmount as num) / 100)
                              .toStringAsFixed(2),
                        ),
                  style: TextButton.styleFrom(padding: EdgeInsets.zero),
                  child: Text(
                    'Pay it off in full — ${Money.format(payoffAmount)}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: SSpace.lg),
            const Text(
              'From',
              style: TextStyle(
                fontSize: 12,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
                color: SColors.faint,
              ),
            ),
            const SizedBox(height: SSpace.sm),
            if (accounts.isEmpty)
              const Text(
                'You need an open deposit account to pay from.',
                style: TextStyle(color: SColors.muted, height: 1.4),
              )
            else
              for (final a in accounts)
                PickRow(
                  title: accountTitle(a),
                  subtitle: [
                    accountTail(a),
                    if ((a['balances'] is Map) &&
                        (a['balances'] as Map)['available'] != null)
                      '${Money.format((a['balances'] as Map)['available'])} available',
                  ].join(' · '),
                  selected: _from == BankingProvider.idOf(a),
                  onTap: () {
                    if (!_pending)
                      setState(() => _from = BankingProvider.idOf(a));
                  },
                ),
            if (_pending) ...[
              const SizedBox(height: SSpace.md),
              const Text(
                'Request received — awaiting bank processing. Your loan payment is not confirmed yet.',
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: SSpace.md),
              ModuleError(message: _error!),
            ],
            const SizedBox(height: SSpace.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: b.busy || accounts.isEmpty ? null : _submit,
                child: Text(
                  b.busy
                      ? 'Paying…'
                      : _pending
                      ? 'Check payment'
                      : 'Pay',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
