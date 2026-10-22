import 'package:flutter/material.dart';
import '../config/haho_theme.dart';
import '../models/contact_model.dart';
import '../services/communications_service.dart';

/// Bottom sheet that lists customers/contacts from the server and lets the user pick one.
/// Filters to contacts that have the field required by [requireField]: 'phone' or 'email'.
class ContactPickerSheet extends StatefulWidget {
  /// 'phone' or 'email' — only contacts with this field populated will be shown.
  final String requireField;
  final String title;

  const ContactPickerSheet({
    super.key,
    required this.requireField,
    this.title = 'Select Contact',
  });

  /// Shows the sheet and returns the selected contact map (raw data) or null if cancelled.
  static Future<Map<String, dynamic>?> show(BuildContext context, {required String requireField, String title = 'Select Contact'}) {
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(HaHoRadius.lg))),
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.85,
        child: ContactPickerSheet(requireField: requireField, title: title),
      ),
    );
  }

  @override
  State<ContactPickerSheet> createState() => _ContactPickerSheetState();
}

class _ContactPickerSheetState extends State<ContactPickerSheet> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _contacts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({String? search}) async {
    setState(() { _loading = true; _error = null; });
    try {
      final raw = await communicationsService.getContacts(search: search);
      // Filter to only contacts with the required field populated
      final filtered = raw.where((c) {
        final d = c['data'] as Map<String, dynamic>?;
        if (d == null) return false;
        final v = d[widget.requireField];
        return v != null && v.toString().trim().isNotEmpty;
      }).toList();
      // A customer list reads by last name, then first name.
      String key(Map<String, dynamic> c) {
        final d = c['data'] as Map<String, dynamic>? ?? const {};
        return '${d['lastName'] ?? ''} ${d['firstName'] ?? ''} ${d['name'] ?? ''}'.trim().toLowerCase();
      }
      filtered.sort((a, b) => key(a).compareTo(key(b)));
      if (!mounted) return;
      setState(() { _contacts = filtered; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString().replaceAll('Exception: ', ''); _loading = false; });
    }
  }

  String _displayName(Map<String, dynamic> d) {
    final first = (d['firstName'] ?? '').toString().trim();
    final last = (d['lastName'] ?? '').toString().trim();
    final full = '$first $last'.trim();
    if (full.isNotEmpty) return full;
    return (d['name'] ?? d['email'] ?? d['phone'] ?? 'Unknown').toString();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: HaHoColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(HaHoRadius.lg)),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(color: HaHoColors.textGray.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(HaHoSpacing.lg, HaHoSpacing.md, HaHoSpacing.sm, HaHoSpacing.sm),
            child: Row(children: [
              Text(widget.title, style: HaHoTextStyles.h4),
              const Spacer(),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ]),
          ),
          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search contacts...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: HaHoColors.cardLight,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(HaHoRadius.md), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onChanged: (v) => _load(search: v),
            ),
          ),
          const SizedBox(height: HaHoSpacing.sm),
          // List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: HaHoColors.primary))
                : _error != null
                    ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.cloud_off, size: 48, color: HaHoColors.textGray),
                        const SizedBox(height: 8),
                        Text(_error!, style: HaHoTextStyles.bodySmall, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: () => _load(search: _searchCtrl.text), child: const Text('Retry')),
                      ]))
                    : _contacts.isEmpty
                        ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.person_off_outlined, size: 56, color: HaHoColors.textGray.withValues(alpha: 0.4)),
                            const SizedBox(height: 8),
                            Text('No contacts with ${widget.requireField}', style: HaHoTextStyles.bodySmall.copyWith(color: HaHoColors.textGray)),
                          ]))
                        : ListView.builder(
                            padding: const EdgeInsets.only(bottom: 24),
                            itemCount: _contacts.length,
                            itemBuilder: (_, i) {
                              final c = _contacts[i];
                              final d = c['data'] as Map<String, dynamic>? ?? {};
                              final name = _displayName(d);
                              final raw = (d[widget.requireField] ?? '').toString();
                              final value = widget.requireField == 'phone' ? ContactModel.formatPhone(raw) : raw;
                              final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: HaHoColors.primary.withValues(alpha: 0.15),
                                  child: Text(initials, style: const TextStyle(color: HaHoColors.primary, fontWeight: FontWeight.bold)),
                                ),
                                title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                                subtitle: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
                                onTap: () => Navigator.pop(context, c),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
