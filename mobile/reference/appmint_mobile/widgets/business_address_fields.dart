import 'dart:async';

import 'package:flutter/material.dart';

import '../services/address_service.dart';

/// Shared business address editor: shipping lookup plus SDK country/region data.
class BusinessAddressFields extends StatefulWidget {
  final Map<String, TextEditingController> fields;
  final bool enabled;
  const BusinessAddressFields({
    super.key,
    required this.fields,
    this.enabled = true,
  });
  @override
  State<BusinessAddressFields> createState() => _BusinessAddressFieldsState();
}

class _BusinessAddressFieldsState extends State<BusinessAddressFields> {
  final _service = AddressService();
  final _session = DateTime.now().microsecondsSinceEpoch.toString();
  AddressCatalog? _catalog;
  Timer? _debounce;
  int _request = 0;
  bool _loading = false;
  bool _resolving = false;
  String? _lookupMessage;
  List<AddressSuggestion> _suggestions = [];
  TextEditingController field(String key) => widget.fields['address.$key']!;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    try {
      final catalog = AddressCatalog.loaded ?? await AddressCatalog.load();
      if (!mounted) return;
      final country = catalog.match(catalog.countries, field('country').text);
      if (country != null) field('country').text = country.code;
      final regions = catalog.regions[field('country').text] ?? [];
      final region = catalog.match(regions, field('state').text);
      if (region != null) field('state').text = region.code;
      setState(() => _catalog = catalog);
    } catch (_) {
      if (mounted)
        setState(
          () => _lookupMessage =
              'Country list could not load. Reopen location settings to retry.',
        );
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _request++;
    super.dispose();
  }

