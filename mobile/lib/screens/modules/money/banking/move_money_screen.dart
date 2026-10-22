import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import 'banking_widgets.dart';
import 'payees_screen.dart';

/// The three ways money moves, which are three different things and are not
/// pretended to be one:
///
///  * **transfer** — to another account at this bank, by account number
///  * **pay** — to a payee somewhere else, on a rail they chose
///  * **pull** — bring money in from an account of mine elsewhere
enum MoveMode { transfer, pay, pull }

class MoveMoneyScreen extends StatefulWidget {
  final MoveMode mode;
  final Map<String, dynamic>? from;
  const MoveMoneyScreen({super.key, required this.mode, this.from});

  @override
  State<MoveMoneyScreen> createState() => _MoveMoneyScreenState();
}

class _MoveMoneyScreenState extends State<MoveMoneyScreen> {
  late MoveMode _mode = widget.mode;
  final _amount = TextEditingController();
  final _memo = TextEditingController();
  final _toNumber = TextEditingController();

  String? _fromId;
  String? _payeeId;
  String _rail = 'ach';
  bool _sameDay = false;
  String? _error;
  String? _done;

  static const _rails = ['ach', 'wire', 'rtp', 'fednow'];

  @override
  void initState() {
    super.initState();
    final b = context.read<BankingProvider>();
    _fromId = widget.from != null
        ? BankingProvider.idOf(widget.from!)
        : b.accounts.isEmpty
            ? null
            : BankingProvider.idOf(b.accounts.first);
    final verified = b.verifiedPayees;
    if (verified.isNotEmpty) _payeeId = BankingProvider.idOf(verified.first);
  }

  @override
  void dispose() {
    _amount.dispose();
    _memo.dispose();
    _toNumber.dispose();
    super.dispose();
  }

  int? get _cents => Money.parse(_amount.text);

  /// What this account can actually spend right now, straight off the record.
  int? get _spendable {
    final b = context.read<BankingProvider>();
    for (final a in b.accounts) {
      if (BankingProvider.idOf(a) == _fromId) {
        final balances = a['balances'];
        final value = balances is Map ? balances['spendable'] : null;
        return value is num ? value.round() : null;
      }
    }
    return null;
  }

  bool get _ready {
    final cents = _cents;
    if (cents == null || cents <= 0 || _fromId == null) return false;
    return switch (_mode) {
      MoveMode.transfer => _toNumber.text.trim().length >= 4,
      MoveMode.pay => _payeeId != null,
      MoveMode.pull => _payeeId != null,
    };
  }

