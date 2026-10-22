import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/logistics_provider.dart';
import '../../../../services/logistics_api.dart';
import 'track_screen.dart';

/// Request a delivery: where from, where to, what the server charges, pay.
///
/// The price is never computed here. A quote is whatever `/logistics/jobs`
/// returned and every line it carries is shown, so the customer sees the same
/// breakdown the server applied rather than a summary chosen by the app.
class OrderScreen extends StatefulWidget {
  const OrderScreen({super.key});
  @override
  State<OrderScreen> createState() => _OrderScreenState();
}

class _OrderScreenState extends State<OrderScreen> {
  final _pickup = TextEditingController();
  final _dropoff = TextEditingController();
  final _notes = TextEditingController();

  bool _placing = false;
  String? _error;

  /// Geocoded addresses, kept so the order sends coordinates and not just text.
  Map<String, dynamic>? _pickupGeo;
  Map<String, dynamic>? _dropoffGeo;

  @override
  void dispose() {
    _pickup.dispose();
    _dropoff.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>?> _geocode(String address) async {
    try {
      final r = await logisticsApi.geocode(address);
      return r.isEmpty ? null : r;
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
      return null;
    }
  }

  Future<void> _quote() async {
    setState(() => _error = null);
    final from = _pickup.text.trim();
    final to = _dropoff.text.trim();
    if (from.isEmpty || to.isEmpty) {
      setState(() => _error = 'Enter both a pickup and a drop-off address.');
      return;
    }

    _pickupGeo = await _geocode(from);
    if (_pickupGeo == null) return;
    _dropoffGeo = await _geocode(to);
    if (_dropoffGeo == null) return;

    final err = await context.read<LogisticsProvider>().getQuote(
          stops: _stops(from, to),
          customerNotes: _notes.text.trim(),
        );
    if (err != null && mounted) setState(() => _error = err);
  }

  /// A delivery is a list of typed stops, which is how the server models it.
  List<Map<String, dynamic>> _stops(String from, String to) => [
        LogisticsApi.stop(
          type: 'pickup',
          address: from,
          lat: _lat(_pickupGeo),
          lng: _lng(_pickupGeo),
        ),
        LogisticsApi.stop(
          type: 'dropoff',
          address: to,
          lat: _lat(_dropoffGeo),
          lng: _lng(_dropoffGeo),
          instructions: _notes.text.trim(),
        ),
      ];

  static double? _lat(Map<String, dynamic>? geo) {
    if (geo == null) return null;
    final v = geo['lat'] ?? geo['latitude'] ?? (geo['location'] is Map ? geo['location']['lat'] : null);
    return (v as num?)?.toDouble();
  }

  static double? _lng(Map<String, dynamic>? geo) {
    if (geo == null) return null;
    final v = geo['lng'] ?? geo['longitude'] ?? (geo['location'] is Map ? geo['location']['lng'] : null);
    return (v as num?)?.toDouble();
  }

  Future<void> _place() async {
    final logistics = context.read<LogisticsProvider>();
    if (logistics.quote?.quoteId == null) return;

    setState(() {
      _placing = true;
      _error = null;
    });
    try {
      final job = await logistics.placeOrder(
        stops: _stops(_pickup.text.trim(), _dropoff.text.trim()),
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );
      final id = '${job['id'] ?? job['jobId'] ?? (job['job'] is Map ? job['job']['id'] : '') ?? ''}';
      if (!mounted) return;
      logistics.clearQuote();
      if (id.isEmpty) {
        // Booked, but nothing to track by — send them to the list rather than
        // a tracking screen that cannot load.
        setState(() => _error =
            'Booked. Open it from your deliveries to follow it.');
        return;
      }
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => TrackScreen(jobId: id)));
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final logistics = context.watch<LogisticsProvider>();
    final job = CurrentSetup.term(LexiconKeys.job).toLowerCase();

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SSpace.xl),
          children: [
            Text('New $job',
                style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: SSpace.xl),
            _Field(
              controller: _pickup,
              label: 'Pickup address',
              icon: Icons.trip_origin_rounded,
            ),
            const SizedBox(height: SSpace.md),
            _Field(
              controller: _dropoff,
              label: 'Drop-off address',
              icon: Icons.place_rounded,
            ),
            const SizedBox(height: SSpace.md),
            _Field(
              controller: _notes,
              label: 'Notes for the ${CurrentSetup.term(LexiconKeys.provider).toLowerCase()} (optional)',
              icon: Icons.sticky_note_2_outlined,
              maxLines: 2,
            ),
            const SizedBox(height: SSpace.xl),
            if (_error != null) ...[
              _Banner(message: _error!, danger: true),
              const SizedBox(height: SSpace.lg),
            ],
            if (logistics.quoteError != null) ...[
              _Banner(message: logistics.quoteError!, danger: true),
              const SizedBox(height: SSpace.lg),
            ],
            if (logistics.quote == null)
              FilledButton(
                onPressed: logistics.quoting ? null : _quote,
                child: logistics.quoting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: SColors.white))
                    : const Text('Get a price'),
              )
            else ...[
              _QuoteCard(quote: logistics.quote!),
              const SizedBox(height: SSpace.lg),
              FilledButton(
                onPressed:
                    (_placing || logistics.quoteExpired) ? null : _place,
                child: _placing
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: SColors.white))
                    : Text('Book this $job'),
              ),
              const SizedBox(height: SSpace.sm),
              TextButton(
                onPressed: () {
                  context.read<LogisticsProvider>().clearQuote();
                  setState(() => _error = null);
                },
                child: const Text('Change addresses'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final int maxLines;
  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: SColors.muted, size: 20),
        filled: true,
        fillColor: SColors.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.line),
        ),
      ),
    );
  }
}

