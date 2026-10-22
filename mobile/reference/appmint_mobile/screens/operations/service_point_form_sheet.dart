import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/haho_theme.dart';
import '../../models/operations_reservation_model.dart';
import '../../providers/operations_provider.dart';

/// Service point create / edit sheet. Pass [existing] to edit; null to create.
/// Submits via OperationsProvider.saveServicePoint which routes to create
/// or update based on whether sk is empty.
class ServicePointFormSheet extends StatefulWidget {
  final ServicePoint? existing;
  const ServicePointFormSheet({super.key, this.existing});

  @override
  State<ServicePointFormSheet> createState() => _ServicePointFormSheetState();
}

class _ServicePointFormSheetState extends State<ServicePointFormSheet> {
  final _name = TextEditingController();
  final _displayName = TextEditingController();
  final _kind = TextEditingController();
  final _capacity = TextEditingController();
  final _sortOrder = TextEditingController();
  String? _parentName;
  bool _bookable = true;
  bool _isActive = true;

  // Curated kind vocabulary — matches the desktop dropdown so `kind` filters
  // line up across clients.
  static const _kindOptions = [
    'section', 'floor', 'room', 'table', 'seat', 'counter', 'bar', 'patio', 'other',
  ];

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _name.text = e.name;
      _displayName.text = e.displayName ?? '';
      _kind.text = e.kind ?? '';
      _capacity.text = e.capacity?.toString() ?? '';
      _sortOrder.text = e.sortOrder?.toString() ?? '';
      _parentName = e.parentName;
      _bookable = e.bookable;
      _isActive = e.isActive;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _displayName.dispose();
    _kind.dispose();
    _capacity.dispose();
    _sortOrder.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    final ops = context.read<OperationsProvider>();
    final e = widget.existing;
    final sp = ServicePoint(
      sk: e?.sk ?? '',
      name: name,
      displayName: _displayName.text.trim().isEmpty ? null : _displayName.text.trim(),
      kind: _kind.text.trim().isEmpty ? null : _kind.text.trim(),
      capacity: num.tryParse(_capacity.text.trim()),
      sortOrder: num.tryParse(_sortOrder.text.trim()),
      parentName: _parentName,
      businessLocationId: e?.businessLocationId ?? ops.businessLocationId,
      bookable: _bookable,
      isActive: _isActive,
      status: e?.status ?? 'available',
      // Preserve server-managed occupancy/audit + version on edit.
      currentTabId: e?.currentTabId,
      lastStatusChangeAt: e?.lastStatusChangeAt,
      lastStatusReason: e?.lastStatusReason,
      version: e?.version,
      shape: e?.shape,
      x: e?.x, y: e?.y, width: e?.width, height: e?.height,
      rotation: e?.rotation, color: e?.color,
      currentReservationId: e?.currentReservationId,
      currentServerId: e?.currentServerId,
      currentPartySize: e?.currentPartySize,
      seatedAt: e?.seatedAt,
      estimatedEndTime: e?.estimatedEndTime,
      features: e?.features ?? const [],
      level: e?.level,
    );
    final ok = await ops.saveServicePoint(sp);
    if (ok && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e == null ? 'Created $name' : 'Updated $name')),
      );
    }
  }

  Future<void> _delete() async {
    final e = widget.existing;
    if (e == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete service point?'),
        content: Text('${e.displayLabel} will be permanently removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: HaHoColors.error)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final ops = context.read<OperationsProvider>();
    final removed = await ops.deleteServicePoint(e.sk);
    if (removed && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Deleted ${e.displayLabel}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ops = context.watch<OperationsProvider>();
    final isEdit = widget.existing != null;
    // Parent options = every other SP at this venue (can't be its own parent).
    final parents = ops.servicePoints
        .where((sp) => widget.existing == null || sp.sk != widget.existing!.sk)
        .toList()
      ..sort((a, b) => a.displayLabel.compareTo(b.displayLabel));

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Column(children: [
        Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          width: 40, height: 4,
          decoration: BoxDecoration(
            color: HaHoColors.border,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
          child: Row(children: [
            Icon(isEdit ? Icons.edit : Icons.add_location_alt_outlined,
                color: HaHoColors.primary),
            const SizedBox(width: HaHoSpacing.sm),
            Text(isEdit ? 'Edit service point' : 'New service point',
                style: HaHoTextStyles.h3),
          ]),
        ),
        const SizedBox(height: HaHoSpacing.md),
        Expanded(
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
            children: [
              TextField(
                controller: _name,
                autofocus: !isEdit,
                decoration: const InputDecoration(
                  labelText: 'Name (id) *',
                  hintText: 'e.g. T7, Bay-3, Counter5',
                ),
              ),
              const SizedBox(height: HaHoSpacing.md),
              TextField(
                controller: _displayName,
                decoration: const InputDecoration(
                  labelText: 'Display name',
                  hintText: 'Shown in the UI — defaults to Name',
                ),
              ),
              const SizedBox(height: HaHoSpacing.md),
              TextField(
                controller: _kind,
                decoration: const InputDecoration(
                  labelText: 'Kind',
                  hintText: 'table, room, bay, counter, seat, section…',
                ),
              ),
              const SizedBox(height: HaHoSpacing.sm),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: _kindOptions.map((k) => ActionChip(
                  label: Text(k, style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                  onPressed: () => setState(() => _kind.text = k),
                )).toList(),
              ),
              const SizedBox(height: HaHoSpacing.md),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _capacity,
                    decoration: const InputDecoration(labelText: 'Capacity'),
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: HaHoSpacing.md),
                Expanded(
                  child: TextField(
                    controller: _sortOrder,
                    decoration: const InputDecoration(labelText: 'Sort order'),
                    keyboardType: TextInputType.number,
                  ),
                ),
              ]),
              const SizedBox(height: HaHoSpacing.md),
              DropdownButtonFormField<String?>(
                initialValue: _parentName,
                decoration: const InputDecoration(
                  labelText: 'Parent (for hierarchy)',
                ),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('No parent (top level)')),
                  ...parents.map((p) => DropdownMenuItem<String?>(
                        value: p.name,
                        child: Text(p.displayLabel, overflow: TextOverflow.ellipsis),
                      )),
                ],
                onChanged: (v) => setState(() => _parentName = v),
              ),
              const SizedBox(height: HaHoSpacing.sm),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Bookable'),
                subtitle: const Text('Guests can reserve this spot'),
                value: _bookable,
                activeThumbColor: HaHoColors.primary,
                onChanged: (v) => setState(() => _bookable = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Active'),
                subtitle: const Text('Shown on the floor & in service'),
                value: _isActive,
                activeThumbColor: HaHoColors.primary,
                onChanged: (v) => setState(() => _isActive = v),
              ),
              if (ops.error != null) ...[
                const SizedBox(height: HaHoSpacing.md),
                Container(
                  padding: const EdgeInsets.all(HaHoSpacing.sm),
                  decoration: BoxDecoration(
                    color: HaHoColors.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(HaHoRadius.md),
                  ),
                  child: Text(ops.error!,
                      style: HaHoTextStyles.caption.copyWith(color: HaHoColors.error)),
                ),
              ],
              const SizedBox(height: HaHoSpacing.lg),
            ],
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(
            HaHoSpacing.lg, HaHoSpacing.md, HaHoSpacing.lg,
            MediaQuery.of(context).padding.bottom + HaHoSpacing.md,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: HaHoColors.border)),
          ),
          child: Row(children: [
            if (isEdit)
              Padding(
                padding: const EdgeInsets.only(right: HaHoSpacing.sm),
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: HaHoColors.error,
                    side: const BorderSide(color: HaHoColors.error),
                    padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.md, vertical: HaHoSpacing.md),
                  ),
                  onPressed: ops.busy ? null : _delete,
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: const Text('Delete'),
                ),
              ),
            Expanded(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: HaHoColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
                ),
                onPressed: ops.busy ? null : _save,
                child: ops.busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isEdit ? 'Save changes' : 'Create'),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}
