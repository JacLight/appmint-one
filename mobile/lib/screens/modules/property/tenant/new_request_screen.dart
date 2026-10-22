import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/sla_policy.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/tenancy_provider.dart';

/// Report a repair.
///
/// Three decisions and a sentence: what is broken, how bad it is, and whether
/// anyone may come in. The urgency choice shows the actual promise attached to
/// it, because a resident choosing "Emergency" is entitled to know what that
/// commits the office to — and a resident who sees "14 days" will not pick it
/// for a dripping tap.
class NewRequestScreen extends StatefulWidget {
  final Map<String, dynamic>? tenancy;
  const NewRequestScreen({super.key, this.tenancy});

  @override
  State<NewRequestScreen> createState() => _NewRequestScreenState();
}

class _NewRequestScreenState extends State<NewRequestScreen> {
  static const _categories = <({String label, IconData icon, String hint})>[
    (label: 'Plumbing', icon: Icons.water_damage_rounded, hint: 'Leak, blockage, no water'),
    (label: 'Heating / AC', icon: Icons.thermostat_rounded, hint: 'No heat, no cooling'),
    (label: 'Electrical', icon: Icons.electrical_services_rounded, hint: 'Power, sockets, lights'),
    (label: 'Appliance', icon: Icons.kitchen_rounded, hint: 'Fridge, oven, washer'),
    (label: 'Door / Lock', icon: Icons.lock_rounded, hint: 'Will not lock, lost key'),
    (label: 'Pest', icon: Icons.pest_control_rounded, hint: 'Insects, rodents'),
    (label: 'Common area', icon: Icons.stairs_rounded, hint: 'Hall, lift, bins, parking'),
    (label: 'Something else', icon: Icons.build_rounded, hint: ''),
  ];

