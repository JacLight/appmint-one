import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';

/// The cards on one account.
///
/// Lock is the first control on every card, because the reason somebody opens
/// this screen in a hurry is that they cannot find it.
class CardsScreen extends StatelessWidget {
  final String accountId;
  const CardsScreen({super.key, required this.accountId});

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text('Cards',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: brand.primary,
        foregroundColor: Colors.white,
        onPressed: () => _order(context),
        icon: const Icon(Icons.add_card_rounded),
        label: const Text('Order a card',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: b.cards.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(SSpace.lg),
              child: ModuleEmpty(
                icon: Icons.credit_card_rounded,
                title: 'No cards on this account',
                body:
                    'Order a virtual card to use straight away, or a physical '
                    'one to arrive in the post.',
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, SSpace.xxl * 2),
              children: [
                for (final c in b.cards)
                  Padding(
                    padding: const EdgeInsets.only(bottom: SSpace.lg),
                    child: _Card(card: c),
                  ),
              ],
            ),
    );
  }

  void _order(BuildContext context) {
    final b = context.read<BankingProvider>();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Order a card',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: CurrentSetup.brand.displayFont,
                  )),
              const SizedBox(height: SSpace.lg),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.bolt_rounded, color: SColors.green),
                title: const Text('Virtual',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Ready to use now, online',
                    style: TextStyle(fontSize: 12.5)),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final err = await b.orderCard(accountId, form: 'virtual');
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        backgroundColor: SColors.danger, content: Text(err)));
                  }
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.local_shipping_rounded,
                    color: SColors.ink2),
                title: const Text('Physical',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Posted to your address',
                    style: TextStyle(fontSize: 12.5)),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final err = await b.orderCard(accountId, form: 'physical');
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        backgroundColor: SColors.danger, content: Text(err)));
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final Map<String, dynamic> card;
  const _Card({required this.card});

  @override
  Widget build(BuildContext context) {
    final b = context.read<BankingProvider>();
    final brand = CurrentSetup.brand;
    final id = BankingProvider.idOf(card);
    final status = '${card['status'] ?? ''}'.toLowerCase();
    final form = '${card['form'] ?? 'physical'}';
    final last4 = '${card['last4'] ?? card['panLast4'] ?? '••••'}';
    final network = '${card['network'] ?? ''}'.toUpperCase();
    final locked = status == 'locked';
    final dead = status == 'lost' ||
        status == 'stolen' ||
        status == 'closed' ||
        status == 'expired';
    final awaiting = status == 'ordered' || status == 'shipped';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The card itself, which is what somebody looks for on this screen.
        Container(
          height: 180,
          padding: const EdgeInsets.all(SSpace.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: dead || locked
                  ? [SColors.muted, SColors.ink2]
                  : [brand.primary, Color.lerp(brand.primary, brand.accent, 0.5)!],
            ),
            borderRadius: BorderRadius.circular(SRadius.xl),
            boxShadow: SShadow.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(form == 'virtual' ? 'Virtual' : 'Physical',
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 11.5,
                          letterSpacing: 1.1,
                          fontWeight: FontWeight.w700)),
                  const Spacer(),
                  if (locked)
                    const Icon(Icons.lock_rounded,
                        color: Colors.white, size: 18),
                ],
              ),
              const Spacer(),
              Text('•••• •••• •••• $last4',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      letterSpacing: 2.2,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: SSpace.sm),
              Row(
                children: [
                  Text(
                    '${card['nameOnCard'] ?? ''}'.toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        letterSpacing: 1),
                  ),
                  const Spacer(),
                  Text(network,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 13)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: SSpace.md),
        if (awaiting)
          _Note(
            text: status == 'ordered'
                ? 'Ordered. We will say when it ships.'
                : 'On its way. Switch it on when it arrives.',
            action: 'Activate',
            onAction: () => _activate(context, id),
          )
        else if (dead)
          _Note(text: 'This card is $status and cannot be used.')
        else
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: locked ? SColors.green : SColors.ink2,
                    side: const BorderSide(color: SColors.line),
                    padding:
                        const EdgeInsets.symmetric(vertical: SSpace.md),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SRadius.pill)),
                  ),
                  onPressed: () async {
                    final err = await b.setCardLocked(id, !locked);
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          backgroundColor: SColors.danger,
                          content: Text(err)));
                    }
                  },
                  icon: Icon(
                      locked
                          ? Icons.lock_open_rounded
                          : Icons.lock_rounded,
                      size: 17),
                  label: Text(locked ? 'Unlock' : 'Lock',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: SColors.ink2,
                    side: const BorderSide(color: SColors.line),
                    padding:
                        const EdgeInsets.symmetric(vertical: SSpace.md),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SRadius.pill)),
                  ),
                  onPressed: () => _replace(context, id),
                  icon: const Icon(Icons.sync_rounded, size: 17),
                  label: const Text('Replace',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ),
            ],
          ),
        if (card['controls'] is Map) ...[
          const SizedBox(height: SSpace.sm),
          _Controls(card: card),
        ],
      ],
    );
  }

  void _activate(BuildContext context, String id) {
    final b = context.read<BankingProvider>();
    final last4 = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (dialog) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Switch the card on'),
        content: TextField(
          controller: last4,
          keyboardType: TextInputType.number,
          maxLength: 4,
          decoration: const InputDecoration(
            labelText: 'Last 4 digits',
            helperText: 'From the card that arrived',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialog).pop(),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: CurrentSetup.brand.primary),
            onPressed: () async {
              final err = await b.activateCard(id, last4.text.trim());
              if (!dialog.mounted) return;
              Navigator.of(dialog).pop();
              if (err != null && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    backgroundColor: SColors.danger, content: Text(err)));
              }
            },
            child: const Text('Activate'),
          ),
        ],
      ),
    );
  }

  void _replace(BuildContext context, String id) {
    final b = context.read<BankingProvider>();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(SSpace.lg),
              child: Text('What happened to it?',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            for (final why in const ['lost', 'stolen', 'damaged'])
              ListTile(
                title: Text(
                  '${why[0].toUpperCase()}${why.substring(1)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  why == 'stolen'
                      ? 'The old card is stopped immediately'
                      : 'A new one is sent out',
                  style: const TextStyle(fontSize: 12),
                ),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final err = await b.replaceCard(id, why);
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        backgroundColor: SColors.danger, content: Text(err)));
                  }
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// The limits and switches the server keeps on a card, shown as they are.
class _Controls extends StatelessWidget {
  final Map<String, dynamic> card;
  const _Controls({required this.card});

