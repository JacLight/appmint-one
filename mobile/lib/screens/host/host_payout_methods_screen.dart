import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';

/// Where the host's money goes. Without at least one destination here a payout
/// request is refused by the server, so this screen is the first stop on the
/// Money tab, not an afterthought.
///
/// Two rails: a bank account (paid by ACH, 1-3 business days) and PayPal
/// (usually minutes). Bank numbers are encrypted server-side the moment they
/// arrive — only the last four ever comes back, which is why editing an account
/// means replacing it rather than correcting it in place.
class HostPayoutMethodsScreen extends StatefulWidget {
  const HostPayoutMethodsScreen({super.key});

  @override
  State<HostPayoutMethodsScreen> createState() => _HostPayoutMethodsScreenState();
}

class _HostPayoutMethodsScreenState extends State<HostPayoutMethodsScreen> {
  final StowboApi _api = StowboApi();
  List<Map<String, dynamic>> _methods = [];
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _api.payoutMethods();
      if (!mounted) return;
      setState(() {
        _methods = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _toast(String msg, {bool bad = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: bad ? SColors.danger : SColors.green,
    ));
  }

  Future<void> _add(String type) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddMethodSheet(type: type, isFirst: _methods.isEmpty),
    );
    if (added == true) {
      _toast(type == 'bank' ? 'Bank account added' : 'PayPal added');
      _load();
    }
  }

  Future<void> _makeDefault(Map<String, dynamic> m) async {
    final id = (m['id'] ?? '').toString();
    setState(() => _busyId = id);
    try {
      await _api.setDefaultPayoutMethod(id);
      _toast('Default updated');
      await _load();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), bad: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _remove(Map<String, dynamic> m) async {
    final label = (m['label'] ?? 'this destination').toString();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove destination'),
        content: Text(
            'Remove $label? Payouts already on their way are not affected — this only stops it being used again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove', style: TextStyle(color: SColors.danger)),
          ),
        ],
      ),
    );
    if (ok != true) return;

    setState(() => _busyId = (m['id'] ?? '').toString());
    try {
      await _api.removePayoutMethod((m['id'] ?? '').toString());
      _toast('Removed');
      await _load();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), bad: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(title: const Text('Payout destinations')),
      body: RefreshIndicator(
        color: SColors.clay,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: SColors.clay))
            : ListView(
                padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.lg, SSpace.xl, 120),
                children: [
                  if (_error != null) ...[
                    EmptyState(
                      icon: Icons.wifi_off_rounded,
                      title: "Couldn't load your destinations",
                      subtitle: _error,
                      action: OutlinedButton(onPressed: _load, child: const Text('Retry')),
                    ),
                  ] else if (_methods.isEmpty) ...[
                    const EmptyState(
                      icon: Icons.account_balance_outlined,
                      title: 'No payout destination yet',
                      subtitle:
                          'Add a bank account or PayPal so your earnings have somewhere to go. Payout requests are refused until one exists.',
                    ),
                  ] else ...[
                    const SectionLabel('YOUR DESTINATIONS'),
                    for (final m in _methods) _methodCard(m),
                    const SizedBox(height: SSpace.md),
                    const Text(
                      'The default is used when you request a payout without picking one.',
                      style: TextStyle(color: SColors.muted, fontSize: 12.5),
                    ),
                  ],
                  const SizedBox(height: SSpace.xl),
                  const SectionLabel('ADD A DESTINATION'),
                  SActionButton(
                    label: 'Add a bank account',
                    icon: Icons.account_balance_rounded,
                    onTap: () => _add('bank'),
                  ),
                  const SizedBox(height: SSpace.sm),
                  SActionButton(
                    label: 'Add PayPal',
                    icon: Icons.alternate_email_rounded,
                    filled: false,
                    onTap: () => _add('paypal'),
                  ),
                  const SizedBox(height: SSpace.md),
                  const Text(
                    'Bank payouts arrive in 1-3 business days. PayPal is usually minutes. '
                    'Account numbers are encrypted — we only ever show the last four.',
                    style: TextStyle(color: SColors.muted, fontSize: 12.5),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _methodCard(Map<String, dynamic> m) {
    final id = (m['id'] ?? '').toString();
    final type = (m['type'] ?? '').toString();
    final isDefault = m['isDefault'] == true;
    final status = (m['status'] ?? '').toString();
    final bank = m['bank'] is Map ? Map<String, dynamic>.from(m['bank']) : const {};
    final paypal = m['paypal'] is Map ? Map<String, dynamic>.from(m['paypal']) : const {};
    final busy = _busyId == id;

    final detail = type == 'bank'
        ? '${bank['bankName'] ?? 'Bank'} · ${bank['accountType'] ?? 'checking'} · ····${bank['accountNumberLast4'] ?? '····'}'
        : (paypal['email'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(
              type == 'bank' ? Icons.account_balance_rounded : Icons.alternate_email_rounded,
              size: 20,
              color: SColors.ink2,
            ),
            const SizedBox(width: SSpace.sm),
            Expanded(
              child: Text(
                (m['label'] ?? (type == 'bank' ? 'Bank account' : 'PayPal')).toString(),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ),
            if (isDefault)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: SColors.green.withValues(alpha: .14),
                  borderRadius: BorderRadius.circular(SRadius.pill),
                ),
                child: const Text('Default',
                    style: TextStyle(color: SColors.green, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
          ]),
          const SizedBox(height: 4),
          Text(detail, style: const TextStyle(color: SColors.muted, fontSize: 13)),
          // 'pending' is the platform's own state, not a bank rejection — say so
          // rather than leaving a scary bare word on screen.
          if (status == 'disabled')
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Disabled — this destination will not be used.',
                  style: TextStyle(color: SColors.danger, fontSize: 12.5)),
            )
          else if (status == 'pending')
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Not used yet — it will be confirmed on your first payout.',
                  style: TextStyle(color: SColors.muted, fontSize: 12.5)),
            ),
          const SizedBox(height: SSpace.sm),
          Row(children: [
            if (!isDefault)
              TextButton(
                onPressed: busy ? null : () => _makeDefault(m),
                child: const Text('Make default'),
              ),
            const Spacer(),
            TextButton(
              onPressed: busy ? null : () => _remove(m),
              child: busy
                  ? const SizedBox(
                      width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Remove', style: TextStyle(color: SColors.danger)),
            ),
          ]),
        ]),
      ),
    );
  }
}

