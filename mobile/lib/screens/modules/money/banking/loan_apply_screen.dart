import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import 'banking_widgets.dart';

/// Loans that can be applied for, with the terms stated before the form.
///
/// The worked example the server sends with each product is shown as written.
/// It is the one line that answers "what would this actually cost me", and
/// recomputing it here from a rate would risk disagreeing with the bank.
class LoanApplyScreen extends StatefulWidget {
  const LoanApplyScreen({super.key});

  @override
  State<LoanApplyScreen> createState() => _LoanApplyScreenState();
}

class _LoanApplyScreenState extends State<LoanApplyScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final b = context.read<BankingProvider>();
      if (b.loanProducts.isEmpty && !b.loansLoading) b.loadLoans();
      if (b.accounts.isEmpty && !b.loading) b.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final products = b.loanProducts;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text('Apply for a loan'),
      ),
      body: b.loansLoading && products.isEmpty
          ? const ModuleLoading()
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, SSpace.xxl),
              children: [
                if (b.loansError != null)
                  ModuleError(message: b.loansError!, onRetry: b.loadLoans),
                if (products.isEmpty && !b.loansLoading)
                  const ModuleEmpty(
                    icon: Icons.inbox_outlined,
                    title: 'Nothing to apply for',
                    body: 'This bank has no loan products open for '
                        'applications right now.',
                  ),
                for (final p in products) _ProductCard(product: p),
              ],
            ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final rate = product['rate'];
    final r = rate is Map ? Map<String, dynamic>.from(rate) : const {};
    final amount = product['amount'];
    final a = amount is Map ? Map<String, dynamic>.from(amount) : const {};
    final example = product['example'];
    final fees = product['fees'];
    final online = product['canApplyOnline'] != false;
    final note = '${product['note'] ?? ''}'.trim();
    final disclosure = '${product['disclosure'] ?? ''}'.trim();
    final description = '${product['description'] ?? ''}'.trim();

    // A fixed rate is one figure; a variable or risk-priced one is a band, and
    // showing one end of a band as "the rate" would read as an offer.
    final rateText = r['rateBps'] != null
        ? Rate.format(r['rateBps'])
        : Rate.range(r['minRateBps'], r['maxRateBps']);

    return Container(
      margin: const EdgeInsets.only(bottom: SSpace.md),
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line),
        boxShadow: SShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${product['title'] ?? 'Loan'}',
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink)),
          if (description.isNotEmpty) ...[
            const SizedBox(height: SSpace.xs),
            Text(description,
                style: const TextStyle(
                    fontSize: 13, height: 1.4, color: SColors.muted)),
          ],
          const SizedBox(height: SSpace.md),
          FactRow(label: 'Rate', value: rateText, strong: true),
          if (a['minimum'] != null || a['maximum'] != null)
            FactRow(
              label: 'You can borrow',
              value: [
                if (a['minimum'] != null) Money.short(a['minimum']),
                if (a['maximum'] != null) Money.short(a['maximum']),
              ].join(' – '),
            ),
          if (a['minTermMonths'] != null || a['maxTermMonths'] != null)
            FactRow(
              label: 'Over',
              value: [
                if (a['minTermMonths'] != null) '${a['minTermMonths']}',
                if (a['maxTermMonths'] != null) '${a['maxTermMonths']}',
              ].join(' – ') +
                  ' months',
            ),
          if (fees is List && fees.isNotEmpty) ...[
            const SizedBox(height: SSpace.sm),
            const Text('FEES',
                style: TextStyle(
                    fontSize: 9.5,
                    letterSpacing: 1,
                    fontWeight: FontWeight.w700,
                    color: SColors.faint)),
            for (final f in fees)
              if (f is Map)
                FactRow(
                  label: '${f['title'] ?? ''}',
                  value: f['amount'] != null
                      ? Money.format(f['amount'])
                      : f['percentBps'] != null
                          ? Rate.format(f['percentBps'])
                          : '—',
                ),
          ],
          // The bank's own worked example, as sent.
          if (example is Map && '${example['text'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: SSpace.md),
            Container(
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                color: SColors.paper2,
                borderRadius: BorderRadius.circular(SRadius.md),
              ),
              child: Text(
                '${example['text']}',
                style: const TextStyle(
                    fontSize: 12, height: 1.45, color: SColors.ink2),
              ),
            ),
          ],
          if (disclosure.isNotEmpty) ...[
            const SizedBox(height: SSpace.sm),
            Text(disclosure,
                style: const TextStyle(
                    fontSize: 11, height: 1.4, color: SColors.faint)),
          ],
          const SizedBox(height: SSpace.lg),
          if (online)
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => LoanApplyFormScreen(product: product))),
                child: const Text('Apply'),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                color: SColors.paper2,
                borderRadius: BorderRadius.circular(SRadius.md),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.storefront_outlined,
                      size: 16, color: SColors.ink2),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    // The bank's reason, not ours.
                    child: Text(
                      note.isEmpty
                          ? 'This loan is applied for at a branch.'
                          : note,
                      style: const TextStyle(
                          fontSize: 12, height: 1.4, color: SColors.ink2),
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

/// The application itself.
///
/// The consent to a credit check is a real checkbox. The server requires it,
/// and sending it on somebody's behalf because the API demands it would be
/// consent nobody gave — so the submit stays disabled until it is ticked.
class LoanApplyFormScreen extends StatefulWidget {
  final Map<String, dynamic> product;
  const LoanApplyFormScreen({super.key, required this.product});

  @override
  State<LoanApplyFormScreen> createState() => _LoanApplyFormScreenState();
}

class _LoanApplyFormScreenState extends State<LoanApplyFormScreen> {
  final _amount = TextEditingController();
  final _term = TextEditingController();
  final _purpose = TextEditingController();
  final _income = TextEditingController();
  final _incomeSource = TextEditingController();
  final _employer = TextEditingController();
  final _jobTitle = TextEditingController();
  final _since = TextEditingController();
  final _housing = TextEditingController();

  String? _linked;
  bool _consent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Start from the example the server already worked out, so the form opens
    // on figures that are known to be inside the product's limits.
    final example = widget.product['example'];
    if (example is Map) {
      final amount = example['amount'];
      final term = example['termMonths'];
      if (amount is num) _amount.text = (amount / 100).toStringAsFixed(2);
      if (term is num) _term.text = '${term.round()}';
    }
  }

  @override
  void dispose() {
    for (final c in [
      _amount,
      _term,
      _purpose,
      _income,
      _incomeSource,
      _employer,
      _jobTitle,
      _since,
      _housing,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> _depositAccounts(BankingProvider b) => [
        for (final a in b.accounts)
          if ('${a['status'] ?? ''}'.toLowerCase() == 'open' &&
              '${a['kind'] ?? ''}'.toLowerCase() != 'loan')
            a,
      ];

  Future<void> _submit() async {
    final b = context.read<BankingProvider>();

    final amount = Money.parse(_amount.text);
    final term = int.tryParse(_term.text.trim());
    final income = Money.parse(_income.text);
    final housing = _housing.text.trim().isEmpty
        ? null
        : Money.parse(_housing.text);
    final purpose = _purpose.text.trim();
    final linked = _linked;

    // Checked here rather than left to the server, because every one of these
    // is a thing the person can see and fix on this screen.
    final missing = <String>[
      if (amount == null || amount <= 0) 'how much you want to borrow',
      if (term == null || term <= 0) 'how many months to repay it over',
      if (purpose.isEmpty) 'what the loan is for',
      if (income == null || income <= 0) 'your monthly income before tax',
      if (linked == null) 'which account the loan should pay into',
    ];
    if (missing.isNotEmpty) {
      setState(() => _error = 'Still needed: ${missing.join(', ')}.');
      return;
    }

    setState(() => _error = null);

    final employer = _employer.text.trim();
    final jobTitle = _jobTitle.text.trim();
    final since = _since.text.trim();

    final failure = await b.applyForLoan(
      product: BankingProvider.idOf(widget.product),
      amountCents: amount!,
      termMonths: term!,
      purpose: purpose,
      grossMonthlyCents: income!,
      linkedAccount: linked!,
      incomeSource: _incomeSource.text.trim(),
      employment: employer.isEmpty && jobTitle.isEmpty && since.isEmpty
          ? null
          : {
              if (employer.isNotEmpty) 'employer': employer,
              if (jobTitle.isNotEmpty) 'title': jobTitle,
              if (since.isNotEmpty) 'since': since,
            },
      housingPaymentCents: housing,
    );

    if (!mounted) return;
    if (failure != null) {
      setState(() => _error = failure);
      return;
    }
    // Back to the loans screen, where the new application is now listed.
    Navigator.of(context).pop();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final accounts = _depositAccounts(b);

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text('${widget.product['title'] ?? 'Apply'}'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.lg, SSpace.lg, SSpace.xxl),
        children: [
          const _Head('What you want'),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration:
                const InputDecoration(labelText: 'Amount', prefixText: '\$ '),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _term,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
                labelText: 'Months to repay over', suffixText: 'months'),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _purpose,
            decoration: const InputDecoration(labelText: 'What it is for'),
          ),

          const _Head('Your income'),
          TextField(
            controller: _income,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
                labelText: 'Monthly income before tax', prefixText: '\$ '),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _incomeSource,
            decoration: const InputDecoration(
                labelText: 'Where it comes from (optional)',
                hintText: 'Salary, self-employment, pension'),
          ),

          const _Head('Your work (optional)'),
          TextField(
            controller: _employer,
            decoration: const InputDecoration(labelText: 'Employer'),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _jobTitle,
            decoration: const InputDecoration(labelText: 'Job title'),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _since,
            decoration: const InputDecoration(
                labelText: 'There since', hintText: 'YYYY-MM-DD'),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _housing,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
                labelText: 'Rent or mortgage a month (optional)',
                prefixText: '\$ '),
          ),

          const _Head('Where the money goes'),
          if (accounts.isEmpty)
            const Text(
              'You need an open deposit account for the loan to pay into. '
              'Open one first, then come back.',
              style: TextStyle(color: SColors.muted, height: 1.4),
            )
          else
            for (final a in accounts)
              PickRow(
                title: accountTitle(a),
                subtitle: accountTail(a),
                selected: _linked == BankingProvider.idOf(a),
                onTap: () => setState(() => _linked = BankingProvider.idOf(a)),
              ),

          const SizedBox(height: SSpace.xl),
          GestureDetector(
            onTap: () => setState(() => _consent = !_consent),
            child: Container(
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                color: SColors.card,
                borderRadius: BorderRadius.circular(SRadius.md),
                border: Border.all(
                    color: _consent ? SColors.green : SColors.line,
                    width: _consent ? 1.3 : 1),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    _consent
                        ? Icons.check_box_rounded
                        : Icons.check_box_outline_blank_rounded,
                    size: 20,
                    color: _consent ? SColors.green : SColors.faint,
                  ),
                  const SizedBox(width: SSpace.sm),
                  const Expanded(
                    child: Text(
                      'I agree the bank may check my credit to decide this '
                      'application.',
                      style: TextStyle(
                          fontSize: 13, height: 1.4, color: SColors.ink),
                    ),
                  ),
                ],
              ),
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: SSpace.md),
            ModuleError(message: _error!),
          ],

          const SizedBox(height: SSpace.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed:
                  !_consent || b.busy || accounts.isEmpty ? null : _submit,
              child: Text(b.busy ? 'Sending…' : 'Send application'),
            ),
          ),
          const SizedBox(height: SSpace.sm),
          const Text(
            'One applicant only. To apply with somebody else, the bank takes '
            'that at a branch or by phone.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, height: 1.4, color: SColors.faint),
          ),
        ],
      ),
    );
  }
}

class _Head extends StatelessWidget {
  final String text;
  const _Head(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: SSpace.xl, bottom: SSpace.md),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 10.5,
                letterSpacing: 1.6,
                fontWeight: FontWeight.w700,
                color: SColors.faint)),
      );
}