  @override
  Widget build(BuildContext context) {
    final b = context.read<BankingProvider>();
    final id = BankingProvider.idOf(card);
    final c = Map<String, dynamic>.from(card['controls'] as Map);

    Widget toggle(String key, String label) => SwitchListTile(
          value: c[key] != false,
          onChanged: (v) => b.setCardControls(id, {key: v}),
          activeTrackColor: CurrentSetup.brand.primary,
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(label, style: const TextStyle(fontSize: 13.5)),
        );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: SSpace.md),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: SColors.line),
      ),
      child: Column(
        children: [
          toggle('online', 'Online payments'),
          toggle('atm', 'ATM withdrawals'),
          toggle('international', 'Abroad'),
          if (c['dailySpend'] != null)
            Padding(
              padding: const EdgeInsets.only(bottom: SSpace.md),
              child: Row(
                children: [
                  const Text('Daily limit',
                      style: TextStyle(fontSize: 13.5, color: SColors.ink2)),
                  const Spacer(),
                  Text(Money.format(c['dailySpend']),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13.5)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  final String text;
  final String? action;
  final VoidCallback? onAction;
  const _Note({required this.text, this.action, this.onAction});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.paper2,
          borderRadius: BorderRadius.circular(SRadius.md),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(text,
                  style: const TextStyle(
                      color: SColors.ink2, fontSize: 12.5, height: 1.35)),
            ),
            if (action != null)
              TextButton(
                onPressed: onAction,
                child: Text(action!,
                    style: TextStyle(
                        color: CurrentSetup.brand.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13)),
              ),
          ],
        ),
      );
}