/// Add form for one rail. Kept in one sheet with a `type` switch because the
/// two forms share their framing, their validation style and their submit.
class _AddMethodSheet extends StatefulWidget {
  final String type; // bank | paypal
  final bool isFirst;
  const _AddMethodSheet({required this.type, required this.isFirst});

  @override
  State<_AddMethodSheet> createState() => _AddMethodSheetState();
}

class _AddMethodSheetState extends State<_AddMethodSheet> {
  final _api = StowboApi();
  final _label = TextEditingController();
  final _holder = TextEditingController();
  final _bankName = TextEditingController();
  final _routing = TextEditingController();
  final _account = TextEditingController();
  final _email = TextEditingController();
  String _accountType = 'checking';
  bool _makeDefault = false;
  bool _saving = false;
  String? _error;

  bool get _isBank => widget.type == 'bank';

  @override
  void initState() {
    super.initState();
    // The first destination becomes the default anyway — show that rather than
    // letting the host think they still have to choose.
    _makeDefault = widget.isFirst;
  }

  @override
  void dispose() {
    for (final c in [_label, _holder, _bankName, _routing, _account, _email]) {
      c.dispose();
    }
    super.dispose();
  }

  /// The ABA checksum, so a typo is caught here instead of by the bank days
  /// later when the payout bounces.
  bool _validRouting(String r) {
    if (!RegExp(r'^\d{9}$').hasMatch(r)) return false;
    const w = [3, 7, 1, 3, 7, 1, 3, 7, 1];
    var sum = 0;
    for (var i = 0; i < 9; i++) {
      sum += int.parse(r[i]) * w[i];
    }
    return sum % 10 == 0;
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    if (_isBank) {
      final routing = _routing.text.trim();
      final account = _account.text.trim().replaceAll(RegExp(r'[\s-]'), '');
      if (_holder.text.trim().isEmpty) {
        setState(() => _error = 'Enter the name on the account.');
        return;
      }
      if (!_validRouting(routing)) {
        setState(() => _error =
            'That routing number is not valid. It is the 9-digit number on the bottom left of a cheque.');
        return;
      }
      if (account.length < 4) {
        setState(() => _error = 'Enter the account number.');
        return;
      }
      setState(() => _saving = true);
      try {
        await _api.addBankPayoutMethod(
          bankName: _bankName.text.trim().isEmpty ? 'Bank' : _bankName.text.trim(),
          accountType: _accountType,
          routingNumber: routing,
          accountNumber: account,
          accountHolderName: _holder.text.trim(),
          label: _label.text.trim(),
          isDefault: _makeDefault,
        );
        if (mounted) Navigator.pop(context, true);
      } catch (e) {
        if (mounted) {
          setState(() {
            _saving = false;
            _error = e.toString().replaceFirst('Exception: ', '');
          });
        }
      }
      return;
    }

    final email = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(() => _error = 'Enter the email address on your PayPal account.');
      return;
    }
    setState(() => _saving = true);
    try {
      await _api.addPaypalPayoutMethod(
        email: email,
        label: _label.text.trim(),
        isDefault: _makeDefault,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: SColors.paper,
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
        ),
        padding: const EdgeInsets.all(SSpace.xl),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_isBank ? 'Add a bank account' : 'Add PayPal',
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xs),
              Text(
                _isBank
                    ? 'Paid by ACH, usually 1-3 business days. Your account number is encrypted.'
                    : 'Paid to your PayPal balance, usually within minutes.',
                style: const TextStyle(color: SColors.muted, fontSize: 13),
              ),
              const SizedBox(height: SSpace.lg),
              if (_isBank) ...[
                TextField(
                  controller: _holder,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                      labelText: 'Name on the account', hintText: 'As your bank has it'),
                ),
                const SizedBox(height: SSpace.sm),
                TextField(
                  controller: _bankName,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Bank name (optional)'),
                ),
                const SizedBox(height: SSpace.sm),
                TextField(
                  controller: _routing,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() => _error = null),
                  decoration: const InputDecoration(
                      labelText: 'Routing number', hintText: '9 digits'),
                ),
                const SizedBox(height: SSpace.sm),
                TextField(
                  controller: _account,
                  keyboardType: TextInputType.number,
                  onChanged: (_) => setState(() => _error = null),
                  decoration: const InputDecoration(labelText: 'Account number'),
                ),
                const SizedBox(height: SSpace.sm),
                Row(children: [
                  for (final t in const ['checking', 'savings'])
                    Padding(
                      padding: const EdgeInsets.only(right: SSpace.sm),
                      child: ChoiceChip(
                        label: Text(t == 'checking' ? 'Checking' : 'Savings'),
                        selected: _accountType == t,
                        onSelected: (_) => setState(() => _accountType = t),
                      ),
                    ),
                ]),
              ] else ...[
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  onChanged: (_) => setState(() => _error = null),
                  decoration: const InputDecoration(
                      labelText: 'PayPal email', hintText: 'you@example.com'),
                ),
              ],
              const SizedBox(height: SSpace.sm),
              TextField(
                controller: _label,
                decoration: const InputDecoration(
                    labelText: 'Name it (optional)', hintText: 'e.g. Business checking'),
              ),
              const SizedBox(height: SSpace.xs),
              CheckboxListTile(
                value: _makeDefault,
                onChanged: widget.isFirst ? null : (v) => setState(() => _makeDefault = v ?? false),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(
                  widget.isFirst
                      ? 'This will be your default destination'
                      : 'Make this my default',
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: SSpace.xs),
                Text(_error!, style: const TextStyle(color: SColors.danger, fontSize: 13)),
              ],
              const SizedBox(height: SSpace.lg),
              SActionButton(
                icon: _isBank ? Icons.account_balance_rounded : Icons.alternate_email_rounded,
                label: _saving ? 'Saving…' : (_isBank ? 'Add bank account' : 'Add PayPal'),
                onTap: _saving ? null : _submit,
              ),
              const SizedBox(height: SSpace.sm),
            ],
          ),
        ),
      ),
    );
  }
}
