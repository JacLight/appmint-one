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
        title: const Text(
          'Cards',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: SColors.ink,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: brand.primary,
        foregroundColor: Colors.white,
        onPressed: () => _order(context),
        icon: const Icon(Icons.add_card_rounded),
        label: const Text(
          'Order a card',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: b.sectionError('cards') != null
          ? ModuleError(
              message: b.sectionError('cards')!,
              onRetry: b.refreshOpen,
            )
          : b.cards.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(SSpace.lg),
              child: ModuleEmpty(
                icon: Icons.credit_card_rounded,
                title: 'No cards on this account',
                body:
                    'Request a virtual or physical card. The bank must issue '
                    'it before use; physical cards also need shipping and activation.',
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                SSpace.lg,
                SSpace.lg,
                SSpace.lg,
                SSpace.xxl * 2,
              ),
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
              Text(
                'Order a card',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: CurrentSetup.brand.displayFont,
                ),
              ),
              const SizedBox(height: SSpace.lg),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.bolt_rounded, color: SColors.green),
                title: const Text(
                  'Virtual',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text(
                  'Available after the bank issues it',
                  style: TextStyle(fontSize: 12.5),
                ),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final err = await b.orderCard(accountId, form: 'virtual');
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: SColors.danger,
                        content: Text(err),
                      ),
                    );
                  }
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.local_shipping_rounded,
                  color: SColors.ink2,
                ),
                title: const Text(
                  'Physical',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text(
                  'Shipping address required; bank issuance pending',
                  style: TextStyle(fontSize: 12.5),
                ),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final shipping = await _shippingAddress(context);
                  if (shipping == null) return;
                  final err = await b.orderCard(
                    accountId,
                    form: 'physical',
                    shipping: shipping,
                  );
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: SColors.danger,
                        content: Text(err),
                      ),
                    );
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
    final dead =
        status == 'lost' ||
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
                  : [
                      brand.primary,
                      Color.lerp(brand.primary, brand.accent, 0.5)!,
                    ],
            ),
            borderRadius: BorderRadius.circular(SRadius.xl),
            boxShadow: SShadow.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    form == 'virtual' ? 'Virtual' : 'Physical',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11.5,
                      letterSpacing: 1.1,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  if (locked)
                    const Icon(
                      Icons.lock_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                ],
              ),
              const Spacer(),
              Text(
                '•••• •••• •••• $last4',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  letterSpacing: 2.2,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: SSpace.sm),
              Row(
                children: [
                  Text(
                    '${card['nameOnCard'] ?? ''}'.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      letterSpacing: 1,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    network,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
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
                    padding: const EdgeInsets.symmetric(vertical: SSpace.md),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill),
                    ),
                  ),
                  onPressed: () async {
                    final err = await b.setCardLocked(id, !locked);
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: SColors.danger,
                          content: Text(err),
                        ),
                      );
                    }
                  },
                  icon: Icon(
                    locked ? Icons.lock_open_rounded : Icons.lock_rounded,
                    size: 17,
                  ),
                  label: Text(
                    locked ? 'Unlock' : 'Lock',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: SColors.ink2,
                    side: const BorderSide(color: SColors.line),
                    padding: const EdgeInsets.symmetric(vertical: SSpace.md),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill),
                    ),
                  ),
                  onPressed: () => _replace(context, id),
                  icon: const Icon(Icons.sync_rounded, size: 17),
                  label: const Text(
                    'Replace',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
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
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: CurrentSetup.brand.primary,
            ),
            onPressed: () async {
              final err = await b.activateCard(id, last4.text.trim());
              if (!dialog.mounted) return;
              Navigator.of(dialog).pop();
              if (err != null && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(backgroundColor: SColors.danger, content: Text(err)),
                );
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
              child: Text(
                'What happened to it?',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
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
                      : 'A replacement order is requested',
                  style: const TextStyle(fontSize: 12),
                ),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final shipping = card['form'] == 'physical'
                      ? await _shippingAddress(
                          context,
                          existing: card['shipping'] is Map
                              ? Map<String, dynamic>.from(
                                  card['shipping'] as Map,
                                )
                              : null,
                        )
                      : null;
                  if (card['form'] == 'physical' && shipping == null) return;
                  final err = await b.replaceCard(id, why, shipping: shipping);
                  if (err != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: SColors.danger,
                        content: Text(err),
                      ),
                    );
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
      child: Material(
        type: MaterialType.transparency,
        child: Column(
          children: [
            toggle('online', 'Online payments'),
            toggle('atm', 'ATM withdrawals'),
            toggle('international', 'Abroad'),
            for (final field in const {
              'perTransaction': 'Per purchase',
              'dailySpend': 'Daily spending',
              'dailyAtm': 'Daily ATM',
            }.entries)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(field.value),
                trailing: Text(
                  c[field.key] == null
                      ? 'No fixed limit'
                      : Money.format(c[field.key]),
                ),
                onTap: () => _editLimit(
                  context,
                  b,
                  id,
                  field.key,
                  field.value,
                  c[field.key],
                  card['bankLimits'] is Map
                      ? Map<String, dynamic>.from(card['bankLimits'] as Map)
                      : const {},
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _editLimit(
    BuildContext context,
    BankingProvider bank,
    String cardId,
    String key,
    String label,
    dynamic current,
    Map<String, dynamic> bankLimits,
  ) async {
    var amount = current is num ? (current / 100).toStringAsFixed(2) : '';
    final ceiling = bankLimits.containsKey(key) ? bankLimits[key] : current;
    String? error;
    var saving = false;
    await showDialog<void>(
      context: context,
      builder: (dialog) => StatefulBuilder(
        builder: (dialog, update) => AlertDialog(
          title: Text(label),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                ceiling is num
                    ? 'Your personal limit can be up to ${Money.format(ceiling)}. Use bank limit restores the bank’s limit.'
                    : 'Choose a personal limit. Use bank limit restores the bank’s policy.',
              ),
              TextFormField(
                initialValue: amount,
                onChanged: (value) => amount = value,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: 'Amount',
                  errorText: error,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(dialog),
              child: const Text('Cancel'),
            ),
            if (bankLimits.containsKey(key))
              TextButton(
                onPressed: saving
                    ? null
                    : () async {
                        update(() {
                          saving = true;
                          error = null;
                        });
                        final failure = await bank.setCardControls(cardId, {
                          key: null,
                        });
                        if (!dialog.mounted) return;
                        if (failure != null) {
                          update(() {
                            saving = false;
                            error = failure;
                          });
                          return;
                        }
                        Navigator.pop(dialog);
                      },
                child: const Text('Use bank limit'),
              ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      final cents = Money.parse(amount);
                      if (cents == null ||
                          cents < 0 ||
                          (ceiling is num && cents > ceiling)) {
                        update(
                          () => error =
                              'Enter a nonnegative amount within the bank’s limit.',
                        );
                        return;
                      }
                      update(() {
                        saving = true;
                        error = null;
                      });
                      final failure = await bank.setCardControls(cardId, {
                        key: cents,
                      });
                      if (!dialog.mounted) return;
                      if (failure != null) {
                        update(() {
                          saving = false;
                          error = failure;
                        });
                        return;
                      }
                      Navigator.pop(dialog);
                    },
              child: const Text('Save'),
            ),
          ],
        ),
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
          child: Text(
            text,
            style: const TextStyle(
              color: SColors.ink2,
              fontSize: 12.5,
              height: 1.35,
            ),
          ),
        ),
        if (action != null)
          TextButton(
            onPressed: onAction,
            child: Text(
              action!,
              style: TextStyle(
                color: CurrentSetup.brand.primary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
      ],
    ),
  );
}

/// The same shipping shape already accepted by card order/replacement.
Future<Map<String, dynamic>?> _shippingAddress(
  BuildContext context, {
  Map<String, dynamic>? existing,
}) async {
  final address = existing?['address'] is Map
      ? existing!['address'] as Map
      : const {};
  var street = '${address['street1'] ?? ''}';
  var city = '${address['city'] ?? ''}';
  var state = '${address['state'] ?? ''}';
  var zip = '${address['zip'] ?? ''}';
  var country = '${address['country'] ?? 'US'}';
  String? error;
  final result = await showDialog<Map<String, dynamic>>(
    context: context,
    builder: (dialog) => StatefulBuilder(
      builder: (dialog, update) => AlertDialog(
        title: const Text('Shipping address'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: street,
                onChanged: (value) => street = value,
                decoration: const InputDecoration(labelText: 'Street address'),
              ),
              TextFormField(
                initialValue: city,
                onChanged: (value) => city = value,
                decoration: const InputDecoration(labelText: 'City'),
              ),
              TextFormField(
                initialValue: state,
                onChanged: (value) => state = value,
                decoration: const InputDecoration(labelText: 'State or region'),
              ),
              TextFormField(
                initialValue: zip,
                onChanged: (value) => zip = value,
                decoration: const InputDecoration(labelText: 'Postal code'),
              ),
              TextFormField(
                initialValue: country,
                onChanged: (value) => country = value,
                decoration: const InputDecoration(labelText: 'Country code'),
              ),
              if (error != null)
                Text(error!, style: const TextStyle(color: SColors.danger)),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if ([
                street,
                city,
                state,
                zip,
                country,
              ].any((field) => field.trim().isEmpty)) {
                update(() => error = 'Complete the shipping address.');
                return;
              }
              Navigator.pop(dialog, {
                'address': {
                  'street1': street.trim(),
                  'city': city.trim(),
                  'state': state.trim(),
                  'zip': zip.trim(),
                  'country': country.trim().toUpperCase(),
                },
              });
            },
            child: const Text('Use this address'),
          ),
        ],
      ),
    ),
  );
  return result;
}
