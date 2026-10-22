import 'package:flutter/material.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../services/banking_api.dart';

/// What an account is called, in the words of the record rather than ours.
String accountTitle(Map<String, dynamic> account) {
  final nickname = '${account['nickname'] ?? ''}'.trim();
  if (nickname.isNotEmpty) return nickname;
  final kind = '${account['kind'] ?? ''}'.replaceAll('_', ' ').trim();
  if (kind.isEmpty) return 'Account';
  return '${kind[0].toUpperCase()}${kind.substring(1)}';
}

/// Last four of the account number. The server masks it for anyone who is not
/// a holder, so whatever arrives is what may be shown.
String accountTail(Map<String, dynamic> account) {
  final number = '${account['accountNumber'] ?? ''}'.trim();
  if (number.length <= 4) return number;
  return '••${number.substring(number.length - 4)}';
}

/// Status as a word somebody not in banking would use.
({String label, Color fg, Color bg}) accountStatus(String status) =>
    switch (status.toLowerCase()) {
      'open' => (label: 'Open', fg: SColors.green2, bg: SColors.greenSoft),
      'pending' => (
          label: 'Being opened',
          fg: Color(0xFF8A5B16),
          bg: Color(0xFFFDF1DC)
        ),
      'frozen' => (label: 'Frozen', fg: SColors.danger, bg: Color(0xFFFBE9E7)),
      'dormant' => (label: 'Dormant', fg: SColors.muted, bg: SColors.paper2),
      'closed' => (label: 'Closed', fg: SColors.muted, bg: SColors.paper2),
      _ => (label: status, fg: SColors.ink2, bg: SColors.paper2),
    };

/// An account, as a card. Balance is the thing people open the app for, so it
/// is the biggest thing on it.
class AccountCard extends StatelessWidget {
  final Map<String, dynamic> account;
  final VoidCallback? onTap;
  const AccountCard({super.key, required this.account, this.onTap});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final balances = account['balances'];
    final b = balances is Map ? Map<String, dynamic>.from(balances) : const {};
    final available = b['available'];
    final held = b['held'];
    final currency = '${b['currency'] ?? account['currency'] ?? 'USD'}';
    final status = '${account['status'] ?? ''}';
    final look = accountStatus(status);
    final pending = status.toLowerCase() == 'pending';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          gradient: pending
              ? null
              : LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    brand.primary,
                    Color.lerp(brand.primary, Colors.black, 0.3)!,
                  ],
                ),
          color: pending ? SColors.card : null,
          borderRadius: BorderRadius.circular(SRadius.xl),
          border: pending ? Border.all(color: SColors.line) : null,
          boxShadow: pending ? SShadow.soft : SShadow.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    accountTitle(account),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: pending ? SColors.ink : Colors.white,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: SSpace.sm + 2, vertical: 3),
                  decoration: BoxDecoration(
                    color: pending ? look.bg : Colors.white24,
                    borderRadius: BorderRadius.circular(SRadius.pill),
                  ),
                  child: Text(
                    look.label,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: pending ? look.fg : Colors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: SSpace.xs),
            Text(
              accountTail(account),
              style: TextStyle(
                fontSize: 12,
                letterSpacing: 1,
                color: pending ? SColors.muted : Colors.white70,
              ),
            ),
            const SizedBox(height: SSpace.lg),
            Text(
              available == null
                  ? 'No balance yet'
                  : Money.format(available, currency: currency),
              style: TextStyle(
                fontSize: available == null ? 16 : 28,
                fontWeight: FontWeight.w800,
                color: pending ? SColors.ink2 : Colors.white,
              ),
            ),
            Text(
              available == null ? '' : 'Available',
              style: TextStyle(
                fontSize: 11.5,
                color: pending ? SColors.muted : Colors.white70,
              ),
            ),
            if (held is num && held > 0) ...[
              const SizedBox(height: SSpace.sm),
              Row(
                children: [
                  Icon(Icons.lock_clock_rounded,
                      size: 13,
                      color: pending ? SColors.muted : Colors.white70),
                  const SizedBox(width: SSpace.xs + 1),
                  Text(
                    '${Money.format(held, currency: currency)} held',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: pending ? SColors.muted : Colors.white70,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One line of an account's activity.
class TransactionRow extends StatelessWidget {
  final Map<String, dynamic> txn;
  final VoidCallback? onTap;
  const TransactionRow({super.key, required this.txn, this.onTap});

  @override
  Widget build(BuildContext context) {
    final amount = txn['amount'];
    final currency = '${txn['currency'] ?? 'USD'}';
    final status = '${txn['status'] ?? ''}'.toLowerCase();
    final direction = '${txn['direction'] ?? ''}'.toLowerCase();
    final description = '${txn['description'] ?? txn['kind'] ?? 'Transaction'}';
    final memo = '${txn['memo'] ?? ''}'.trim();
    final rail = '${txn['rail'] ?? ''}'.trim();

    // Money in is the exception worth colouring; everything else reads as
    // ordinary spending, which is what most of a statement is.
    final incoming = direction == 'in';
    final settled = status == 'posted';
    final dead = status == 'returned' ||
        status == 'failed' ||
        status == 'cancelled' ||
        status == 'reversed';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: dead
                    ? SColors.paper2
                    : incoming
                        ? SColors.greenSoft
                        : SColors.paper2,
                shape: BoxShape.circle,
              ),
              child: Icon(
                dead
                    ? Icons.block_rounded
                    : incoming
                        ? Icons.south_west_rounded
                        : Icons.north_east_rounded,
                size: 16,
                color: dead
                    ? SColors.faint
                    : incoming
                        ? SColors.green
                        : SColors.ink2,
              ),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: dead ? SColors.muted : SColors.ink,
                      decoration:
                          dead ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (!settled && status.isNotEmpty) _statusWord(status),
                      if (rail.isNotEmpty) rail.toUpperCase(),
                      if (memo.isNotEmpty) memo,
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: status == 'pending'
                          ? SColors.amber
                          : SColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: SSpace.sm),
            Text(
              '${incoming ? '+' : '−'}${Money.format(amount, currency: currency)}'
                  .replaceAll('\$-', '\$'),
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: dead
                    ? SColors.faint
                    : incoming
                        ? SColors.green
                        : SColors.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _statusWord(String status) => switch (status) {
        'pending' => 'Pending',
        'returned' => 'Returned',
        'failed' => 'Failed',
        'cancelled' => 'Cancelled',
        'reversed' => 'Reversed',
        'in_review' => 'Pending',
        _ => status,
      };
}

/// A pick-one row.
///
/// Hand-rolled rather than `RadioListTile`: that one's `groupValue` and
/// `onChanged` are deprecated in this Flutter, and a bank app should not ship
/// with deprecation warnings in the one screen that moves money.
class PickRow extends StatelessWidget {
  final String title;
  final String? subtitle;
  final bool selected;
  final VoidCallback onTap;
  const PickRow({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: SSpace.sm),
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: selected ? brand.primary.withValues(alpha: 0.07) : SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: selected ? brand.primary : SColors.line,
              width: selected ? 1.4 : 1),
        ),
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: selected ? brand.primary : SColors.faint,
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: SColors.ink)),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!,
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 12)),
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

