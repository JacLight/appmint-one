import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/scheduling_provider.dart';
import '../../shared/module_states.dart';

/// The provider's day: who is booked, who has arrived, who is waiting.
///
/// Check-in and no-show are server calls — this screen never decides locally
/// that someone turned up.
class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});
  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => context.read<SchedulingProvider>().loadDay());
  }

  Future<void> _act(Future<String?> Function() op) async {
    final err = await op();
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<SchedulingProvider>();
    final customer = CurrentSetup.term(LexiconKeys.customer);

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => s.loadDay(),
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              Text('Today', style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xl),
              if (s.loadingDay)
                const ModuleLoading()
              else if (s.dayError != null)
                ModuleError(message: s.dayError!, onRetry: () => s.loadDay())
              else ...[
                if (s.queue.isNotEmpty) ...[
                  Text('Waiting',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: SSpace.md),
                  ...s.queue.map((t) => _QueueRow(
                        task: t,
                        busy: s.acting ==
                            '${t['id'] ?? t['taskId'] ?? ''}',
                        onAssign: () => _act(() =>
                            s.assign('${t['id'] ?? t['taskId'] ?? ''}')),
                        onNoShow: () => _act(() =>
                            s.noShow('${t['id'] ?? t['taskId'] ?? ''}')),
                      )),
                  const SizedBox(height: SSpace.xl),
                ],
                Text('Booked in',
                    style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: SSpace.md),
                if (s.today.isEmpty)
                  ModuleEmpty(
                    icon: Icons.event_busy_outlined,
                    title: 'Nothing today',
                    body: 'No ${customer.toLowerCase()} is booked in for '
                        'today.',
                  )
                else
                  ...s.today.map((r) => _BookedRow(
                        reservation: r,
                        busy: s.acting ==
                            '${r['id'] ?? r['reservationId'] ?? ''}',
                        onCheckIn: () => _act(() => s.checkIn(
                            '${r['id'] ?? r['reservationId'] ?? ''}')),
                      )),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _QueueRow extends StatelessWidget {
  final Map<String, dynamic> task;
  final bool busy;
  final VoidCallback onAssign, onNoShow;
  const _QueueRow({
    required this.task,
    required this.busy,
    required this.onAssign,
    required this.onNoShow,
  });

  @override
  Widget build(BuildContext context) {
    final who = task['customerName'] ?? task['name'] ?? 'Waiting';
    final pos = task['position'] ?? task['queuePosition'];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            if (pos != null) ...[
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                    color: SColors.claySoft, shape: BoxShape.circle),
                child: Center(
                  child: Text('$pos',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: SColors.clay2)),
                ),
              ),
              const SizedBox(width: SSpace.md),
            ],
            Expanded(
              child: Text('$who',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: SColors.ink)),
            ),
            if (busy)
              const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: SColors.clay))
            else ...[
              TextButton(onPressed: onAssign, child: const Text('Seat')),
              TextButton(
                onPressed: onNoShow,
                style: TextButton.styleFrom(foregroundColor: SColors.danger),
                child: const Text('No-show'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BookedRow extends StatelessWidget {
  final Map<String, dynamic> reservation;
  final bool busy;
  final VoidCallback onCheckIn;
  const _BookedRow({
    required this.reservation,
    required this.busy,
    required this.onCheckIn,
  });

  @override
  Widget build(BuildContext context) {
    final who = reservation['customerName'] ??
        reservation['name'] ??
        CurrentSetup.term(LexiconKeys.customer);
    final when = reservation['serviceDate'] ??
        reservation['startDate'] ??
        reservation['appointmentDate'];
    final service = reservation['serviceName'];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
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
                  Text('$who',
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, color: SColors.ink)),
                  if (service != null || when != null)
                    Text(
                      [
                        if (service != null) '$service',
                        if (when != null)
                          '$when'.replaceFirst('T', ' ').split('.').first,
                      ].join(' · '),
                      style: const TextStyle(
                          color: SColors.faint, fontSize: 12.5),
                    ),
                ],
              ),
            ),
            if (busy)
              const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: SColors.clay))
            else
              FilledButton(
                  onPressed: onCheckIn, child: const Text('Check in')),
          ],
        ),
      ),
    );
  }
}
