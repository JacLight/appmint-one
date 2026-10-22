import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import '../../widgets/host_booking_card.dart';
import 'host_handovers_screen.dart';

/// Every booking across ALL your listings, in one place — filter by status,
/// search by reference / customer / listing. No more listing-by-listing.
class HostBookingsScreen extends StatefulWidget {
  const HostBookingsScreen({super.key});
  @override
  State<HostBookingsScreen> createState() => _HostBookingsScreenState();
}

const _filters = <String, String?>{
  'All': null,
  'New': 'new',
  'Active': 'active',
  'Completed': 'completed',
};

class _HostBookingsScreenState extends State<HostBookingsScreen> {
  final _api = StowboApi();
  final _q = TextEditingController();
  String _statusFilter = 'All';
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _api.hostBookings(status: _filters[_statusFilter]);
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _visible {
    final q = _q.text.trim().toLowerCase();
    if (q.isEmpty) return _rows;
    return _rows.where((r) {
      return (r['reference'] ?? '').toString().toLowerCase().contains(q) ||
          (r['customer'] ?? '').toString().toLowerCase().contains(q) ||
          (r['customerName'] ?? '').toString().toLowerCase().contains(q) ||
          (r['listingTitle'] ?? '').toString().toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.xl, SSpace.lg, SSpace.xl, SSpace.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Bookings',
                        style: Theme.of(context).textTheme.displayLarge),
                  ),
                  IconButton(
                    tooltip: 'Hand-offs',
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const HostHandoversScreen())),
                    icon: const Icon(Icons.handshake_outlined),
                  ),
                  IconButton(
                    tooltip: 'Refresh',
                    onPressed: _loading ? null : _load,
                    icon: const Icon(Icons.refresh_rounded),
                  ),
                ],
              ),
            ),
            // Search.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.xl),
              child: Container(
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.pill),
                  border: Border.all(color: SColors.line, width: 1.2),
                ),
                padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                child: Row(children: [
                  const Icon(Icons.search_rounded,
                      color: SColors.muted, size: 20),
                  const SizedBox(width: SSpace.sm),
                  Expanded(
                    child: TextField(
                      controller: _q,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: 'Search reference, customer, listing…',
                        contentPadding: EdgeInsets.symmetric(vertical: 13),
                      ),
                    ),
                  ),
                  if (_q.text.isNotEmpty)
                    GestureDetector(
                      onTap: () => setState(() => _q.clear()),
                      child: const Icon(Icons.close_rounded,
                          color: SColors.muted, size: 18),
                    ),
                ]),
              ),
            ),
            // Status filter.
            SizedBox(
              height: 46,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.sm, SSpace.xl, 0),
                children: _filters.keys.map((k) {
                  final on = _statusFilter == k;
                  return Padding(
                    padding: const EdgeInsets.only(right: SSpace.sm),
                    child: ChoiceChip(
                      label: Text(k),
                      selected: on,
                      showCheckmark: false,
                      selectedColor: SColors.ink,
                      backgroundColor: SColors.card,
                      labelStyle: TextStyle(
                          color: on ? Colors.white : SColors.ink2,
                          fontWeight: FontWeight.w600,
                          fontSize: 12.5),
                      onSelected: (_) {
                        setState(() => _statusFilter = k);
                        _load();
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading && _rows.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    if (_error != null && _rows.isEmpty) {
      return EmptyState(
        icon: Icons.wifi_off_rounded,
        title: "Couldn't load bookings",
        subtitle: _error,
        action: OutlinedButton(onPressed: _load, child: const Text('Retry')),
      );
    }
    final rows = _visible;
    if (rows.isEmpty) {
      return const EmptyState(
        icon: Icons.event_busy_rounded,
        title: 'No bookings',
        subtitle: 'Nothing matches this filter.',
      );
    }
    return RefreshIndicator(
      color: SColors.clay,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(SSpace.xl, SSpace.md, SSpace.xl, 110),
        children: rows.map(_row).toList(),
      ),
    );
  }

  Widget _row(Map<String, dynamic> r) => HostBookingCard(row: r);
}