// ── Lending ───────────────────────────────────────────────────────────────
//
// Every status below is a key the server actually sends, and the server also
// sends `statusText` — a full sentence in the applicant's own language ("We're
// checking your details"). A sentence will not fit a chip, so the chip carries
// a short word and the server's sentence is shown beside it, unedited. The
// short word is a label; the sentence is the bank speaking.

/// A loan's standing. Keys from `LOAN_TEXT` on the server.
({String label, Color fg, Color bg}) loanStatus(String status) =>
    switch (status.toLowerCase()) {
      'active' => (label: 'Current', fg: SColors.green2, bg: SColors.greenSoft),
      'arrears' => (
          label: 'Past due',
          fg: SColors.danger,
          bg: Color(0xFFFBE9E7)
        ),
      'booked' => (
          label: 'On its way',
          fg: Color(0xFF8A5B16),
          bg: Color(0xFFFDF1DC)
        ),
      'paid_off' => (label: 'Paid off', fg: SColors.muted, bg: SColors.paper2),
      'charged_off' => (
          label: 'Still owed',
          fg: SColors.danger,
          bg: Color(0xFFFBE9E7)
        ),
      'closed' => (label: 'Closed', fg: SColors.muted, bg: SColors.paper2),
      _ => (label: status, fg: SColors.ink2, bg: SColors.paper2),
    };

/// An application's stage. Keys from `STAGE_TEXT` on the server.
({String label, Color fg, Color bg}) applicationStatus(String status) =>
    switch (status.toLowerCase()) {
      'draft' => (label: 'Not sent', fg: SColors.muted, bg: SColors.paper2),
      'complete' => (
          label: 'Received',
          fg: Color(0xFF8A5B16),
          bg: Color(0xFFFDF1DC)
        ),
      'verification' || 'underwriting' => (
          label: 'In review',
          fg: Color(0xFF8A5B16),
          bg: Color(0xFFFDF1DC)
        ),
      'approved' || 'closing' => (
          label: 'Approved',
          fg: SColors.green2,
          bg: SColors.greenSoft
        ),
      'countered' => (
          label: 'Needs you',
          fg: SColors.clay2,
          bg: SColors.claySoft
        ),
      'booked' => (label: 'Set up', fg: SColors.green2, bg: SColors.greenSoft),
      'declined' => (
          label: 'Not approved',
          fg: SColors.danger,
          bg: Color(0xFFFBE9E7)
        ),
      'withdrawn' => (label: 'Withdrawn', fg: SColors.muted, bg: SColors.paper2),
      'incomplete' => (label: 'Closed', fg: SColors.muted, bg: SColors.paper2),
      _ => (label: status, fg: SColors.ink2, bg: SColors.paper2),
    };

/// A short status word, in its own colours.
class StatusPill extends StatelessWidget {
  final ({String label, Color fg, Color bg}) look;
  const StatusPill({super.key, required this.look});

