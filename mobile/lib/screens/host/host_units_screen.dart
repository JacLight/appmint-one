import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../providers/custody_provider.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';

/// Physical numbered units behind a listing (locker A-142, bay 7). Optional —
/// a shelf that holds 20 bags just uses capacity, no units.
class HostUnitsScreen extends StatefulWidget {
  final StowboHost host;
  const HostUnitsScreen({super.key, required this.host});
  @override
  State<HostUnitsScreen> createState() => _HostUnitsScreenState();
}

class _HostUnitsScreenState extends State<HostUnitsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<CustodyProvider>().loadUnits(widget.host.sk));
  }

  Future<void> _add() async {
    final numCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Add a unit'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: numCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                  labelText: 'Unit number', hintText: 'A-142 / Bay 7'),
            ),
            const SizedBox(height: SSpace.sm),
            TextField(
              controller: codeCtrl,
              decoration: const InputDecoration(
                  labelText: 'Access code (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Add')),
        ],
      ),
    );
    if (ok != true || numCtrl.text.trim().isEmpty) return;
    final done = await context.read<CustodyProvider>().createUnit(
          listing: widget.host.sk,
          unitNumber: numCtrl.text.trim(),
          accessCode:
              codeCtrl.text.trim().isEmpty ? null : codeCtrl.text.trim(),
        );
    if (!mounted) return;
    if (done) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Unit ${numCtrl.text.trim()} added'),
          backgroundColor: SColors.green));
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(context.read<CustodyProvider>().error ??
              'Could not add unit'),
          backgroundColor: SColors.danger));
    }
  }

  /// Tap a unit → change its status (put a bay in maintenance, overlock a
  /// locker, retire a slot). Was impossible before — the rows did nothing.
  Future<void> _editUnit(Map<String, dynamic> unit) async {
    final id = (unit['sk'] ?? unit['id'] ?? '').toString();
    if (id.isEmpty) return;
    final d = (unit['data'] is Map)
        ? Map<String, dynamic>.from(unit['data'])
        : unit;
    final label = (d['unitNumber'] ?? d['name'] ?? 'Unit').toString();
    final current = (d['status'] ?? 'vacant').toString();
    const options = ['vacant', 'maintenance', 'overlocked', 'retired'];
    final chosen = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.xl, SSpace.lg, SSpace.xl, SSpace.sm),
              child: Text('Unit $label',
                  style: Theme.of(ctx).textTheme.titleLarge),
            ),
            ...options.map((s) => ListTile(
                  leading: Icon(
                      s == current
                          ? Icons.radio_button_checked_rounded
                          : Icons.radio_button_unchecked_rounded,
                      color: _statusColor(s)),
                  title: Text(s[0].toUpperCase() + s.substring(1)),
                  onTap: () => Navigator.pop(ctx, s),
                )),
            const SizedBox(height: SSpace.sm),
          ],
        ),
      ),
    );
    if (chosen == null || chosen == current) return;
    try {
      await stowboApi.updateUnit(id, {'status': chosen});
      if (!mounted) return;
      await context.read<CustodyProvider>().loadUnits(widget.host.sk);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Unit $label → $chosen'),
          backgroundColor: SColors.green));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'occupied':
        return SColors.green;
      case 'reserved':
        return SColors.amber;
      case 'maintenance':
      case 'overlocked':
        return SColors.danger;
      default:
        return SColors.muted; // vacant
    }
  }

  @override
  Widget build(BuildContext context) {
    final cp = context.watch<CustodyProvider>();
    final units = cp.units;
    return Scaffold(
      appBar: AppBar(title: Text('${widget.host.name} · Units')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: SColors.green,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Add unit',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: cp.loading && units.isEmpty
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : units.isEmpty
              ? const EmptyState(
                  icon: Icons.grid_view_rounded,
                  title: 'No units yet',
                  subtitle:
                      'Add numbered units only where a slot has an identity — a door, a locker, a bay. A shelf just uses capacity.',
                )
              : Column(children: [
                  // Make the either/or legible: once units exist the space is
                  // sized by them, and the listing's capacity number is ignored.
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(
                        SSpace.xl, SSpace.lg, SSpace.xl, 0),
                    padding: const EdgeInsets.all(SSpace.md),
                    decoration: BoxDecoration(
                        color: SColors.claySoft,
                        borderRadius: BorderRadius.circular(SRadius.md)),
                    child: Text(
                        'Sized by these ${units.length} '
                        '${units.length == 1 ? 'unit' : 'units'} — the '
                        'listing\'s capacity number is ignored while units exist.',
                        style: const TextStyle(
                            color: SColors.clay, fontSize: 12.5)),
                  ),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.all(SSpace.xl),
                      itemCount: units.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: SSpace.sm),
                  itemBuilder: (_, i) {
                    final d = (units[i]['data'] is Map)
                        ? Map<String, dynamic>.from(units[i]['data'])
                        : units[i];
                    final status = (d['status'] ?? 'vacant').toString();
                    return SCard(
                      onTap: () => _editUnit(units[i]),
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.lg, vertical: SSpace.md),
                      child: Row(children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                              color: _statusColor(status)
                                  .withValues(alpha: 0.14),
                              borderRadius:
                                  BorderRadius.circular(SRadius.md)),
                          child: Icon(Icons.door_front_door_rounded,
                              color: _statusColor(status), size: 22),
                        ),
                        const SizedBox(width: SSpace.md),
                        Expanded(
                          child: Text(
                              (d['unitNumber'] ?? d['name'] ?? 'Unit')
                                  .toString(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700)),
                        ),
                        Text(status,
                            style: TextStyle(
                                color: _statusColor(status),
                                fontWeight: FontWeight.w600,
                                fontSize: 13)),
                      ]),
                    );
                  },
                    ),
                  ),
                ]),
    );
  }
}
