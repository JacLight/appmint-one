import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../widgets/stowbo_widgets.dart';
import 'booking_dashboard_screen.dart';

/// Hand-offs on my listings: who collected what for whom, when, what was
/// checked, plus every refusal. The host's own record for a dispute.
class HostHandoversScreen extends StatefulWidget {
  const HostHandoversScreen({super.key});
  @override
  State<HostHandoversScreen> createState() => _HostHandoversScreenState();
}

class _HostHandoversScreenState extends State<HostHandoversScreen> {
  final _api = stowboApi;
  Map<String, dynamic> _data = {};
  bool _loading = true;
  String? _error;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _data = await _api.hostHandovers(status: _filter == 'all' ? null : _filter);
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  String _when(dynamic iso) {
    final t = iso == null ? null : DateTime.tryParse(iso.toString())?.toLocal();
    return t == null ? '—' : DateFormat('d MMM, h:mm a').format(t);
  }

  @override
  Widget build(BuildContext context) {
    final handoffs = (_data['handoffs'] as List?)?.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() ?? [];
    final refusals = (_data['refusals'] as List?)?.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() ?? [];
    final totals = (_data['totals'] is Map) ? Map<String, dynamic>.from(_data['totals']) : {};
    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(title: const Text('Hand-offs')),
      body: RefreshIndicator(
        color: SColors.clay,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: SColors.clay))
            : _error != null
                ? ListView(children: [const SizedBox(height: 80), EmptyState(icon: Icons.cloud_off_rounded, title: _error!)])
                : ListView(
                    padding: const EdgeInsets.all(SSpace.xl),
                    children: [
                      Row(children: [
                        for (final f in const [('all', 'All'), ('active', 'Waiting'), ('completed', 'Collected'), ('revoked', 'Revoked')])
                          Padding(
                            padding: const EdgeInsets.only(right: SSpace.sm),
                            child: ChoiceChip(
                              label: Text(f.$2),
                              selected: _filter == f.$1,
                              onSelected: (_) {
                                setState(() => _filter = f.$1);
                                _load();
                              },
                            ),
                          ),
                      ]),
                      const SizedBox(height: SSpace.md),
                      Row(children: [
                        _stat('Hand-offs', '${totals['handoffs'] ?? handoffs.length}'),
                        _stat('Collected', '${totals['completed'] ?? 0}'),
                        _stat('Waiting', '${totals['active'] ?? 0}'),
                        _stat('Refused', '${totals['refusals'] ?? refusals.length}'),
                      ]),
                      const SizedBox(height: SSpace.lg),
                      if (handoffs.isEmpty && refusals.isEmpty)
                        const EmptyState(
                          icon: Icons.handshake_outlined,
                          title: 'No hand-offs yet',
                          subtitle: 'When a guest lets someone else collect, it shows here with what you checked.',
                        ),
                      for (final h in handoffs) _handoffTile(h),
                      if (refusals.isNotEmpty) ...[
                        const SizedBox(height: SSpace.md),
                        const SectionLabel('REFUSED'),
                        for (final r in refusals) _refusalTile(r),
                      ],
                    ],
                  ),
      ),
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: SColors.muted, fontSize: 11.5)),
        ]),
      );

  Widget _handoffTile(Map<String, dynamic> h) {
    final delegate = h['delegate'] is Map ? Map<String, dynamic>.from(h['delegate']) : {};
    final items = (h['itemDetails'] as List?)?.whereType<Map>().toList() ?? [];
    final outs = (h['handovers'] as List?)?.whereType<Map>().toList() ?? [];
    final status = (h['status'] ?? '').toString();
    final color = status == 'completed' ? SColors.green : status == 'active' ? SColors.clay : SColors.muted;
    final what = items.isEmpty
        ? '${(h['items'] as List?)?.length ?? 0} item(s)'
        : items.map((i) => (i['label'] ?? i['identifier'] ?? (i['unit'] != null ? 'Bay ${i['unit']}' : 'item')).toString()).join(', ');
    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => BookingDashboardScreen(bookingId: h['booking'].toString()))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(delegate['name']?.toString().isNotEmpty == true ? delegate['name'].toString() : (delegate['phone'] ?? delegate['email'] ?? 'Collector').toString(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: color.withValues(alpha: .14), borderRadius: BorderRadius.circular(SRadius.pill)),
              child: Text(status == 'active' ? 'Waiting' : status == 'completed' ? 'Collected' : status == 'revoked' ? 'Revoked' : status,
                  style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 2),
          Text('$what · ${h['listing'] ?? ''} · ${h['verifyLabel'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: SColors.muted, fontSize: 13)),
          for (final o in outs)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(children: [
                const Icon(Icons.handshake_rounded, size: 14, color: SColors.green),
                const SizedBox(width: 4),
                Expanded(
                  child: Text('${_when(o['at'])} · checked ${((o['verified'] as List?) ?? []).map((v) => v == 'id' ? 'photo ID' : v).join(', ')}${(o['photos'] as List?)?.isNotEmpty == true ? ' · photo' : ''}',
                      style: const TextStyle(fontSize: 12.5, color: SColors.ink2)),
                ),
              ]),
            ),
          if (status == 'active')
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Sent ${_when(h['sentAt'] ?? h['createdAt'])}${h['validUntil'] != null ? ' · until ${_when(h['validUntil'])}' : ''}', style: const TextStyle(fontSize: 12.5, color: SColors.muted)),
            ),
        ]),
      ),
    );
  }

  Widget _refusalTile(Map<String, dynamic> r) => Padding(
        padding: const EdgeInsets.only(bottom: SSpace.sm),
        child: SCard(
          onTap: r['booking'] == null ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => BookingDashboardScreen(bookingId: r['booking'].toString()))),
          child: Row(children: [
            const Icon(Icons.block_rounded, color: SColors.danger, size: 18),
            const SizedBox(width: SSpace.sm),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r['label'] ?? 'Item'} · ${(r['reason'] ?? '').toString().replaceAll('_', ' ')}${r['who'] != null ? ' · ${r['who']}' : ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('${_when(r['at'])} · ${r['listing'] ?? ''}${r['note'] != null ? ' · ${r['note']}' : ''}', style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
              ]),
            ),
          ]),
        ),
      );
}
