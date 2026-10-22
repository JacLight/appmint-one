import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/logistics_provider.dart';
import '../job_status.dart';

/// Where it is and what stage it is at.
///
/// Polls `GET /logistics/orders/:id/track` every 10s because appengine has no
/// logistics socket gateway yet. The stage shown is the server's, verbatim —
/// the app does not translate a status it was not told the meaning of.
class TrackScreen extends StatefulWidget {
  final String jobId;
  const TrackScreen({super.key, required this.jobId});

  @override
  State<TrackScreen> createState() => _TrackScreenState();
}

class _TrackScreenState extends State<TrackScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LogisticsProvider>().startTracking(widget.jobId);
    });
  }

  @override
  void dispose() {
    // Guard: the provider may already be disposed if the app is shutting down.
    try {
      context.read<LogisticsProvider>().stopTracking();
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final logistics = context.watch<LogisticsProvider>();
    final t = logistics.tracking;
    final provider = CurrentSetup.term(LexiconKeys.provider);

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text('Track ${CurrentSetup.term(LexiconKeys.job).toLowerCase()}'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SSpace.xl),
          children: [
            if (logistics.trackError != null)
              _Tile(
                title: "Can't reach the server",
                body: logistics.trackError!,
                danger: true,
              )
            else if (t == null)
              const Padding(
                padding: EdgeInsets.only(top: SSpace.xxl),
                child: Center(
                    child: CircularProgressIndicator(
                        color: SColors.clay, strokeWidth: 2.5)),
              )
            else ...[
              _StageCard(tracking: t),
              const SizedBox(height: SSpace.lg),
              if (_agentName(t) != null)
                _Tile(title: provider, body: _agentName(t)!),
              if (_coords(t) != null) ...[
                const SizedBox(height: SSpace.md),
                _Tile(
                  title: '$provider position',
                  body: _coords(t)!,
                  hint: 'Updated every 10 seconds',
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  static String? _agentName(Map<String, dynamic> t) {
    final a = t['agent'];
    if (a is Map) {
      final n = a['name'] ?? a['fullName'] ?? a['email'];
      if (n != null && '$n'.isNotEmpty) return '$n';
    }
    final n = t['agentName'];
    return (n == null || '$n'.isEmpty) ? null : '$n';
  }

  static String? _coords(Map<String, dynamic> t) {
    num? lat, lng;
    for (final src in [t, t['location'], t['agent']]) {
      if (src is Map) {
        lat ??= src['latitude'] as num? ?? src['lat'] as num?;
        lng ??= src['longitude'] as num? ?? src['lng'] as num?;
      }
    }
    if (lat == null || lng == null) return null;
    return '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
  }
}

class _StageCard extends StatelessWidget {
  final Map<String, dynamic> tracking;
  const _StageCard({required this.tracking});

  @override
  Widget build(BuildContext context) {
    final status = JobStatus.of(tracking);
    final eta = tracking['eta'] ?? tracking['etaMinutes'];

    return Container(
      padding: const EdgeInsets.all(SSpace.xl),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line),
        boxShadow: SShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Stage', style: TextStyle(color: SColors.muted)),
          const SizedBox(height: SSpace.xs),
          Text(
            JobStatus.forCustomer(status),
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(color: JobStatus.colour(status)),
          ),
          if (eta != null) ...[
            const SizedBox(height: SSpace.md),
            Row(
              children: [
                const Icon(Icons.schedule_rounded,
                    size: 16, color: SColors.muted),
                const SizedBox(width: SSpace.xs),
                Text('ETA $eta',
                    style: const TextStyle(color: SColors.ink2)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String title, body;
  final String? hint;
  final bool danger;
  const _Tile(
      {required this.title, required this.body, this.hint, this.danger = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: danger ? const Color(0xFFFBEBEB) : SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: danger ? SColors.danger : SColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  color: danger ? SColors.danger : SColors.muted,
                  fontSize: 13)),
          const SizedBox(height: SSpace.xs),
          Text(body,
              style: TextStyle(
                  color: danger ? SColors.danger : SColors.ink,
                  fontWeight: FontWeight.w600)),
          if (hint != null) ...[
            const SizedBox(height: SSpace.xs),
            Text(hint!,
                style: const TextStyle(color: SColors.faint, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