  @override
  Widget build(BuildContext context) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: SSpace.sm + 2, vertical: 3),
        decoration: BoxDecoration(
          color: look.bg,
          borderRadius: BorderRadius.circular(SRadius.pill),
        ),
        child: Text(
          look.label,
          style: TextStyle(
              fontSize: 10.5, fontWeight: FontWeight.w700, color: look.fg),
        ),
      );
}

/// A labelled figure. Used wherever a loan's numbers are laid out, so a rate
/// and an amount never end up aligned differently on two screens.
class FactRow extends StatelessWidget {
  final String label, value;
  final bool strong;
  final Color? valueColor;
  const FactRow({
    super.key,
    required this.label,
    required this.value,
    this.strong = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(label,
                  style: const TextStyle(fontSize: 13, color: SColors.muted)),
            ),
            const SizedBox(width: SSpace.md),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontSize: strong ? 15 : 13.5,
                  fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                  color: valueColor ?? SColors.ink,
                ),
              ),
            ),
          ],
        ),
      );
}

/// One of my loans, in a list. What is owed leads, because that is the
/// question somebody opens this screen to answer; being late outranks it, and
/// is the only thing allowed to colour the card.
class LoanCard extends StatelessWidget {
  final Map<String, dynamic> loan;
  final VoidCallback? onTap;
  const LoanCard({super.key, required this.loan, this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = '${loan['status'] ?? ''}';
    final look = loanStatus(status);
    final dpd = loan['daysPastDue'];
    final late = dpd is num && dpd > 0;
    final owed = loan['owed'];
    final payment = loan['paymentAmount'];
    final nextDue = '${loan['nextDue'] ?? ''}'.trim();
    final product = '${loan['product'] ?? ''}'.trim();
    final number = '${loan['number'] ?? ''}'.trim();
    final rateBps = loan['aprBps'] ?? loan['rateBps'];

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          border: Border.all(
              color: late ? SColors.danger : SColors.line,
              width: late ? 1.3 : 1),
          boxShadow: SShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product.isEmpty ? 'Loan' : product,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: SColors.ink),
                  ),
                ),
                StatusPill(look: look),
              ],
            ),
            if (number.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(number,
                  style: const TextStyle(
                      fontSize: 11.5, letterSpacing: 0.5, color: SColors.muted)),
            ],
            const SizedBox(height: SSpace.md),
            Text(
              owed == null ? 'No balance reported' : Money.format(owed),
              style: TextStyle(
                fontSize: owed == null ? 15 : 26,
                fontWeight: FontWeight.w800,
                color: late ? SColors.danger : SColors.ink,
              ),
            ),
            const Text('Owed',
                style: TextStyle(fontSize: 11.5, color: SColors.muted)),
            const SizedBox(height: SSpace.md),
            Wrap(
              spacing: SSpace.lg,
              runSpacing: SSpace.xs,
              children: [
                if (rateBps != null)
                  _Fact(label: 'Rate', value: Rate.format(rateBps)),
                if (payment != null)
                  _Fact(label: 'Payment', value: Money.format(payment)),
                if (nextDue.isNotEmpty)
                  _Fact(label: 'Next due', value: nextDue),
              ],
            ),
            if (late) ...[
              const SizedBox(height: SSpace.md),
              Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      size: 14, color: SColors.danger),
                  const SizedBox(width: SSpace.xs + 1),
                  Text(
                    '$dpd ${dpd == 1 ? 'day' : 'days'} past due',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: SColors.danger),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final String label, value;
  const _Fact({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: const TextStyle(
                  fontSize: 9.5,
                  letterSpacing: 1,
                  fontWeight: FontWeight.w700,
                  color: SColors.faint)),
          const SizedBox(height: 1),
          Text(value,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: SColors.ink2)),
        ],
      );
}

/// One application, in a list. An offer waiting on an answer is called out:
/// it expires, and nobody should have to open each one to find the one that
/// needs them.
class ApplicationRow extends StatelessWidget {
  final Map<String, dynamic> application;
  final VoidCallback? onTap;
  const ApplicationRow({super.key, required this.application, this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = '${application['status'] ?? ''}';
    final look = applicationStatus(status);
    final needsAnswer = application['counterofferPending'] == true;
    final amount = application['amount'];
    final term = application['termMonths'];
    final product = '${application['product'] ?? ''}'.trim();
    final statusText = '${application['statusText'] ?? ''}'.trim();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: SSpace.sm),
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: needsAnswer ? SColors.clay : SColors.line,
              width: needsAnswer ? 1.3 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product.isEmpty ? 'Application' : product,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: SColors.ink),
                  ),
                ),
                StatusPill(look: look),
              ],
            ),
            const SizedBox(height: SSpace.xs),
            Text(
              [
                if (amount != null) Money.format(amount),
                if (term != null) '$term months',
              ].join(' · '),
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: SColors.ink2),
            ),
            // The bank's own sentence, as sent.
            if (statusText.isNotEmpty) ...[
              const SizedBox(height: 3),
              Text(statusText,
                  style: TextStyle(
                      fontSize: 12,
                      height: 1.3,
                      color: needsAnswer ? SColors.clay2 : SColors.muted)),
            ],
          ],
        ),
      ),
    );
  }
}
