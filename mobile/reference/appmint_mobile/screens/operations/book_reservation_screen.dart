import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../models/contact_model.dart';
import '../../widgets/contact_picker_sheet.dart';
import '../../widgets/location_picker.dart';
import '../../models/operations_reservation_model.dart';
import '../../providers/operations_provider.dart';
import '../../services/operations_service.dart';

/// Operator-side reservation booking flow. Used when a front-desk agent
/// takes a phone call and books on behalf of a customer.
///
/// Four compact booking steps:
///   1. Pick reservation definition (catalog of bookable services)
///   2. Pick a service from the definition + a date
///   3. Pick an open slot (from /crm/reservations/slots)
///   4. Customer info + Book
class BookReservationScreen extends StatefulWidget {
  /// Booking for someone already known (e.g. from their lead): they come
  /// with their name, email and phone, so nothing is typed.
  final ContactModel? customer;

  const BookReservationScreen({super.key, this.customer});

  @override
  State<BookReservationScreen> createState() => _BookReservationScreenState();
}

class _BookReservationScreenState extends State<BookReservationScreen> {
  int _step = 0;
  int _timePeriod = 0;
  static const _accent = Color(0xFF16776B);
  static const _ink = Color(0xFF192C36);
  static const _muted = Color(0xFF62737B);

  // Step 1
  Map<String, dynamic>? _selectedDefinition;

  // Step 2
  Map<String, dynamic>? _selectedService;
  DateTime? _selectedDate;

  // Step 3
  bool _loadingSlots = false;
  List<Map<String, dynamic>> _slots = const [];
  String? _slotsError;
  Map<String, dynamic>? _selectedSlot;

  // Step 4
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _notes = TextEditingController();
  num _partySize = 1;