  Future<void> _send() async {
    final b = context.read<BankingProvider>();
    final cents = _cents!;
    setState(() {
      _error = null;
      _done = null;
    });

    final err = switch (_mode) {
      MoveMode.transfer => await b.transfer(
          from: _fromId!,
          toAccountNumber: _toNumber.text.trim(),
          amountCents: cents,
          memo: _memo.text.trim(),
        ),
      MoveMode.pay => await b.pay(
          account: _fromId!,
          counterparty: _payeeId!,
          rail: _rail,
          amountCents: cents,
          sameDay: _sameDay,
          memo: _memo.text.trim(),
        ),
      MoveMode.pull => await b.pull(
          account: _fromId!,
          counterparty: _payeeId!,
          amountCents: cents,
        ),
    };

    if (!mounted) return;
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    setState(() {
      _done = Money.format(cents, currency: b.currency);
      _amount.clear();
      _memo.clear();
      _toNumber.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final spendable = _spendable;
    final cents = _cents;
    final tooMuch =
        cents != null && spendable != null && cents > spendable;

    if (_done != null) return _Sent(amount: _done!, mode: _mode);

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text(
          switch (_mode) {
            MoveMode.transfer => 'Transfer',
            MoveMode.pay => 'Send money',
            MoveMode.pull => 'Add money',
          },
          style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w700, color: SColors.ink),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.sm, SSpace.lg, SSpace.xxl),
        children: [
          SegmentedButton<MoveMode>(
            segments: const [
              ButtonSegment(value: MoveMode.transfer, label: Text('Here')),
              ButtonSegment(value: MoveMode.pay, label: Text('Out')),
              ButtonSegment(value: MoveMode.pull, label: Text('In')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() {
              _mode = s.first;
              _error = null;
            }),
            style: SegmentedButton.styleFrom(
              selectedBackgroundColor: brand.primary,
              selectedForegroundColor: Colors.white,
            ),
          ),
          const SizedBox(height: SSpace.xl),

          // ── The amount, which is what this screen is about ──────────────
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 280),
              child: TextField(
                controller: _amount,
                autofocus: true,
                textAlign: TextAlign.center,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
                style: TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w800,
                  color: tooMuch ? SColors.danger : SColors.ink,
                ),
                decoration: const InputDecoration(
                  hintText: '0.00',
                  prefixText: '\$',
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
              ),
            ),
          ),
          Center(
            child: Text(
              spendable == null
                  ? 'Enter an amount'
                  : tooMuch
                      ? 'More than the ${Money.format(spendable, currency: b.currency)} you can spend'
                      : '${Money.format(spendable, currency: b.currency)} available to spend',
              style: TextStyle(
                color: tooMuch ? SColors.danger : SColors.muted,
                fontSize: 12.5,
              ),
            ),
          ),
          const SizedBox(height: SSpace.xl),

          // ── From ────────────────────────────────────────────────────────
          const _Label('From'),
          const SizedBox(height: SSpace.sm),
          for (final a in b.accounts)
            PickRow(
              title: accountTitle(a),
              subtitle: '${accountTail(a)} · ${_available(a, b.currency)}',
              selected: _fromId == BankingProvider.idOf(a),
              onTap: () =>
                  setState(() => _fromId = BankingProvider.idOf(a)),
            ),
          const SizedBox(height: SSpace.lg),

          // ── To ──────────────────────────────────────────────────────────
          if (_mode == MoveMode.transfer) ...[
            const _Label('To which account here'),
            const SizedBox(height: SSpace.sm),
            TextField(
              controller: _toNumber,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Account number',
                helperText: 'The number of an account at this bank',
              ),
            ),
          ] else ...[
            Row(
              children: [
                _Label(_mode == MoveMode.pay ? 'To' : 'From elsewhere'),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => const PayeesScreen())),
                  child: Text('Manage',
                      style: TextStyle(
                          color: brand.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13)),
                ),
              ],
            ),
            if (b.verifiedPayees.isEmpty)
              Container(
                padding: const EdgeInsets.all(SSpace.md),
                decoration: BoxDecoration(
                  color: SColors.paper2,
                  borderRadius: BorderRadius.circular(SRadius.md),
                ),
                child: Text(
                  b.payees.isEmpty
                      ? 'No payees yet. Add one, then confirm the two small '
                          'deposits the bank sends to it.'
                      : 'None of your payees are verified yet. Confirm the '
                          'two small deposits to use one.',
                  style: const TextStyle(
                      color: SColors.ink2, fontSize: 12.5, height: 1.4),
                ),
              )
            else
              for (final p in b.verifiedPayees)
                PickRow(
                  title: '${p['holderName'] ?? p['name'] ?? 'Payee'}',
                  subtitle: [
                    if ('${p['bankName'] ?? ''}'.isNotEmpty) '${p['bankName']}',
                    if ('${p['accountNumber'] ?? ''}'.isNotEmpty)
                      '${p['accountNumber']}',
                  ].join(' · '),
                  selected: _payeeId == BankingProvider.idOf(p),
                  onTap: () =>
                      setState(() => _payeeId = BankingProvider.idOf(p)),
                ),
            if (_mode == MoveMode.pay) ...[
              const SizedBox(height: SSpace.lg),
              const _Label('How it goes'),
              const SizedBox(height: SSpace.sm),
              Wrap(
                spacing: SSpace.sm,
                children: [
                  for (final r in _rails)
                    ChoiceChip(
                      label: Text(r.toUpperCase()),
                      selected: _rail == r,
                      onSelected: (_) => setState(() => _rail = r),
                      selectedColor: brand.primary,
                      labelStyle: TextStyle(
                        color: _rail == r ? Colors.white : SColors.ink2,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
              if (_rail == 'ach')
                SwitchListTile(
                  value: _sameDay,
                  onChanged: (v) => setState(() => _sameDay = v),
                  activeTrackColor: brand.primary,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Same day',
                      style: TextStyle(fontSize: 14)),
                  subtitle: const Text('Usually costs more',
                      style: TextStyle(color: SColors.muted, fontSize: 12)),
                ),
            ],
          ],

          if (_mode != MoveMode.pull) ...[
            const SizedBox(height: SSpace.lg),
            TextField(
              controller: _memo,
              decoration: const InputDecoration(labelText: 'Memo (optional)'),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: SSpace.lg),
            ModuleError(message: _error!),
          ],
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.md, SSpace.lg, SSpace.md),
        decoration: const BoxDecoration(
          color: SColors.card,
          border: Border(top: BorderSide(color: SColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: brand.primary,
                disabledBackgroundColor: SColors.line,
                padding: const EdgeInsets.symmetric(vertical: SSpace.md + 4),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              // Over-balance is left to the server to refuse — it knows about
              // overdraft, holds and limits — but the button says so first.
              onPressed: b.busy || !_ready ? null : _send,
              child: b.busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      switch (_mode) {
                        MoveMode.transfer => 'Transfer',
                        MoveMode.pay => 'Send',
                        MoveMode.pull => 'Bring it in',
                      },
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ),
      ),
    );
  }

  static String _available(Map<String, dynamic> account, String currency) {
    final balances = account['balances'];
    final value = balances is Map ? balances['available'] : null;
    return value == null
        ? 'balance unknown'
        : Money.format(value, currency: currency);
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          fontSize: 12.5, fontWeight: FontWeight.w800, color: SColors.ink));
}

class _Sent extends StatelessWidget {
  final String amount;
  final MoveMode mode;
  const _Sent({required this.amount, required this.mode});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 74,
                height: 74,
                decoration: const BoxDecoration(
                    color: SColors.greenSoft, shape: BoxShape.circle),
                child: const Icon(Icons.check_rounded,
                    size: 36, color: SColors.green),
              ),
              const SizedBox(height: SSpace.xl),
              Text(amount,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: brand.displayFont,
                  )),
              const SizedBox(height: SSpace.sm),
              Text(
                switch (mode) {
                  MoveMode.transfer => 'Transferred. It shows on both '
                      'accounts straight away.',
                  MoveMode.pay => 'Sent. It will show as pending until it '
                      'settles on the rail you chose.',
                  MoveMode.pull => 'On its way in. It settles in a few '
                      'business days.',
                },
                textAlign: TextAlign.center,
                style: const TextStyle(
                    color: SColors.muted, height: 1.45, fontSize: 14),
              ),
              const SizedBox(height: SSpace.xxl),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: brand.primary,
                  padding: const EdgeInsets.symmetric(
                      horizontal: SSpace.xxl, vertical: SSpace.md + 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill)),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Done',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