  void _search(String text) {
    _debounce?.cancel();
    final request = ++_request;
    setState(() {
      _suggestions = [];
      _lookupMessage = null;
      _loading = false;
    });
    if (text.trim().length < 3) return;
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => _loading = true);
      try {
        final suggestions = await _service.suggest(
          text.trim(),
          field('country').text,
          _session,
        );
        if (!mounted || request != _request) return;
        setState(() {
          _suggestions = suggestions;
          _lookupMessage = suggestions.isEmpty
              ? 'No matching addresses. You can enter the details below.'
              : null;
        });
      } catch (error) {
        if (!mounted || request != _request) return;
        final agreement = error.toString().toLowerCase().contains(
          'agreement required',
        );
        setState(
          () => _lookupMessage = agreement
              ? 'Address search needs an administrator to review the Google service agreement in organization settings. You can still enter the address below.'
              : 'Address suggestions are unavailable. Try again or enter the details below.',
        );
      } finally {
        if (mounted && request == _request) setState(() => _loading = false);
      }
    });
  }

  Future<void> _select(AddressSuggestion suggestion) async {
    _debounce?.cancel();
    final request = ++_request;
    FocusScope.of(context).unfocus();
    setState(() {
      _resolving = true;
      _suggestions = [];
      _lookupMessage = null;
    });
    try {
      final address = await _service.details(suggestion.id);
      if (!mounted || request != _request) return;
      for (final key in ['street1', 'city', 'state', 'zip', 'country']) {
        field(key).text = address[key] ?? '';
      }
      // Keep a unit the operator entered unless the chosen place supplies it.
      if (address['street2']?.isNotEmpty == true)
        field('street2').text = address['street2']!;
      final catalog = _catalog;
      if (catalog != null) {
        final country = catalog.match(catalog.countries, field('country').text);
        if (country != null) field('country').text = country.code;
        final region = catalog.match(
          catalog.regions[field('country').text] ?? [],
          field('state').text,
        );
        if (region != null) field('state').text = region.code;
      }
      setState(
        () => _lookupMessage =
            [
              'street1',
              'city',
              'zip',
              'country',
            ].any((key) => field(key).text.isEmpty)
            ? 'Some details were not supplied. Complete them below.'
            : 'Address details filled. Review before saving.',
      );
    } catch (_) {
      if (mounted && request == _request)
        setState(
          () => _lookupMessage =
              'Could not load this address. Try selecting it again.',
        );
    } finally {
      if (mounted && request == _request)
        setState(() {
          _resolving = false;
          _loading = false;
        });
    }
  }

  Future<void> _pick(
    String key,
    String title,
    List<AddressOption> options,
  ) async {
    FocusScope.of(context).unfocus();
    final choice = await showModalBottomSheet<AddressOption>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddressOptions(title: title, options: options),
    );
    if (!mounted || choice == null) return;
    setState(() {
      final changed = field(key).text != choice.code;
      field(key).text = choice.code;
      if (key == 'country' && changed) {
        field('state').clear();
        _debounce?.cancel();
        _request++;
        _suggestions = [];
        _loading = false;
        _lookupMessage = null;
      }
    });
  }

  Widget _selector(
    String key,
    String label,
    List<AddressOption> options, {
    bool required = true,
  }) {
    final selected = _catalog?.match(options, field(key).text);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: FormField<String>(
        key: ValueKey('$key:${field(key).text}:${_catalog != null}'),
        initialValue: selected?.code,
        validator: (_) {
          if (_catalog == null) return 'Wait for the country list to load';
          if (required && selected == null) return 'Select $label';
          return null;
        },
        builder: (state) => Semantics(
          button: true,
          label: '$label: ${selected?.name ?? 'Select'}',
          child: InkWell(
            onTap:
                widget.enabled &&
                    !_resolving &&
                    _catalog != null &&
                    options.isNotEmpty
                ? () => _pick(key, label, options)
                : null,
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: label,
                border: const OutlineInputBorder(),
                errorText: state.errorText,
                suffixIcon: const Icon(Icons.expand_more),
                helperText: selected == null && field(key).text.isNotEmpty
                    ? 'Choose a valid ${label.toLowerCase()} for this address.'
                    : null,
              ),
              child: Text(
                selected?.name ??
                    (_catalog == null
                        ? 'Loading…'
                        : options.isEmpty
                        ? 'Not required'
                        : 'Select ${label.toLowerCase()}'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _text(String key, String label, {bool required = true}) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: field(key),
      enabled: widget.enabled && !_resolving,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      keyboardType: key == 'zip'
          ? TextInputType.text
          : TextInputType.streetAddress,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) =>
          required && (value?.trim().isEmpty ?? true) ? 'Enter $label' : null,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final regions =
        _catalog?.regions[field('country').text] ?? <AddressOption>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _selector('country', 'Country', _catalog?.countries ?? []),
        TextFormField(
          controller: field('street1'),
          enabled: widget.enabled && !_resolving,
          onChanged: _search,
          keyboardType: TextInputType.streetAddress,
          textInputAction: TextInputAction.search,
          onFieldSubmitted: _search,
          decoration: InputDecoration(
            labelText: 'Street address',
            hintText: 'Start typing to find an address',
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _loading || _resolving
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    tooltip: 'Find address',
                    onPressed: widget.enabled
                        ? () => _search(field('street1').text)
                        : null,
                    icon: const Icon(Icons.travel_explore),
                  ),
          ),
          validator: (value) => _resolving
              ? 'Wait for address details'
              : (value?.trim().isEmpty ?? true)
              ? 'Enter Street address'
              : null,
        ),
        if (_suggestions.isNotEmpty)
          Card(
            margin: const EdgeInsets.only(top: 8),
            child: Column(
              children: [
                for (final suggestion in _suggestions.take(5))
                  ListTile(
                    leading: const Icon(Icons.place_outlined),
                    title: Text(suggestion.description),
                    onTap: widget.enabled ? () => _select(suggestion) : null,
                  ),
              ],
            ),
          ),
        if (_lookupMessage != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _lookupMessage!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        const SizedBox(height: 16),
        _text('street2', 'Suite / unit (optional)', required: false),
        _text('city', 'City'),
        _selector(
          'state',
          'State / region',
          regions,
          required: regions.isNotEmpty,
        ),
        _text('zip', 'ZIP / postal code'),
      ],
    );
  }
}

class _AddressOptions extends StatefulWidget {
  final String title;
  final List<AddressOption> options;
  const _AddressOptions({required this.title, required this.options});
  @override
  State<_AddressOptions> createState() => _AddressOptionsState();
}

class _AddressOptionsState extends State<_AddressOptions> {
  String _query = '';
  @override
  Widget build(BuildContext context) {
    final options = widget.options
        .where(
          (o) => '${o.name} ${o.code}'.toLowerCase().contains(
            _query.toLowerCase(),
          ),
        )
        .toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .65,
        child: Column(
          children: [
            ListTile(
              title: Text(
                widget.title,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              trailing: IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: TextField(
                decoration: InputDecoration(
                  labelText: 'Search ${widget.title.toLowerCase()}',
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: options.length,
                itemBuilder: (_, i) => ListTile(
                  title: Text(options[i].name),
                  trailing: Text(options[i].code),
                  onTap: () => Navigator.pop(context, options[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
