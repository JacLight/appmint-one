import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/driver_provider.dart';
import 'active_job_screen.dart';

/// Go online, see work, take it.
class JobFeedScreen extends StatefulWidget {
  const JobFeedScreen({super.key});
  @override
  State<JobFeedScreen> createState() => _JobFeedScreenState();
}

class _JobFeedScreenState extends State<JobFeedScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DriverProvider>().loadMine();
    });
  }

  Future<void> _toggle(bool on) async {
    final driver = context.read<DriverProvider>();
    final err = on ? await driver.goOnline() : await driver.goOffline();
    if (err != null && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final jobs = CurrentSetup.term(LexiconKeys.jobs).toLowerCase();
    final active = driver.active;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () async {
            await driver.loadFeed();
            await driver.loadMine(silent: true);
          },
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              _OnlineCard(
                online: driver.online,
                busy: driver.goingOnline,
                blockReason: driver.blockReason,
                onChanged: _toggle,
              ),
              if (active != null) ...[
                const SizedBox(height: SSpace.lg),
                _ActiveBanner(job: active),
              ],
              const SizedBox(height: SSpace.xl),
              Text('Available $jobs',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: SSpace.md),
              if (!driver.online)
                const _Hint(
                    text: 'Go online to see work. While offline the '
                        'dispatcher cannot send you anything.')
              else if (driver.loadingFeed)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.only(top: SSpace.xl),
                  child: CircularProgressIndicator(
                      color: SColors.clay, strokeWidth: 2.5),
                ))
              else if (driver.feedError != null)
                _Hint(text: driver.feedError!, danger: true)
              else if (driver.feed.isEmpty)
                _Hint(text: 'No $jobs available right now.')
              else
                ...driver.feed.map((j) => _JobCard(job: j)),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnlineCard extends StatelessWidget {
  final bool online, busy;
  final String? blockReason;
  final ValueChanged<bool> onChanged;
  const _OnlineCard({
    required this.online,
    required this.busy,
    required this.blockReason,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(
            color: online ? SColors.green : SColors.line,
            width: online ? 1.4 : 1),
        boxShadow: SShadow.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: online ? SColors.green : SColors.faint,
                ),
              ),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: Text(online ? 'Online' : 'Offline',
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              if (busy)
                const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: SColors.clay))
              else
                Switch(value: online, onChanged: onChanged),
            ],
          ),
          // The reason is never swallowed: a driver who thinks they are online
          // when the server has no position for them gets no work and no
          // explanation.
          if (blockReason != null) ...[
            const SizedBox(height: SSpace.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 16, color: SColors.danger),
                const SizedBox(width: SSpace.xs),
                Expanded(
                  child: Text(blockReason!,
                      style: const TextStyle(
                          color: SColors.danger, height: 1.35, fontSize: 13)),
                ),
              ],
            ),
          ] else if (online) ...[
            const SizedBox(height: SSpace.xs),
            const Text('Your position is being reported.',
                style: TextStyle(color: SColors.muted, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

class _ActiveBanner extends StatelessWidget {
  final Map<String, dynamic> job;
  const _ActiveBanner({required this.job});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: SColors.greenSoft,
      borderRadius: BorderRadius.circular(SRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(SRadius.md),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ActiveJobScreen(job: job))),
        child: Padding(
          padding: const EdgeInsets.all(SSpace.md),
          child: Row(
            children: [
              const Icon(Icons.play_circle_fill_rounded,
                  color: SColors.green, size: 20),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: Text(
                  'In progress · ${job['status'] ?? 'no status'}',
                  style: const TextStyle(
                      color: SColors.green2, fontWeight: FontWeight.w700),
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: SColors.green),
            ],
          ),
        ),
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  final Map<String, dynamic> job;
  const _JobCard({required this.job});

  @override
  Widget build(BuildContext context) {
    final from = _addr(job['pickup']);
    final to = _addr(job['dropoff']);
    final pay = job['agentPay'] ?? job['payout'] ?? job['total'] ?? job['price'];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Material(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        child: InkWell(
          borderRadius: BorderRadius.circular(SRadius.xl),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => ActiveJobScreen(job: job))),
          child: Container(
            padding: const EdgeInsets.all(SSpace.lg),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(SRadius.xl),
              border: Border.all(color: SColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('${job['status'] ?? 'no status'}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: SColors.ink)),
                    ),
                    if (pay != null)
                      Text('$pay',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: SColors.green)),
                  ],
                ),
                if (from != null) ...[
                  const SizedBox(height: SSpace.sm),
                  _Leg(icon: Icons.trip_origin_rounded, text: from),
                ],
                if (to != null) ...[
                  const SizedBox(height: 2),
                  _Leg(icon: Icons.place_rounded, text: to),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String? _addr(dynamic v) {
    if (v is Map) {
      final a = v['address'] ?? v['formatted'] ?? v['label'];
      if (a != null && '$a'.isNotEmpty) return '$a';
    }
    if (v is String && v.isNotEmpty) return v;
    return null;
  }
}

class _Leg extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Leg({required this.icon, required this.text});
  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: SColors.muted),
          const SizedBox(width: SSpace.xs),
          Expanded(
            child: Text(text,
                style: const TextStyle(color: SColors.ink2, fontSize: 13)),
          ),
        ],
      );
}

class _Hint extends StatelessWidget {
  final String text;
  final bool danger;
  const _Hint({required this.text, this.danger = false});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: SSpace.lg),
        child: Text(text,
            style: TextStyle(
                color: danger ? SColors.danger : SColors.muted, height: 1.4)),
      );
}
