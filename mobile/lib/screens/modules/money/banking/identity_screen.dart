import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/file_service.dart';
import '../../shared/module_states.dart';

/// The identity check.
///
/// This is what an account is waiting for, so it says that first: the status,
/// what the bank still needs **in the bank's own words**, and which accounts
/// are held up by it. The form below is the way to answer.
///
/// Nothing sensitive is kept here. The number goes to the server on submit;
/// what comes back is the last four, and that is all this screen can show
/// afterwards.
class IdentityScreen extends StatefulWidget {
  const IdentityScreen({super.key});

  @override
  State<IdentityScreen> createState() => _IdentityScreenState();
}

class _IdentityScreenState extends State<IdentityScreen> {
  final _first = TextEditingController();
  final _middle = TextEditingController();
  final _last = TextEditingController();
  final _tax = TextEditingController();
  final _street1 = TextEditingController();
  final _street2 = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _postcode = TextEditingController();
  final _country = TextEditingController(text: 'US');
  final _docNumber = TextEditingController();
  final _docCountry = TextEditingController(text: 'US');

  DateTime? _dob;
  DateTime? _expiry;
  String _docType = 'drivers_license';
  String? _error;
  bool _sent = false;

  static const _docTypes = {
    'drivers_license': "Driver's licence",
    'passport': 'Passport',
    'national_id': 'National ID',
    'residence_permit': 'Residence permit',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final b = context.read<BankingProvider>();
      if (b.identity.isEmpty && !b.identityLoading) await b.loadIdentity();
      if (mounted) _fill(b.identityDetails);
    });
  }

  /// What the bank already has, back in the form — so a correction is an edit
  /// rather than typing it all again. The tax number is not among them: only
  /// its last four ever comes back.
  void _fill(Map<String, dynamic> d) {
    if (d.isEmpty) return;
    setState(() {
      _first.text = '${d['firstName'] ?? ''}';
      _middle.text = '${d['middleName'] ?? ''}';
      _last.text = '${d['lastName'] ?? ''}';
      _dob = DateTime.tryParse('${d['dateOfBirth'] ?? ''}');
      final a = d['address'];
      if (a is Map) {
        _street1.text = '${a['street1'] ?? ''}';
        _street2.text = '${a['street2'] ?? ''}';
        _city.text = '${a['city'] ?? ''}';
        _state.text = '${a['state'] ?? ''}';
        _postcode.text = '${a['postalCode'] ?? ''}';
        _country.text = '${a['country'] ?? 'US'}';
      }
      final docs = d['identityDocuments'];
      if (docs is List && docs.isNotEmpty && docs.first is Map) {
        final doc = Map<String, dynamic>.from(docs.first);
        _docType = '${doc['documentType'] ?? _docType}';
        _docCountry.text = '${doc['issuingCountry'] ?? 'US'}';
        _expiry = DateTime.tryParse('${doc['expiryDate'] ?? ''}');
      }
    });
  }

  @override
  void dispose() {
    for (final c in [
      _first, _middle, _last, _tax, _street1, _street2,
      _city, _state, _postcode, _country, _docNumber, _docCountry
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    final b = context.read<BankingProvider>();
    setState(() {
      _error = null;
      _sent = false;
    });

    final body = <String, dynamic>{
      'firstName': _first.text.trim(),
      if (_middle.text.trim().isNotEmpty) 'middleName': _middle.text.trim(),
      'lastName': _last.text.trim(),
      if (_dob != null) 'dateOfBirth': _ymd(_dob!),
      if (_tax.text.trim().isNotEmpty) 'taxId': _tax.text.trim(),
      'address': {
        'street1': _street1.text.trim(),
        if (_street2.text.trim().isNotEmpty) 'street2': _street2.text.trim(),
        'city': _city.text.trim(),
        'state': _state.text.trim(),
        'postalCode': _postcode.text.trim(),
        'country': _country.text.trim().toUpperCase(),
      },
      if (_docNumber.text.trim().isNotEmpty || _expiry != null)
        'identityDocument': {
          'documentType': _docType,
          if (_docNumber.text.trim().isNotEmpty)
            'documentNumber': _docNumber.text.trim(),
          'issuingCountry': _docCountry.text.trim().toUpperCase(),
          if (_expiry != null) 'expiryDate': _ymd(_expiry!),
        },
    };

    final err = await b.submitIdentity(body);
    if (!mounted) return;
    setState(() {
      _error = err;
      _sent = err == null;
      // The number itself is never held longer than the request that carried
      // it; what comes back is the last four.
      if (err == null) _tax.clear();
    });
  }

  /// Photograph or pick a document, upload it, then tell the bank which it is.
  Future<void> _attach(String kind) async {
    final b = context.read<BankingProvider>();
    final picker = ImagePicker();
    final shot = await picker.pickImage(
        source: ImageSource.camera, imageQuality: 85, maxWidth: 2000);
    final file = shot ?? await picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;

    setState(() => _error = null);
    try {
      final bytes = await File(file.path).readAsBytes();
      final path = await fileService.upload(bytes, file.name,
          location: 'banking/identity');
      if (path == null || path.isEmpty) {
        throw Exception('The file did not upload.');
      }
      final err = await b.attachIdentityDocument(
        kind: kind,
        path: path,
        documentType: kind.startsWith('id_') ? _docType : null,
      );
      if (!mounted) return;
      setState(() => _error = err);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e'.replaceAll('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final status = b.identityStatus;
    final request = b.identityRequest;
    final details = b.identityDetails;
    final canEdit = b.identityCanEdit;

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text('Identity check',
            style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      body: b.identityLoading && b.identity.isEmpty
          ? const ModuleLoading()
          : b.identityError != null
              ? Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(
                      message: b.identityError!, onRetry: b.loadIdentity),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, SSpace.sm, SSpace.lg, SSpace.xxl),
                  children: [
                    _StatusCard(
                      status: status,
                      statusText: '${b.identity['statusText'] ?? ''}',
                    ),

                    // What the bank asked for, if it asked.
                    if (request != null &&
                        '${request['message'] ?? ''}'.trim().isNotEmpty) ...[
                      const SizedBox(height: SSpace.md),
                      Container(
                        padding: const EdgeInsets.all(SSpace.lg),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFDF1DC),
                          borderRadius: BorderRadius.circular(SRadius.md),
                          border: Border.all(
                              color: SColors.amber.withValues(alpha: 0.5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('The bank asked for',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                    color: Color(0xFF8A5B16))),
                            const SizedBox(height: SSpace.sm),
                            Text('${request['message']}',
                                style: const TextStyle(
                                    color: Color(0xFF8A5B16),
                                    fontSize: 13,
                                    height: 1.4)),
                          ],
                        ),
                      ),
                    ],

                    // Still needed — the server's sentences, unchanged.
                    if (b.identityMissing.isNotEmpty) ...[
                      const SizedBox(height: SSpace.md),
                      Container(
                        padding: const EdgeInsets.all(SSpace.lg),
                        decoration: BoxDecoration(
                          color: SColors.card,
                          borderRadius: BorderRadius.circular(SRadius.md),
                          border: Border.all(color: SColors.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Still needed',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13.5,
                                    color: SColors.ink)),
                            const SizedBox(height: SSpace.sm),
                            for (final m in b.identityMissing)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.circle,
                                        size: 5, color: SColors.muted),
                                    const SizedBox(width: SSpace.sm),
                                    Expanded(
                                      child: Text(m,
                                          style: const TextStyle(
                                              color: SColors.ink2,
                                              fontSize: 13,
                                              height: 1.4)),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],

                    // Which accounts this is holding up.
                    if (b.accountsWaiting.isNotEmpty) ...[
                      const SizedBox(height: SSpace.md),
                      Container(
                        padding: const EdgeInsets.all(SSpace.md),
                        decoration: BoxDecoration(
                          color: brand.primary.withValues(alpha: 0.07),
                          borderRadius: BorderRadius.circular(SRadius.md),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.hourglass_top_rounded,
                                size: 17, color: brand.primary),
                            const SizedBox(width: SSpace.sm),
                            Expanded(
                              child: Text(
                                b.accountsWaiting.length == 1
                                    ? '1 account is waiting on this'
                                    : '${b.accountsWaiting.length} accounts are waiting on this',
                                style: TextStyle(
                                    color: brand.primary,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: SSpace.xl),
                    if (!canEdit)
                      Container(
                        padding: const EdgeInsets.all(SSpace.md),
                        decoration: BoxDecoration(
                          color: SColors.paper2,
                          borderRadius: BorderRadius.circular(SRadius.md),
                        ),
                        child: Text(
                          status == 'verified'
                              ? 'Your details are verified. To change them, '
                                  'send the new ones and the bank will review '
                                  'the change.'
                              : 'This check is closed and cannot be edited '
                                  'here. Contact the bank.',
                          style: const TextStyle(
                              color: SColors.ink2, fontSize: 12.5, height: 1.4),
                        ),
                      ),

                    const SizedBox(height: SSpace.lg),
                    const _Head('Your name'),
                    _Field(label: 'First name', controller: _first),
                    _Field(label: 'Middle name (optional)', controller: _middle),
                    _Field(label: 'Last name', controller: _last),
                    _DateField(
                      label: 'Date of birth',
                      value: _dob,
                      first: DateTime(1900),
                      last: DateTime.now(),
                      onPick: (d) => setState(() => _dob = d),
                    ),

                    const _Head('Where you live'),
                    _Field(label: 'Street', controller: _street1),
                    _Field(
                        label: 'Apartment, floor (optional)',
                        controller: _street2),
                    Row(
                      children: [
                        Expanded(
                            child: _Field(label: 'City', controller: _city)),
                        const SizedBox(width: SSpace.md),
                        SizedBox(
                            width: 96,
                            child:
                                _Field(label: 'State', controller: _state)),
                      ],
                    ),
                    Row(
                      children: [
                        Expanded(
                            child: _Field(
                                label: 'Postal code',
                                controller: _postcode,
                                keyboard: TextInputType.number)),
                        const SizedBox(width: SSpace.md),
                        SizedBox(
                            width: 96,
                            child: _Field(
                                label: 'Country', controller: _country)),
                      ],
                    ),

                    const _Head('Taxpayer number'),
                    _Field(
                      label: details['tinLast4'] == null
                          ? 'SSN or ITIN'
                          : 'SSN or ITIN (on file, ends ${details['tinLast4']})',
                      controller: _tax,
                      keyboard: TextInputType.number,
                      obscure: true,
                      help: 'Sent to the bank and not kept on this phone.',
                    ),

                    const _Head('Identity document'),
                    Wrap(
                      spacing: SSpace.sm,
                      runSpacing: SSpace.sm,
                      children: [
                        for (final entry in _docTypes.entries)
                          ChoiceChip(
                            label: Text(entry.value),
                            selected: _docType == entry.key,
                            onSelected: (_) =>
                                setState(() => _docType = entry.key),
                            selectedColor: brand.primary,
                            labelStyle: TextStyle(
                              color: _docType == entry.key
                                  ? Colors.white
                                  : SColors.ink2,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: SSpace.md),
                    _Field(
                        label: 'Document number',
                        controller: _docNumber,
                        obscure: true),
                    Row(
                      children: [
                        SizedBox(
                            width: 110,
                            child: _Field(
                                label: 'Issued by',
                                controller: _docCountry)),
                        const SizedBox(width: SSpace.md),
                        Expanded(
                          child: _DateField(
                            label: 'Expires',
                            value: _expiry,
                            first: DateTime.now()
                                .subtract(const Duration(days: 3650)),
                            last: DateTime.now()
                                .add(const Duration(days: 365 * 20)),
                            onPick: (d) => setState(() => _expiry = d),
                          ),
                        ),
                      ],
                    ),

                    const _Head('Photos'),
                    _Attach(
                      label: 'Front of the document',
                      done: _has(details, 'front'),
                      onTap: () => _attach('id_front'),
                    ),
                    _Attach(
                      label: 'Back of the document',
                      done: _has(details, 'back'),
                      onTap: () => _attach('id_back'),
                    ),
                    _Attach(
                      label: 'Proof of address',
                      done: details['proofOfAddress'] != null,
                      onTap: () => _attach('proof_of_address'),
                    ),
                    _Attach(
                      label: 'A photo of you',
                      done: details['selfie'] != null,
                      onTap: () => _attach('selfie'),
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: SSpace.lg),
                      ModuleError(message: _error!),
                    ],
                    if (_sent) ...[
                      const SizedBox(height: SSpace.lg),
                      Container(
                        padding: const EdgeInsets.all(SSpace.md),
                        decoration: BoxDecoration(
                          color: SColors.greenSoft,
                          borderRadius: BorderRadius.circular(SRadius.md),
                        ),
                        child: const Text(
                          'Sent to the bank. You will see the status change '
                          'here when it has been looked at.',
                          style: TextStyle(
                              color: SColors.green2,
                              fontSize: 13,
                              height: 1.4),
                        ),
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
              onPressed: b.busy ? null : _submit,
              child: b.busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      b.identityVerified ? 'Send a change' : 'Send to the bank',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ),
      ),
    );
  }

  static bool _has(Map<String, dynamic> details, String side) {
    final docs = details['identityDocuments'];
    if (docs is! List || docs.isEmpty) return false;
    final first = docs.first;
    return first is Map && first[side] != null;
  }
}

/// Where the check stands, in one card.
class _StatusCard extends StatelessWidget {
  final String status, statusText;
  const _StatusCard({required this.status, required this.statusText});

  @override
  Widget build(BuildContext context) {
    final (Color colour, IconData icon, String label) = switch (status) {
      'verified' => (SColors.green, Icons.verified_rounded, 'Verified'),
      'in_review' => (SColors.amber, Icons.hourglass_top_rounded, 'Being checked'),
      'submitted' => (SColors.amber, Icons.send_rounded, 'Sent to the bank'),
      'needs_info' => (SColors.danger, Icons.help_outline_rounded, 'More needed'),
      'rejected' => (SColors.danger, Icons.block_rounded, 'Not accepted'),
      _ => (SColors.muted, Icons.badge_outlined, 'Not started'),
    };

    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: colour.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: colour.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, color: colour, size: 26),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                        color: colour)),
                if (statusText.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(statusText,
                      style: const TextStyle(
                          color: SColors.ink2, fontSize: 12.5, height: 1.35)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Head extends StatelessWidget {
  final String text;
  const _Head(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(0, SSpace.xl, 0, SSpace.md),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: SColors.ink)),
      );
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboard;
  final bool obscure;
  final String? help;
  const _Field({
    required this.label,
    required this.controller,
    this.keyboard,
    this.obscure = false,
    this.help,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.md),
        child: TextField(
          controller: controller,
          keyboardType: keyboard,
          obscureText: obscure,
          decoration: InputDecoration(labelText: label, helperText: help),
        ),
      );
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final DateTime first, last;
  final ValueChanged<DateTime> onPick;
  const _DateField({
    required this.label,
    required this.value,
    required this.first,
    required this.last,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.md),
        child: GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: value ?? DateTime(2000),
              firstDate: first,
              lastDate: last,
            );
            if (picked != null) onPick(picked);
          },
          child: InputDecorator(
            decoration: InputDecoration(labelText: label),
            child: Text(
              value == null
                  ? 'Pick a date'
                  : '${value!.day}/${value!.month}/${value!.year}',
              style: TextStyle(
                  fontSize: 15,
                  color: value == null ? SColors.faint : SColors.ink),
            ),
          ),
        ),
      );
}

class _Attach extends StatelessWidget {
  final String label;
  final bool done;
  final VoidCallback onTap;
  const _Attach(
      {required this.label, required this.done, required this.onTap});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.sm),
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
              color: SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(
                  color: done ? SColors.green : SColors.line,
                  width: done ? 1.3 : 1),
            ),
            child: Row(
              children: [
                Icon(
                    done
                        ? Icons.check_circle_rounded
                        : Icons.photo_camera_outlined,
                    size: 19,
                    color: done ? SColors.green : SColors.muted),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: Text(label,
                      style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: done ? SColors.green2 : SColors.ink)),
                ),
                Text(done ? 'Sent' : 'Add',
                    style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: done
                            ? SColors.green
                            : CurrentSetup.brand.primary)),
              ],
            ),
          ),
        ),
      );
}
