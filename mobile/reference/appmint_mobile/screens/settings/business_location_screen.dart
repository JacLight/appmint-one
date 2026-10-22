import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../providers/location_provider.dart';
import '../../services/repository_service.dart';
import '../../widgets/business_address_fields.dart';

/// Edit the existing location record shared by POS, reservations and readers.
class BusinessLocationScreen extends StatefulWidget {
  final Map<String, dynamic> location;
  final bool canEdit;
  const BusinessLocationScreen({
    super.key,
    required this.location,
    this.canEdit = false,
  });

  @override
  State<BusinessLocationScreen> createState() => _BusinessLocationScreenState();
}

class _BusinessLocationScreenState extends State<BusinessLocationScreen> {
  final _form = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _fields;
  late final Map<String, String> _original;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final data = widget.location['data'] as Map? ?? {};
    final address = data['address'] as Map? ?? {};
    // Older mobile builds accidentally wrote address fields at the record
    // root. Recover those entries in the form, then save to data.address.
    final misplaced = widget.location['address'] as Map? ?? {};
    _original = {
      'title': '${data['title'] ?? ''}',
      for (final field in [
        'street1',
        'street2',
        'city',
        'state',
        'zip',
        'country',
      ])
        'address.$field': '${address[field] ?? ''}',
    };
    _fields = _original.map((key, value) {
      final field = key.replaceFirst('address.', '');
      final recovered =
          (key == 'title' ? data['name'] : null) ??
          (field == 'state' ? address['region'] : null) ??
          misplaced[field] ??
          (field == 'state' ? misplaced['region'] : null);
      return MapEntry(
        key,
        TextEditingController(
          text: value.isNotEmpty ? value : '${recovered ?? ''}',
        ),
      );
    });
  }

  @override
  void dispose() {
    for (final controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!widget.canEdit || _saving || !_form.currentState!.validate()) return;
    final id = widget.location['sk']?.toString() ?? '';
    if (id.isEmpty) {
      setState(
        () => _error =
            'The saved location could not be identified. Reopen its settings.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final changes = <String, dynamic>{};
      for (final entry in _fields.entries) {
        var value = entry.value.text.trim();
        if (entry.key == 'address.country') value = value.toUpperCase();
        if (entry.key == 'address.state' &&
            _fields['address.country']!.text.trim().toUpperCase() == 'US') {
          value = value.toUpperCase();
        }
        if (value != _original[entry.key]) changes['data.${entry.key}'] = value;
      }
      // Patch only edited fields on this exact record. Preserve the location
      // slug, tax, hours, printer settings and all other shared configuration.
      if (changes.isNotEmpty) {
        await repositoryService.updatePartial('location', id, changes);
      }
      if (!mounted) return;
      await context.read<LocationProvider>().load();
      if (!mounted) return;
      final locations = context.read<LocationProvider>().locations;
      final saved = locations.where((record) => record['sk'] == id).firstOrNull;
      final savedData = saved?['data'] as Map? ?? {};
      final savedAddress = savedData['address'] as Map? ?? {};
      for (final entry in _fields.entries) {
        final actual = entry.key == 'title'
            ? savedData['title']
            : savedAddress[entry.key.replaceFirst('address.', '')];
        var expected = entry.value.text.trim();
        if (entry.key == 'address.country') expected = expected.toUpperCase();
        if (entry.key == 'address.state' &&
            _fields['address.country']!.text.trim().toUpperCase() == 'US') {
          expected = expected.toUpperCase();
        }
        if ('${actual ?? ''}' != expected) {
          throw StateError(
            'The server did not retain the location details. Please retry.',
          );
        }
      }
      setState(() => _saving = false);
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error =
            'Could not save: ${e.toString().replaceFirst('Exception: ', '')}';
      });
    }
  }

  Widget _field(
    String key,
    String label, {
    bool required = false,
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: _fields[key],
        enabled: widget.canEdit && !_saving,
        keyboardType: keyboardType,
        textCapitalization: key == 'address.country'
            ? TextCapitalization.characters
            : TextCapitalization.words,
        textInputAction: key == 'address.country'
            ? TextInputAction.done
            : TextInputAction.next,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        validator: (text) {
          final value = text?.trim() ?? '';
          if (required && value.isEmpty) return 'Enter $label';
          return null;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = _original['title']!;
    return PopScope(
      canPop: !_saving,
      child: Scaffold(
        backgroundColor: HaHoColors.background,
        appBar: AppBar(title: const Text('Business location')),
        body: SafeArea(
          child: Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(name, style: HaHoTextStyles.h3),
                const SizedBox(height: 8),
                Text(
                  'These saved details are shared by this location’s POS, reservations and card reader.',
                  style: HaHoTextStyles.body.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
                const SizedBox(height: 24),
                _field('title', 'Location name', required: true),
                BusinessAddressFields(
                  fields: _fields,
                  enabled: widget.canEdit && !_saving,
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: HaHoColors.error),
                    ),
                  ),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: !widget.canEdit || _saving ? null : _save,
                    icon: const Icon(Icons.check, size: 18),
                    label: Text(_saving ? 'Saving…' : 'Save location'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