/// The price, as the admin configured it.
///
/// Pricing is set once by the business, so this is the quoted amount and the
/// lines behind it — not a market rate. The server also signs the quote for 15
/// minutes, and an expired one is shown as expired rather than booked against.
class _QuoteCard extends StatelessWidget {
  final QuoteResult quote;
  const _QuoteCard({required this.quote});

  String get _currency {
    final c = '${quote.pricing['currency'] ?? ''}'.toUpperCase();
    return switch (c) {
      'USD' => '\u0024',
      'NGN' => '\u20a6',
      'GBP' => '\u00a3',
      'EUR' => '\u20ac',
      '' => '',
      _ => '$c ',
    };
  }

  String _money(dynamic v) {
    final n = v is num ? v : num.tryParse('$v');
    return n == null ? '$v' : '$_currency${n.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    final p = quote.pricing;
    final distance = quote.tracking['distance'];
    final duration = quote.tracking['duration'];
    final base = p['basePrice'];
    final total = quote.total;

    return Container(
      padding: const EdgeInsets.all(SSpace.xl),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(
            color: quote.expired ? SColors.danger : SColors.line),
        boxShadow: SShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(total == null ? 'Price unavailable' : _money(total),
              style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                  color: total == null ? SColors.danger : SColors.ink)),
          if (distance != null || duration != null) ...[
            const SizedBox(height: SSpace.xs),
            Text(
              [
                if (distance != null) '${_num(distance)} km',
                if (duration != null) '${_num(duration)} min',
              ].join('  \u00b7  '),
              style: const TextStyle(color: SColors.muted, fontSize: 13),
            ),
          ],
          // Only worth a line of its own when it differs from the total.
          if (base != null && total != null && (base as num) != total) ...[
            const SizedBox(height: SSpace.lg),
            const Divider(color: SColors.line2, height: 1),
            const SizedBox(height: SSpace.md),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Base', style: TextStyle(color: SColors.muted)),
                Text(_money(base),
                    style: const TextStyle(
                        color: SColors.ink2, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
          if (quote.expired) ...[
            const SizedBox(height: SSpace.md),
            const Text('This price has expired. Get a new one.',
                style: TextStyle(color: SColors.danger, fontSize: 13)),
          ],
        ],
      ),
    );
  }

  static String _num(dynamic v) {
    final n = v is num ? v : num.tryParse('$v');
    if (n == null) return '$v';
    return n == n.roundToDouble()
        ? n.toStringAsFixed(0)
        : n.toStringAsFixed(1);
  }
}

class _Banner extends StatelessWidget {
  final String message;
  final bool danger;
  const _Banner({required this.message, this.danger = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SSpace.md),
      decoration: BoxDecoration(
        color: danger ? const Color(0xFFFBEBEB) : SColors.greenSoft,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(
            color: danger ? SColors.danger : SColors.green, width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(danger ? Icons.error_outline_rounded : Icons.check_circle_outline,
              size: 18, color: danger ? SColors.danger : SColors.green),
          const SizedBox(width: SSpace.sm),
          Expanded(
            child: Text(message,
                style: TextStyle(
                    color: danger ? SColors.danger : SColors.green2,
                    height: 1.35)),
          ),
        ],
      ),
    );
  }
}
