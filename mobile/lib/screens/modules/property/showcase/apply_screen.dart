import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/tenancy_provider.dart';

/// Apply to rent.
///
/// The questions are the ones every letting agent asks, in the order they ask
/// them, three at a time. One long form is how an application gets abandoned
/// on a phone.
///
/// It submits to the business's own CRM form (`rental-application`), so the
/// manager reviews it where every other submission lands and the questions can
/// change without an app release. Field names are fixed by that form's schema
/// — they are listed in specs/05-property-leasing/README.md.
class ApplyScreen extends StatefulWidget {
  final Map<String, dynamic> listing;
  final List<Map<String, dynamic>> units;
  const ApplyScreen({super.key, required this.listing, this.units = const []});

  @override
  State<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends State<ApplyScreen> {
  final _page = PageController();
  int _step = 0;
  bool _sending = false;
  String? _error;
  bool _done = false;

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _employer = TextEditingController();
  final _jobTitle = TextEditingController();
  final _income = TextEditingController();
  final _notes = TextEditingController();

  DateTime? _moveIn;
  int _occupants = 1;
  bool _pets = false;
  bool _consent = false;
  String? _unit;

  static const _steps = ['You', 'Income', 'Household', 'Review'];

  @override
  void initState() {
    super.initState();
    // Whoever is signed in is almost certainly the applicant.
    final user = context.read<AuthProvider>().user;
    if (user != null) {
      final full = user.displayName.trim();
      if (full.isNotEmpty) _name.text = full;
      _email.text = user.email;
      _phone.text = user.phone ?? '';
    }
  }

  @override
  void dispose() {
    _page.dispose();
    for (final c in [_name, _email, _phone, _employer, _jobTitle, _income, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _stepValid => switch (_step) {
        0 => _name.text.trim().isNotEmpty &&
            _email.text.trim().contains('@') &&
            _moveIn != null,
        1 => _income.text.trim().isNotEmpty,
        2 => true,
        _ => _consent,
      };

  void _next() {
    if (_step < _steps.length - 1) {
      setState(() => _step++);
      _page.animateToPage(_step,
          duration: const Duration(milliseconds: 260), curve: Curves.easeOut);
    } else {
      _submit();
    }
  }

  void _back() {
    if (_step == 0) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _step--);
    _page.animateToPage(_step,
        duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
  }

  Future<void> _submit() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    final answers = <String, dynamic>{
      'fullName': _name.text.trim(),
      'email': _email.text.trim(),
      'phone': _phone.text.trim(),
      'moveInDate': _moveIn?.toIso8601String().split('T').first,
      'employer': _employer.text.trim(),
      'jobTitle': _jobTitle.text.trim(),
      'monthlyIncome': num.tryParse(_income.text.replaceAll(RegExp(r'[^0-9.]'), '')),
      'occupants': _occupants,
      'pets': _pets,
      'notes': _notes.text.trim(),
      'consentScreening': _consent,
      // What they are applying for, so the manager is not guessing.
      'listing': '${widget.listing['name'] ?? ''}',
      'listingTitle': '${widget.listing['title'] ?? ''}',
      if (_unit != null) 'unit': _unit,
    };

    final err = await context.read<TenancyProvider>().submitApplication(answers);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _error = err;
      _done = err == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;

    if (_done) return _Submitted(listing: widget.listing);

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _back,
        ),
        title: Text('Apply · ${widget.listing['title'] ?? words.term(LexiconKeys.property)}',
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: SColors.ink)),
      ),
      body: Column(
        children: [
          _Progress(step: _step, steps: _steps, colour: brand.primary),
          Expanded(
            child: PageView(
              controller: _page,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _you(),
                _income_(),
                _household(),
                _review(),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(SSpace.lg, 0, SSpace.lg, SSpace.sm),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 16, color: SColors.danger),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: Text(_error!,
                        style: const TextStyle(
                            color: SColors.danger, fontSize: 12.5, height: 1.3)),
                  ),
                ],
              ),
            ),
          Container(
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
                  Text('Step ${_step + 1} of ${_steps.length}',
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 12.5)),
                  const Spacer(),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: brand.primary,
                      disabledBackgroundColor: SColors.line,
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.xxl, vertical: SSpace.md + 2),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(SRadius.pill)),
                    ),
                    onPressed: _sending || !_stepValid ? null : _next,
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Text(
                            _step == _steps.length - 1 ? 'Submit application' : 'Continue',
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _you() => _Step(
        title: 'Who is applying',
        blurb: 'The office will use this to reach you about the application.',
        children: [
          _Field(label: 'Full name', controller: _name, onChanged: _touch),
          _Field(
              label: 'Email',
              controller: _email,
              keyboard: TextInputType.emailAddress,
              onChanged: _touch),
          _Field(
              label: 'Phone',
              controller: _phone,
              keyboard: TextInputType.phone,
              onChanged: _touch),
          _DateField(
            label: 'Move-in date',
            value: _moveIn,
            onPick: (d) => setState(() => _moveIn = d),
          ),
          if (widget.units.isNotEmpty)
            _UnitPicker(
              units: widget.units,
              value: _unit,
              onPick: (u) => setState(() => _unit = u),
            ),
        ],
      );

  Widget _income_() => _Step(
        title: 'Work and income',
        blurb: 'Most places want to see rent at about a third of take-home pay.',
        children: [
          _Field(label: 'Employer', controller: _employer),
          _Field(label: 'Job title', controller: _jobTitle),
          _Field(
              label: 'Monthly income before tax',
              controller: _income,
              keyboard: TextInputType.number,
              prefix: '\$',
              onChanged: _touch),
        ],
      );

  Widget _household() => _Step(
        title: 'Household',
        blurb: 'Everyone who will live there, and anything we should know.',
        children: [
          _Counter(
            label: 'People moving in',
            value: _occupants,
            onChange: (v) => setState(() => _occupants = v),
          ),
          _Switch(
            label: 'Pets',
            blurb: 'Breed and weight limits may apply',
            value: _pets,
            onChange: (v) => setState(() => _pets = v),
          ),
          _Field(
              label: 'Anything else',
              controller: _notes,
              lines: 4,
              hint: 'Guarantor, voucher, start date flexibility…'),
        ],
      );

  Widget _review() {
    final rows = <({String k, String v})>[
      (k: 'Name', v: _name.text.trim()),
      (k: 'Email', v: _email.text.trim()),
      if (_phone.text.trim().isNotEmpty) (k: 'Phone', v: _phone.text.trim()),
      (
        k: 'Move in',
        v: _moveIn == null
            ? '—'
            : '${_moveIn!.day}/${_moveIn!.month}/${_moveIn!.year}'
      ),
      if (_unit != null) (k: 'Unit', v: _unit!),
      if (_employer.text.trim().isNotEmpty)
        (k: 'Employer', v: _employer.text.trim()),
      if (_income.text.trim().isNotEmpty)
        (k: 'Monthly income', v: '\$${_income.text.trim()}'),
      (k: 'People', v: '$_occupants'),
      (k: 'Pets', v: _pets ? 'Yes' : 'No'),
    ];

    return _Step(
      title: 'Check and send',
      blurb: 'The office sees this the moment you send it.',
      children: [
        Container(
          padding: const EdgeInsets.all(SSpace.lg),
          decoration: BoxDecoration(
            color: SColors.card,
            borderRadius: BorderRadius.circular(SRadius.xl),
            boxShadow: SShadow.soft,
          ),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: SSpace.lg, color: SColors.line2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 118,
                      child: Text(rows[i].k,
                          style: const TextStyle(
                              color: SColors.muted, fontSize: 12.5)),
                    ),
                    Expanded(
                      child: Text(rows[i].v.isEmpty ? '—' : rows[i].v,
                          style: const TextStyle(
                              color: SColors.ink,
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: SSpace.lg),
        // A screening consent that is pre-ticked is not consent.
        GestureDetector(
          onTap: () => setState(() => _consent = !_consent),
          child: Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
              color: _consent ? SColors.greenSoft : SColors.card,
              borderRadius: BorderRadius.circular(SRadius.md),
              border: Border.all(
                  color: _consent ? SColors.green : SColors.line, width: 1),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  _consent
                      ? Icons.check_box_rounded
                      : Icons.check_box_outline_blank_rounded,
                  color: _consent ? SColors.green : SColors.faint,
                  size: 22,
                ),
                const SizedBox(width: SSpace.sm),
                const Expanded(
                  child: Text(
                    'I agree that the details above are true, and that the '
                    'office may check my references, employment and credit '
                    'as part of this application.',
                    style: TextStyle(
                        color: SColors.ink2, fontSize: 12.5, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _touch(String _) => setState(() {});
}

class _Progress extends StatelessWidget {
  final int step;
  final List<String> steps;
  final Color colour;
  const _Progress({required this.step, required this.steps, required this.colour});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(SSpace.lg, 0, SSpace.lg, SSpace.md),
        child: Row(
          children: [
            for (var i = 0; i < steps.length; i++) ...[
              if (i > 0) const SizedBox(width: SSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: i <= step ? colour : SColors.line,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                    ),
                    const SizedBox(height: SSpace.xs + 2),
                    Text(steps[i],
                        style: TextStyle(
                          fontSize: 10.5,
                          letterSpacing: 0.3,
                          fontWeight:
                              i == step ? FontWeight.w800 : FontWeight.w500,
                          color: i <= step ? SColors.ink2 : SColors.faint,
                        )),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
}

class _Step extends StatelessWidget {
  final String title, blurb;
  final List<Widget> children;
  const _Step({required this.title, required this.blurb, required this.children});

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.md, SSpace.lg, SSpace.xxl),
        children: [
          Text(title,
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w800,
                color: SColors.ink,
                fontFamily: CurrentSetup.brand.displayFont,
              )),
          const SizedBox(height: SSpace.xs),
          Text(blurb,
              style: const TextStyle(
                  color: SColors.muted, fontSize: 13, height: 1.35)),
          const SizedBox(height: SSpace.xl),
          ...children,
        ],
      );
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboard;
  final int lines;
  final String? hint, prefix;
  final ValueChanged<String>? onChanged;
  const _Field({
    required this.label,
    required this.controller,
    this.keyboard,
    this.lines = 1,
    this.hint,
    this.prefix,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    color: SColors.ink2,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: SSpace.sm),
            TextField(
              controller: controller,
              keyboardType: keyboard,
              maxLines: lines,
              onChanged: onChanged,
              style: const TextStyle(fontSize: 14.5, color: SColors.ink),
              decoration: InputDecoration(
                hintText: hint,
                prefixText: prefix,
                filled: true,
                fillColor: SColors.card,
                hintStyle: const TextStyle(color: SColors.faint, fontSize: 13.5),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: SSpace.md, vertical: SSpace.md),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SRadius.md),
                  borderSide: const BorderSide(color: SColors.line),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(SRadius.md),
                  borderSide:
                      BorderSide(color: CurrentSetup.brand.primary, width: 1.4),
                ),
              ),
            ),
          ],
        ),
      );
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final ValueChanged<DateTime> onPick;
  const _DateField(
      {required this.label, required this.value, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: SColors.ink2,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: SSpace.sm),
          GestureDetector(
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: value ?? now.add(const Duration(days: 14)),
                firstDate: now,
                lastDate: now.add(const Duration(days: 365)),
              );
              if (picked != null) onPick(picked);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: SSpace.md, vertical: SSpace.md + 2),
              decoration: BoxDecoration(
                color: SColors.card,
                borderRadius: BorderRadius.circular(SRadius.md),
                border: Border.all(color: SColors.line),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded,
                      size: 17, color: SColors.muted),
                  const SizedBox(width: SSpace.sm),
                  Text(
                    value == null
                        ? 'Pick a date'
                        : '${value!.day}/${value!.month}/${value!.year}',
                    style: TextStyle(
                      fontSize: 14.5,
                      color: value == null ? SColors.faint : SColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnitPicker extends StatelessWidget {
  final List<Map<String, dynamic>> units;
  final String? value;
  final ValueChanged<String> onPick;
  const _UnitPicker(
      {required this.units, required this.value, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final vacant = [
      for (final u in units)
        if ('${u['status'] ?? 'vacant'}'.toLowerCase() == 'vacant') u,
    ];
    if (vacant.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Which one (${vacant.length} free)',
              style: const TextStyle(
                  color: SColors.ink2,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: SSpace.sm),
          Wrap(
            spacing: SSpace.sm,
            runSpacing: SSpace.sm,
            children: [
              for (final u in vacant)
                _Choice(
                  label: '${u['unitNumber'] ?? u['name']}',
                  selected: value == '${u['name']}',
                  onTap: () => onPick('${u['name']}'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Choice(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: SSpace.lg, vertical: SSpace.sm + 2),
          decoration: BoxDecoration(
            color: selected ? CurrentSetup.brand.primary : SColors.card,
            borderRadius: BorderRadius.circular(SRadius.pill),
            border: Border.all(
                color: selected ? CurrentSetup.brand.primary : SColors.line),
          ),
          child: Text(label,
              style: TextStyle(
                  color: selected ? Colors.white : SColors.ink2,
                  fontWeight: FontWeight.w700,
                  fontSize: 13)),
        ),
      );
}

class _Counter extends StatelessWidget {
  final String label;
  final int value;
  final ValueChanged<int> onChange;
  const _Counter(
      {required this.label, required this.value, required this.onChange});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: SSpace.md),
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: SColors.ink,
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
            ),
            IconButton(
              onPressed: value > 1 ? () => onChange(value - 1) : null,
              icon: const Icon(Icons.remove_circle_outline_rounded),
              color: SColors.muted,
            ),
            Text('$value',
                style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: SColors.ink)),
            IconButton(
              onPressed: value < 12 ? () => onChange(value + 1) : null,
              icon: const Icon(Icons.add_circle_outline_rounded),
              color: SColors.muted,
            ),
          ],
        ),
      );
}

class _Switch extends StatelessWidget {
  final String label, blurb;
  final bool value;
  final ValueChanged<bool> onChange;
  const _Switch({
    required this.label,
    required this.blurb,
    required this.value,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: SSpace.md),
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: SSpace.sm),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: SColors.ink,
                          fontSize: 14,
                          fontWeight: FontWeight.w600)),
                  Text(blurb,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 11.5)),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChange,
              activeTrackColor: CurrentSetup.brand.primary,
            ),
          ],
        ),
      );
}

/// What happens after Submit. An application that vanishes into a toast is an
/// application the applicant will phone about.
class _Submitted extends StatelessWidget {
  final Map<String, dynamic> listing;
  const _Submitted({required this.listing});

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
                decoration: BoxDecoration(
                  color: brand.accent.withValues(alpha: 0.16),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.mark_email_read_rounded,
                    size: 34, color: brand.accent),
              ),
              const SizedBox(height: SSpace.xl),
              Text('Application sent',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: brand.displayFont,
                  )),
              const SizedBox(height: SSpace.sm),
              Text(
                'The office has it for ${listing['title'] ?? 'this place'}. '
                'You will get a decision and, if it is a yes, a lease to sign '
                'right here in the app.',
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
                onPressed: () => Navigator.of(context)
                  ..pop()
                  ..pop(),
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