  String? _category;
  String _priority = 'medium';
  final _what = TextEditingController();
  final _access = TextEditingController();
  bool _mayEnter = false;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _what.dispose();
    _access.dispose();
    super.dispose();
  }

  String get _unit {
    final t = widget.tenancy;
    if (t == null) return '';
    final items = t['items'];
    final first = items is List && items.isNotEmpty && items.first is Map
        ? Map<String, dynamic>.from(items.first)
        : const {};
    return '${first['unitNumber'] ?? first['unit'] ?? t['unit'] ?? ''}'.trim();
  }

  String get _building {
    final t = widget.tenancy;
    if (t == null) return '';
    final items = t['items'];
    final first = items is List && items.isNotEmpty && items.first is Map
        ? Map<String, dynamic>.from(items.first)
        : const {};
    return '${first['listing'] ?? t['listing'] ?? ''}'.trim();
  }

  bool get _valid =>
      _category != null && _what.text.trim().length >= 8;

  Future<void> _send() async {
    final user = context.read<AuthProvider>().user;
    final name = (user?.displayName ?? '').trim();
    final email = user?.email ?? '';
    if (email.isEmpty) {
      setState(() => _error =
          'Sign in before reporting a repair — the office needs a way to reach you.');
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    final err = await context.read<TenancyProvider>().raiseRequest(
          title: '$_category: ${_firstLine(_what.text)}',
          description: _what.text.trim(),
          priority: _priority,
          reportedBy: name.isEmpty ? email : name,
          reportedByEmail: email,
          reportedByPhone: user?.phone,
          unit: _unit,
          building: _building,
          mayEnter: _mayEnter,
          access: _access.text.trim(),
        );

    if (!mounted) return;
    if (err != null) {
      setState(() {
        _sending = false;
        _error = err;
      });
      return;
    }
    Navigator.of(context).pop(true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: SColors.green,
        content: Text(
          'Reported. ${SlaPolicy.forPriority(_priority).label}: response within '
          '${_hours(SlaPolicy.forPriority(_priority).respond)}.',
        ),
      ),
    );
  }

  static String _firstLine(String s) {
    final t = s.trim().split('\n').first.trim();
    return t.length <= 48 ? t : '${t.substring(0, 45)}…';
  }

  static String _hours(Duration d) =>
      d.inHours >= 24 ? '${d.inDays} day${d.inDays == 1 ? '' : 's'}' : '${d.inHours} hours';

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text('Report a repair',
            style: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.sm, SSpace.lg, SSpace.xxl),
        children: [
          if (_unit.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: SSpace.lg),
              child: Row(
                children: [
                  const Icon(Icons.home_rounded, size: 15, color: SColors.muted),
                  const SizedBox(width: SSpace.sm),
                  Text('For ${words.lower(LexiconKeys.unit)} $_unit',
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 12.5)),
                ],
              ),
            ),
          const _Label('What is it'),
          const SizedBox(height: SSpace.md),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: SSpace.sm,
            crossAxisSpacing: SSpace.sm,
            childAspectRatio: 0.82,
            children: [
              for (final c in _categories)
                _CategoryTile(
                  label: c.label,
                  icon: c.icon,
                  selected: _category == c.label,
                  onTap: () => setState(() {
                    _category = c.label;
                    if (_what.text.isEmpty && c.hint.isNotEmpty) {
                      // A hint in the box, not a value: it clears the moment
                      // they type, and nothing is submitted that they did not
                      // write.
                    }
                  }),
                ),
            ],
          ),
          const SizedBox(height: SSpace.xl),
          const _Label('Tell the office what is happening'),
          const SizedBox(height: SSpace.sm),
          TextField(
            controller: _what,
            maxLines: 5,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 14.5, color: SColors.ink),
            decoration: InputDecoration(
              hintText: _category == null
                  ? 'Pick what it is first'
                  : 'Where in the home, since when, how bad',
              hintStyle: const TextStyle(color: SColors.faint, fontSize: 13.5),
              filled: true,
              fillColor: SColors.card,
              contentPadding: const EdgeInsets.all(SSpace.md),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(SRadius.md),
                borderSide: const BorderSide(color: SColors.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(SRadius.md),
                borderSide: BorderSide(color: brand.primary, width: 1.4),
              ),
            ),
          ),
          const SizedBox(height: SSpace.xl),
          const _Label('How urgent'),
          const SizedBox(height: SSpace.md),
          for (final p in SlaPolicy.priorities)
            _PriorityRow(
              priority: p,
              selected: _priority == p,
              onTap: () => setState(() => _priority = p),
            ),
          const SizedBox(height: SSpace.xl),
          const _Label('Access'),
          const SizedBox(height: SSpace.md),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: SSpace.lg, vertical: SSpace.sm),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(color: SColors.line),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Enter if I am out',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: SColors.ink)),
                      Text('Maintenance may let themselves in',
                          style:
                              TextStyle(color: SColors.muted, fontSize: 11.5)),
                    ],
                  ),
                ),
                Switch(
                  value: _mayEnter,
                  onChanged: (v) => setState(() => _mayEnter = v),
                  activeTrackColor: brand.primary,
                ),
              ],
            ),
          ),
          const SizedBox(height: SSpace.md),
          TextField(
            controller: _access,
            style: const TextStyle(fontSize: 14, color: SColors.ink),
            decoration: InputDecoration(
              hintText: 'Best times, dog in the kitchen, buzzer is broken…',
              hintStyle: const TextStyle(color: SColors.faint, fontSize: 13),
              filled: true,
              fillColor: SColors.card,
              contentPadding: const EdgeInsets.all(SSpace.md),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(SRadius.md),
                borderSide: const BorderSide(color: SColors.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(SRadius.md),
                borderSide: BorderSide(color: brand.primary, width: 1.4),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: SSpace.lg),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 16, color: SColors.danger),
                const SizedBox(width: SSpace.sm),
                Expanded(
                  child: Text(_error!,
                      style: const TextStyle(
                          color: SColors.danger, fontSize: 12.5, height: 1.35)),
                ),
              ],
            ),
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
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _valid
                      ? '${SlaPolicy.forPriority(_priority).label} · response in '
                          '${_hours(SlaPolicy.forPriority(_priority).respond)}'
                      : 'Pick what it is and describe it',
                  style: const TextStyle(color: SColors.muted, fontSize: 12),
                ),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: brand.primary,
                  disabledBackgroundColor: SColors.line,
                  padding: const EdgeInsets.symmetric(
                      horizontal: SSpace.xl, vertical: SSpace.md + 2),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill)),
                ),
                onPressed: _sending || !_valid ? null : _send,
                child: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Send',
                        style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: SColors.ink,
          letterSpacing: 0.1));
}

class _CategoryTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _CategoryTile({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.xs, vertical: SSpace.sm),
        decoration: BoxDecoration(
          color: selected ? brand.primary : SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border:
              Border.all(color: selected ? brand.primary : SColors.line),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 21, color: selected ? Colors.white : brand.primary),
            const SizedBox(height: SSpace.sm),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: TextStyle(
                fontSize: 9.5,
                height: 1.15,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : SColors.ink2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A priority with the promise attached to it, in hours and days.
class _PriorityRow extends StatelessWidget {
  final String priority;
  final bool selected;
  final VoidCallback onTap;
  const _PriorityRow(
      {required this.priority, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = SlaPolicy.forPriority(priority);
    final brand = CurrentSetup.brand;
    final colour = switch (priority) {
      'urgent' => SColors.danger,
      'high' => SColors.amber,
      'medium' => brand.primary,
      _ => SColors.muted,
    };

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: SSpace.sm),
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: selected ? colour.withValues(alpha: 0.08) : SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(
              color: selected ? colour : SColors.line,
              width: selected ? 1.4 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: selected ? colour : SColors.faint,
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(t.label,
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: selected ? colour : SColors.ink)),
                      const Spacer(),
                      Text(
                        'Fix in ${t.resolve.inHours >= 24 ? '${t.resolve.inDays}d' : '${t.resolve.inHours}h'}',
                        style: TextStyle(
                            color: colour,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(t.meaning,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 11.5, height: 1.3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