  @override
  void initState() {
    super.initState();
    final c = widget.customer;
    if (c != null) {
      _name.text = c.name;
      _email.text = c.email ?? '';
      _phone.text = ContactModel.formatPhone(c.phone ?? '');
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OperationsProvider>().loadReservationDefinitions();
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /// Pull the definition's `data` map. Fallbacks for shape variations.
  Map<String, dynamic> _defData(Map<String, dynamic> def) {
    final data = def['data'];
    if (data is Map) return Map<String, dynamic>.from(data);
    return def;
  }

  List<Map<String, dynamic>> _defServices(Map<String, dynamic> def) {
    final data = _defData(def);
    final raw = data['services'];
    if (raw is List) {
      final list = raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (list.isNotEmpty) return list;
    }
    // No services configured: the server books against the definition itself
    // (reservations.service getService → { name: def.name, duration: def.duration ?? 30 }),
    // so offer that single implicit service instead of dead-ending the wizard.
    return [
      {
        'name': (data['name'] ?? def['name'] ?? '').toString(),
        'duration': data['duration'] is num ? data['duration'] : 30,
        'implicit': true,
      },
    ];
  }

  String _defTitle(Map<String, dynamic> def) {
    final data = _defData(def);
    final t = (data['title'] ?? data['name'] ?? '').toString();
    return t.isEmpty ? 'Untitled' : t;
  }

  String _defDescription(Map<String, dynamic> def) {
    final data = _defData(def);
    return (data['description'] ?? '').toString();
  }

  String _serviceName(Map<String, dynamic> svc) =>
      (svc['name'] ?? svc['title'] ?? '').toString();

  String _formatSlotTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    final local = dt.toLocal();
    final h = local.hour;
    final m = local.minute.toString().padLeft(2, '0');
    final period = h >= 12 ? 'PM' : 'AM';
    final h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
    return '$h12:$m $period';
  }

  String _formatDateLong(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }

  /// Loose response-shape extractor for /crm/reservations/slots.
  /// Backend may return { slots: [...] } or just a List.
  List<Map<String, dynamic>> _extractSlots(dynamic response) {
    List? raw;
    if (response is List) {
      raw = response;
    } else if (response is Map) {
      // Try common keys.
      for (final key in ['slots', 'data', 'items', 'available']) {
        final v = response[key];
        if (v is List) {
          raw = v;
          break;
        }
      }
      // Last resort: first non-empty list-like value in the map.
      if (raw == null) {
        for (final v in response.values) {
          if (v is List && v.isNotEmpty) {
            raw = v;
            break;
          }
        }
      }
    }
    if (raw == null) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> _loadSlots() async {
    if (_selectedDefinition == null ||
        _selectedService == null ||
        _selectedDate == null) {
      return;
    }
    setState(() {
      _loadingSlots = true;
      _slots = const [];
      _slotsError = null;
      _selectedSlot = null;
    });
    try {
      final defData = _defData(_selectedDefinition!);
      final id = (defData['sk'] ?? _selectedDefinition!['sk'] ?? '').toString();
      final response = await operationsService.getSlots(
        reservationDefinitionId: id,
        serviceName: _serviceName(_selectedService!),
        serviceDate: _selectedDate!,
      );
      if (!mounted) return;
      final slots = _extractSlots(response);
      setState(() {
        _slots = slots;
        if (slots.isNotEmpty) _timePeriod = _periodFor(slots.first);
        _loadingSlots = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _slotsError = e.toString();
        _loadingSlots = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _book() async {
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    if (name.isEmpty || phone.isEmpty) return;

    final defData = _defData(_selectedDefinition!);
    final defId = (defData['sk'] ?? _selectedDefinition!['sk'] ?? '')
        .toString();
    final serviceName = _serviceName(_selectedService!);
    final startIso = (_selectedSlot!['startTime'] ?? '').toString();
    final start = DateTime.tryParse(startIso) ?? _selectedDate!;

    final duration = _selectedService!['duration'] is num
        ? _selectedService!['duration'] as num
        : null;

    final ops = context.read<OperationsProvider>();
    final result = await ops.bookReservation(
      reservationDefinitionId: defId,
      serviceName: serviceName,
      startTime: start,
      customer: OpsReservationCustomer(
        name: name,
        email: _email.text.trim().isEmpty ? null : _email.text.trim(),
        phone: phone,
      ),
      partySize: _partySize,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      duration: duration,
    );

    if (!mounted) return;
    if (result != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_isAppointment ? '$serviceName booked with $name' : 'Reservation created')));
      Navigator.pop(context, result);
    }
    // Errors render inline via Consumer<OperationsProvider>.error.
  }

  // ─── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final ops = context.watch<OperationsProvider>();
    final appt = _isAppointment;
    final labels = ['Service', 'Date', 'Time', appt ? 'Customer' : 'Guest'];
    final titles = [
      'What would you like to book?',
      'Choose a date',
      'Choose a time',
      appt ? 'Customer details' : 'Guest details',
    ];
    final canContinue = switch (_step) {
      0 => _selectedDefinition != null,
      1 => _selectedService != null && _selectedDate != null,
      2 => _selectedSlot != null,
      _ =>
        _name.text.trim().isNotEmpty &&
            _phone.text.trim().isNotEmpty &&
            _selectedSlot != null,
    };
    return Theme(
      data: Theme.of(context).copyWith(
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 16,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFDFE6E5)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFDFE6E5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _accent, width: 1.5),
          ),
        ),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7F7),
        appBar: AppBar(
          title: LocationAppBarTitle(title: widget.customer != null ? 'Book a visit' : 'New reservation'),
          centerTitle: false,
          backgroundColor: const Color(0xFFF5F7F7),
          surfaceTintColor: Colors.transparent,
        ),
        body: SafeArea(
          top: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                    child: Row(
                      children: List.generate(
                        4,
                        (i) => Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(right: i == 3 ? 0 : 8),
                            child: InkWell(
                              onTap: i < _step && !ops.busy
                                  ? () => setState(() => _step = i)
                                  : null,
                              borderRadius: BorderRadius.circular(4),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      height: 3,
                                      decoration: BoxDecoration(
                                        color: i <= _step
                                            ? _accent
                                            : const Color(0xFFDFE6E5),
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      labels[i],
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: i == _step
                                            ? FontWeight.w700
                                            : FontWeight.w400,
                                        color: i <= _step ? _accent : _muted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView(
                      key: ValueKey(_step),
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                      children: [
                        Text(
                          titles[_step],
                          style: const TextStyle(
                            fontSize: 25,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                            color: _ink,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _step == 0
                              ? 'Select a service to see availability.'
                              : _step == 1
                              ? _defTitle(_selectedDefinition!)
                              : _step == 2
                              ? '${_defTitle(_selectedDefinition!)} · ${_formatDateLong(_selectedDate!)}'
                              : (appt ? 'Who it\'s for, and any notes for the visit.' : 'Add the guest and any special requests.'),
                          style: const TextStyle(
                            fontSize: 14,
                            color: _muted,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 24),
                        if (_step == 3) ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE7F2EF),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.event_available_outlined,
                                  color: _accent,
                                  size: 22,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    '${_defTitle(_selectedDefinition!)}\n${_formatDateLong(_selectedDate!)} · ${_formatSlotTime(_selectedSlot!['startTime']?.toString())}',
                                    style: const TextStyle(
                                      color: _ink,
                                      fontSize: 14,
                                      height: 1.5,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: ops.busy
                                      ? null
                                      : () => setState(() => _step = 2),
                                  child: const Text(
                                    'Edit',
                                    style: TextStyle(color: _accent),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                        switch (_step) {
                          0 => _buildDefinitionStep(),
                          1 => _buildServiceDateStep(),
                          2 => _buildSlotStep(),
                          _ => _buildCustomerStep(),
                        },
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(top: BorderSide(color: Color(0xFFE2E8E7))),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_step == 2) ...[
                          Text(
                            _selectedSlot == null
                                ? 'Select an available time'
                                : '${_formatDateLong(_selectedDate!)} · ${_formatSlotTime(_selectedSlot!['startTime']?.toString())}',
                            style: const TextStyle(fontSize: 13, color: _muted),
                          ),
                          const SizedBox(height: 10),
                        ],
                        Row(
                          children: [
                            if (_step > 0) ...[
                              TextButton(
                                onPressed: ops.busy
                                    ? null
                                    : () {
                                        FocusScope.of(context).unfocus();
                                        setState(() => _step -= 1);
                                      },
                                child: const Text(
                                  'Back',
                                  style: TextStyle(color: _muted),
                                ),
                              ),
                              const SizedBox(width: 16),
                            ],
                            Expanded(
                              child: FilledButton(
                                style: FilledButton.styleFrom(
                                  backgroundColor: _accent,
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(0, 52),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                onPressed: !canContinue || ops.busy
                                    ? null
                                    : () {
                                        FocusScope.of(context).unfocus();
                                        if (_step == 3) {
                                          _book();
                                        } else {
                                          setState(() => _step += 1);
                                          if (_step == 2) _loadSlots();
                                        }
                                      },
                                child: ops.busy
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : Text(
                                        _step == 3
                                            ? (appt ? 'Book appointment' : 'Confirm reservation')
                                            : 'Continue',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Step 1: definition ───────────────────────────────────────────────

  Widget _buildDefinitionStep() {
    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        if (ops.loadingReservationDefinitions &&
            ops.reservationDefinitions.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(HaHoSpacing.lg),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final defs = ops.reservationDefinitions;
        if (defs.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(HaHoSpacing.lg),
            child: Column(
              children: [
                const Icon(
                  Icons.event_busy,
                  color: HaHoColors.textGray,
                  size: 40,
                ),
                const SizedBox(height: HaHoSpacing.sm),
                Text(
                  'No bookable services configured',
                  style: HaHoTextStyles.body.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
                TextButton(
                  onPressed: ops.loadReservationDefinitions,
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }
        return Column(
          children: defs.map((def) {
            final isSelected =
                _selectedDefinition != null &&
                (_defData(_selectedDefinition!)['sk'] ??
                        _selectedDefinition!['sk']) ==
                    (_defData(def)['sk'] ?? def['sk']);
            final services = _defServices(def);
            final servicesSummary = services.isEmpty
                ? null
                : services
                      .map(_serviceName)
                      .where((s) => s.isNotEmpty)
                      .join(' · ');
            final desc = _defDescription(def);
            return Padding(
              padding: const EdgeInsets.only(bottom: HaHoSpacing.sm),
              child: InkWell(
                borderRadius: BorderRadius.circular(HaHoRadius.lg),
                onTap: () {
                  setState(() {
                    _selectedDefinition = def;
                    // Reset downstream selections.
                    _selectedService = services.length == 1
                        ? services.first
                        : null;
                    _selectedSlot = null;
                  });
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: HaHoColors.cardLight,
                    borderRadius: BorderRadius.circular(HaHoRadius.lg),
                    border: Border.all(
                      color: isSelected ? _accent : HaHoColors.border,
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  padding: const EdgeInsets.all(HaHoSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              _defTitle(def),
                              style: HaHoTextStyles.body.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (isSelected)
                            const Icon(
                              Icons.check_circle,
                              color: _accent,
                              size: 20,
                            ),
                        ],
                      ),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          desc,
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (servicesSummary != null &&
                          servicesSummary.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          servicesSummary,
                          style: HaHoTextStyles.caption.copyWith(
                            color: HaHoColors.textGray,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  // ─── Step 2: service + date ───────────────────────────────────────────

  Widget _buildServiceDateStep() {
    if (_selectedDefinition == null) {
      return const SizedBox.shrink();
    }
    final services = _defServices(_selectedDefinition!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!(services.length == 1 && services.first['implicit'] == true)) ...[
          Text('Service', style: HaHoTextStyles.bodySmall),
          const SizedBox(height: HaHoSpacing.xs),
          Wrap(
            spacing: HaHoSpacing.sm,
            runSpacing: HaHoSpacing.sm,
            children: services.map((svc) {
              final name = _serviceName(svc);
              final selected =
                  _selectedService != null &&
                  _serviceName(_selectedService!) == name;
              final duration = svc['duration'];
              final price = svc['price'];
              final label = [
                name,
                if (duration is num) '${duration.toInt()}m',
                if (price is num) '\$${price.toString()}',
              ].join(' · ');
              return ChoiceChip(
                label: Text(label),
                selected: selected,
                onSelected: (_) {
                  setState(() {
                    _selectedService = svc;
                    _selectedSlot = null;
                  });
                },
                selectedColor: HaHoColors.accent.withValues(alpha: 0.2),
              );
            }).toList(),
          ),
        ],
        const SizedBox(height: HaHoSpacing.lg),
        Wrap(
          spacing: 8,
          children: List.generate(2, (i) {
            final now = DateTime.now();
            final date = DateTime(now.year, now.month, now.day + i);
            return ChoiceChip(
              label: Text(i == 0 ? 'Today' : 'Tomorrow'),
              selected:
                  _selectedDate != null &&
                  DateUtils.isSameDay(_selectedDate, date),
              selectedColor: const Color(0xFFE7F2EF),
              onSelected: (_) => setState(() {
                _selectedDate = date;
                _selectedSlot = null;
              }),
            );
          }),
        ),
        const SizedBox(height: 16),
        const SizedBox(height: HaHoSpacing.xs),
        OutlinedButton.icon(
          icon: const Icon(Icons.calendar_today, size: 18),
          label: Text(
            _selectedDate == null
                ? 'Pick a date'
                : _formatDateLong(_selectedDate!),
          ),
          onPressed: _pickDate,
        ),
      ],
    );
  }

  // ─── Step 3: slot picker ──────────────────────────────────────────────

  Widget _buildSlotStep() {
    if (_loadingSlots) {
      return const Padding(
        padding: EdgeInsets.all(HaHoSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_slotsError != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(HaHoSpacing.sm),
            decoration: BoxDecoration(
              color: HaHoColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(HaHoRadius.md),
            ),
            child: Text(
              _slotsError!,
              style: HaHoTextStyles.caption.copyWith(color: HaHoColors.error),
            ),
          ),
          const SizedBox(height: HaHoSpacing.sm),
          TextButton(onPressed: _loadSlots, child: const Text('Retry')),
        ],
      );
    }
    if (_slots.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No open slots for the selected date.',
            style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
          ),
          TextButton(onPressed: _loadSlots, child: const Text('Refresh')),
        ],
      );
    }
    final periods = [
      0,
      1,
      2,
    ].where((p) => _slots.any((s) => _periodFor(s) == p)).toList();
    final visibleSlots = _slots
        .where((s) => _periodFor(s) == _timePeriod)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: periods
                .map(
                  (p) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(['Morning', 'Afternoon', 'Evening'][p]),
                      selected: _timePeriod == p,
                      showCheckmark: false,
                      selectedColor: const Color(0xFFE7F2EF),
                      labelStyle: TextStyle(
                        color: _timePeriod == p ? _accent : _muted,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                      side: BorderSide(
                        color: _timePeriod == p
                            ? _accent
                            : const Color(0xFFDFE6E5),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      onSelected: (_) => setState(() => _timePeriod = p),
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 520
                ? 4
                : constraints.maxWidth < 300
                ? 2
                : 3;
            final width = (constraints.maxWidth - (columns - 1) * 10) / columns;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: visibleSlots.map((slot) {
                final start = (slot['startTime'] ?? '').toString();
                final spots = slot['spotsAvailable'] is num
                    ? (slot['spotsAvailable'] as num).toInt()
                    : null;
                final available = spots != null
                    ? spots > 0
                    : slot['available'] != false;
                final selected = _selectedSlot?['startTime'] == start;
                return SizedBox(
                  width: width,
                  child: Semantics(
                    selected: selected,
                    child: OutlinedButton(
                      onPressed: available
                          ? () => setState(() => _selectedSlot = slot)
                          : null,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 56),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 16,
                        ),
                        backgroundColor: selected ? _accent : Colors.white,
                        foregroundColor: selected ? Colors.white : _ink,
                        side: BorderSide(
                          color: selected ? _accent : const Color(0xFFDFE6E5),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        _formatSlotTime(start),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
        const SizedBox(height: 16),
        const Text(
          'Times shown in your device’s time zone.',
          style: TextStyle(fontSize: 12, color: _muted),
        ),
      ],
    );
  }

  int _periodFor(Map<String, dynamic> slot) {
    final hour =
        DateTime.tryParse(slot['startTime']?.toString() ?? '')
            ?.toLocal()
            .hour ??
        0;
    return hour < 12
        ? 0
        : hour < 17
        ? 1
        : 2;
  }

  Future<void> _pickCustomer() async {
    final picked = await ContactPickerSheet.show(
      context,
      requireField: 'phone',
      title: 'Pick a customer',
    );
    if (picked == null || !mounted) return;
    final d = picked['data'] is Map
        ? Map<String, dynamic>.from(picked['data'] as Map)
        : picked;
    final name = [d['firstName'], d['lastName']]
        .where((v) => (v ?? '').toString().trim().isNotEmpty)
        .join(' ');
    setState(() {
      _name.text = name.isNotEmpty ? name : (d['name'] ?? '').toString();
      _email.text = (d['email'] ?? '').toString();
      _phone.text = ContactModel.formatPhone((d['phone'] ?? '').toString());
    });
  }

  /// A booking type that takes one person at a time (a site survey, a
  /// consultation) rather than a party.
  bool get _isAppointment {
    final def = _selectedDefinition;
    if (def == null) return false;
    final max = _defData(def)['maxPartySize'];
    return max is num && max <= 1;
  }

  // ─── Step 4: customer info ────────────────────────────────────────────

  Widget _buildCustomerStep() {
    return Consumer<OperationsProvider>(
      builder: (context, ops, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _name,
              decoration: InputDecoration(
                labelText: 'Name *',
                // A guest who has been here before is picked from the
                // customer list (name, email and phone come with them).
                suffixIcon: IconButton(
                  tooltip: 'Pick a customer',
                  icon: const Icon(Icons.person_search_outlined),
                  onPressed: _pickCustomer,
                ),
              ),
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: HaHoSpacing.md),
            TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: HaHoSpacing.md),
            TextField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Phone *'),
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
            ),
            if (!_isAppointment) const SizedBox(height: HaHoSpacing.md),
            if (!_isAppointment) Row(
              children: [
                Text('Party size', style: HaHoTextStyles.bodySmall),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: _partySize > 1
                      ? () => setState(() => _partySize -= 1)
                      : null,
                ),
                SizedBox(
                  width: 32,
                  child: Text(
                    '$_partySize',
                    textAlign: TextAlign.center,
                    style: HaHoTextStyles.body.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline),
                  onPressed: () => setState(() => _partySize += 1),
                ),
              ],
            ),
            const SizedBox(height: HaHoSpacing.md),
            TextField(
              controller: _notes,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                hintText: 'special requests, accessibility, etc.',
              ),
            ),
            if (ops.error != null) ...[
              const SizedBox(height: HaHoSpacing.md),
              Container(
                padding: const EdgeInsets.all(HaHoSpacing.sm),
                decoration: BoxDecoration(
                  color: HaHoColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(HaHoRadius.md),
                ),
                child: Text(
                  ops.error!,
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.error,
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
