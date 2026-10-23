import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import '../../property/property_widgets.dart' show SectionHead;
import 'banking_widgets.dart';
import 'cards_screen.dart';
import 'identity_screen.dart';
import 'move_money_screen.dart';
import 'transaction_detail_screen.dart';

/// One account: what is in it, what moved, and the few things to change.
class AccountDetailScreen extends StatelessWidget {
  const AccountDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final account = b.open;
    final id = BankingProvider.idOf(account);
    final balances = account['balances'];
    final bal = balances is Map
        ? Map<String, dynamic>.from(balances)
        : const {};
    final currency = '${bal['currency'] ?? account['currency'] ?? 'USD'}';
    final pending = '${account['status'] ?? ''}'.toLowerCase() == 'pending';

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text(
          accountTitle(account),
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: SColors.ink,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_horiz_rounded),
            onPressed: () => _settings(context, account),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: b.refreshOpen,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SSpace.lg,
                SSpace.sm,
                SSpace.lg,
                SSpace.lg,
              ),
              child: AccountCard(account: account),
            ),

            // A pending account says what it is still waiting for, in the
            // server's words. Anything else would be a guess at compliance.
            if (pending)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Container(
                  padding: const EdgeInsets.all(SSpace.lg),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFDF1DC),
                    borderRadius: BorderRadius.circular(SRadius.md),
                    border: Border.all(
                      color: SColors.amber.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Still being opened',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          color: Color(0xFF8A5B16),
                        ),
                      ),
                      const SizedBox(height: SSpace.sm),
                      if (b.gaps.isEmpty)
                        const Text(
                          'Nothing more is needed from you — the bank is '
                          'still checking.',
                          style: TextStyle(
                            color: Color(0xFF8A5B16),
                            fontSize: 12.5,
                            height: 1.4,
                          ),
                        )
                      else
                        for (final gap in b.gaps)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  '• ',
                                  style: TextStyle(color: Color(0xFF8A5B16)),
                                ),
                                Expanded(
                                  child: Text(
                                    gap,
                                    style: const TextStyle(
                                      color: Color(0xFF8A5B16),
                                      fontSize: 12.5,
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      // The gaps are nearly always the identity check, and a
                      // list of them with nowhere to go is a dead end.
                      if (!b.identityVerified) ...[
                        const SizedBox(height: SSpace.md),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF8A5B16),
                              padding: const EdgeInsets.symmetric(
                                vertical: SSpace.md,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  SRadius.pill,
                                ),
                              ),
                            ),
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const IdentityScreen(),
                              ),
                            ),
                            child: const Text(
                              'Finish the identity check',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Row(
                  children: [
                    _Tile(
                      icon: Icons.swap_horiz_rounded,
                      label: 'Move money',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => MoveMoneyScreen(
                            mode: MoveMode.transfer,
                            from: account,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: SSpace.sm),
                    _Tile(
                      icon: Icons.credit_card_rounded,
                      label: b.cards.isEmpty
                          ? 'Cards'
                          : '${b.cards.length} card${b.cards.length == 1 ? '' : 's'}',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CardsScreen(accountId: id),
                        ),
                      ),
                    ),
                    const SizedBox(width: SSpace.sm),
                    _Tile(
                      icon: Icons.description_rounded,
                      label: 'Statements',
                      onTap: () => _statements(context),
                    ),
                  ],
                ),
              ),

            if (bal.isNotEmpty) ...[
              const SectionHead(title: 'Balance'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Container(
                  padding: const EdgeInsets.all(SSpace.lg),
                  decoration: BoxDecoration(
                    color: SColors.card,
                    borderRadius: BorderRadius.circular(SRadius.md),
                    border: Border.all(color: SColors.line),
                  ),
                  child: Column(
                    children: [
                      _Line(
                        k: 'Settled',
                        v: Money.format(bal['posted'], currency: currency),
                      ),
                      if ((bal['held'] as num?) != null &&
                          (bal['held'] as num) > 0)
                        _Line(
                          k: 'Held',
                          v: '−${Money.format(bal['held'], currency: currency)}',
                        ),
                      _Line(
                        k: 'Available',
                        v: Money.format(bal['available'], currency: currency),
                        strong: true,
                      ),
                      if ((bal['overdraftLimit'] as num?) != null &&
                          (bal['overdraftLimit'] as num) > 0)
                        _Line(
                          k: 'Overdraft',
                          v: Money.format(
                            bal['overdraftLimit'],
                            currency: currency,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],

            if (b.sectionError('cards') != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                  message: 'Cards: ${b.sectionError('cards')}',
                  onRetry: b.refreshOpen,
                ),
              ),
            const SectionHead(title: 'Activity'),
            if (b.sectionError('transactions') != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                  message: b.sectionError('transactions')!,
                  onRetry: b.transactions.isEmpty
                      ? b.refreshOpen
                      : b.loadMoreTransactions,
                ),
              ),
            if (b.openLoading && b.transactions.isEmpty)
              const ModuleLoading()
            else if (b.openError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                  message: b.openError!,
                  onRetry: b.refreshOpen,
                ),
              )
            else if (b.transactions.isEmpty &&
                b.sectionError('transactions') == null)
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.receipt_long_rounded,
                  title: 'Nothing has moved yet',
                  body:
                      'Every payment in or out of this account shows here, '
                      'with what it was and where it went.',
                ),
              )
            else
              for (final t in b.transactions)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    SSpace.lg,
                    0,
                    SSpace.lg,
                    SSpace.sm,
                  ),
                  child: TransactionRow(
                    txn: t,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => TransactionDetailScreen(txn: t),
                      ),
                    ),
                  ),
                ),
            if (b.hasMoreTransactions)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: OutlinedButton(
                  onPressed: b.transactionsLoading
                      ? null
                      : b.loadMoreTransactions,
                  child: Text(
                    b.transactionsLoading
                        ? 'Loading activity…'
                        : 'Load more activity',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _statements(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(sheet).height * .75,
          child: Consumer<BankingProvider>(
            builder: (sheet, b, _) => ListView(
              padding: const EdgeInsets.all(SSpace.lg),
              children: [
                const Text(
                  'Statements',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                ),
                const SizedBox(height: SSpace.md),
                if (b.sectionError('statements') != null)
                  ModuleError(
                    message: b.sectionError('statements')!,
                    onRetry: b.refreshOpen,
                  )
                else if (b.openLoading && b.statements.isEmpty)
                  const ModuleLoading()
                else if (b.statements.isEmpty)
                  const Text(
                    'No statement has been produced for this account yet. They appear after the first full statement period.',
                  ),
                for (final statement in b.statements)
                  ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    leading: const Icon(Icons.description_outlined),
                    title: Text(
                      '${statement['periodStart'] ?? ''} – ${statement['periodEnd'] ?? ''}',
                    ),
                    subtitle: Text(
                      'Closing ${Money.format(statement['closingBalance'])}',
                    ),
                    children: [
                      for (final field in const {
                        'openingBalance': 'Opening balance',
                        'credits': 'Money in',
                        'debits': 'Money out',
                        'interestPaid': 'Interest paid',
                        'feesCharged': 'Fees charged',
                        'closingBalance': 'Closing balance',
                      }.entries)
                        if (statement[field.key] != null)
                          FactRow(
                            label: field.value,
                            value: Money.format(statement[field.key]),
                          ),
                      TextButton.icon(
                        onPressed: () => shareBankPdf(
                          sheet,
                          b.statementPdf(
                            BankingProvider.idOf(b.open),
                            BankingProvider.idOf(statement),
                          ),
                          'statement-${statement['periodEnd'] ?? BankingProvider.idOf(statement)}.pdf',
                        ),
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        label: const Text('Download PDF'),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _settings(BuildContext context, Map<String, dynamic> account) {
    final b = context.read<BankingProvider>();
    final id = BankingProvider.idOf(account);
    final nickname = TextEditingController(
      text: '${account['nickname'] ?? ''}',
    );
    final overdraft = account['overdraft'];
    final optedIn = overdraft is Map && overdraft['optedIn'] == true;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: EdgeInsets.only(
            left: SSpace.lg,
            right: SSpace.lg,
            top: SSpace.lg,
            bottom: MediaQuery.of(sheet).viewInsets.bottom + SSpace.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Account settings',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
              ),
              const SizedBox(height: SSpace.lg),
              TextField(
                controller: nickname,
                decoration: const InputDecoration(labelText: 'Call it'),
                onSubmitted: (v) => b.rename(id, v.trim()),
              ),
              const SizedBox(height: SSpace.md),
              SwitchListTile(
                value: optedIn,
                onChanged: (v) async {
                  Navigator.of(sheet).pop();
                  final err = await b.setOverdraft(id, v);
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: SColors.danger,
                        content: Text(err),
                      ),
                    );
                  }
                },
                activeTrackColor: CurrentSetup.brand.primary,
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'Allow card and ATM overdrafts',
                  style: TextStyle(fontSize: 14),
                ),
                subtitle: const Text(
                  'Lets a payment go through when the balance will not '
                  'cover it. Fees may apply.',
                  style: TextStyle(fontSize: 12, height: 1.3),
                ),
              ),
              const SizedBox(height: SSpace.md),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: CurrentSetup.brand.primary,
                    padding: const EdgeInsets.symmetric(
                      vertical: SSpace.md + 2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill),
                    ),
                  ),
                  onPressed: () async {
                    final err = await b.rename(id, nickname.text.trim());
                    if (!sheet.mounted) return;
                    Navigator.of(sheet).pop();
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: SColors.danger,
                          content: Text(err),
                        ),
                      );
                    }
                  },
                  child: const Text(
                    'Save',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Tile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Column(
          children: [
            Icon(icon, size: 19, color: CurrentSetup.brand.primary),
            const SizedBox(height: SSpace.sm),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: SColors.ink2,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Line extends StatelessWidget {
  final String k, v;
  final bool strong;
  const _Line({required this.k, required this.v, this.strong = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: SSpace.sm),
    child: Row(
      children: [
        Expanded(
          child: Text(
            k,
            style: TextStyle(
              color: strong ? SColors.ink : SColors.muted,
              fontSize: 13,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          v,
          style: TextStyle(
            color: SColors.ink,
            fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
            fontSize: strong ? 15 : 13.5,
          ),
        ),
      ],
    ),
  );
}
