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
