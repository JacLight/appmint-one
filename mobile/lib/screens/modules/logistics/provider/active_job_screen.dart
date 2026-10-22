import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/driver_provider.dart';
import '../job_status.dart';

/// One job, and the next step on it.
///
/// The steps offered come from the server's status. Where that status is not
/// one this app recognises, every forward step is offered rather than guessing
/// and hiding the one the driver needs — and the raw status is always shown, so
/// the driver can see what the server actually said.
class ActiveJobScreen extends StatefulWidget {
  final Map<String, dynamic> job;
  const ActiveJobScreen({super.key, required this.job});

  @override
  State<ActiveJobScreen> createState() => _ActiveJobScreenState();
}

class _ActiveJobScreenState extends State<ActiveJobScreen> {
  late Map<String, dynamic> _job;
  String? _error;

  @override
  void initState() {
    super.initState();
    _job = widget.job;
  }

  String get _id => '${_job['id'] ?? _job['jobId'] ?? ''}';

  Future<void> _run(DriverAction action) async {
    if (_id.isEmpty) {
      setState(() => _error =
          'This job has no id, so no step can be sent to the server.');
      return;
    }
    final driver = context.read<DriverProvider>();
    setState(() => _error = null);

    String? reason;
    if (action == DriverAction.fail ||
        action == DriverAction.cancel ||
        action == DriverAction.reject) {
      reason = await _askReason(action.label);
      if (reason == null) return; // dismissed
    }

    final err = await driver.act(_id, action, reason: reason);
    if (!mounted) return;
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    // Re-read this job from the refreshed list so the buttons match the server.
    final fresh = driver.mine.firstWhere(
      (j) => '${j['id'] ?? j['jobId'] ?? ''}' == _id,
      orElse: () => const {},
    );
    if (fresh.isNotEmpty) {
      setState(() => _job = fresh);
    } else {
      // No longer in the active list — it finished or was handed on.
      Navigator.of(context).pop();
    }
  }

  Future<String?> _askReason(String what) async {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SColors.card,
        title: Text(what),
        content: TextField(
          controller: c,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Reason'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Back')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(c.text.trim()),
              child: Text(what)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final driver = context.watch<DriverProvider>();
    final busy = driver.acting == _id;
    final actions = DriverProvider.nextActions(_job);
    final status = JobStatus.of(_job);

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: const Text('Job'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SSpace.xl),
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(SSpace.lg),
              decoration: BoxDecoration(
                color: SColors.card,
                borderRadius: BorderRadius.circular(SRadius.xl),
                border: Border.all(color: SColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Stage',
                      style: TextStyle(color: SColors.muted, fontSize: 13)),
                  const SizedBox(height: SSpace.xs),
                  Text(JobStatus.forDriver(status),
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(color: JobStatus.colour(status))),
                ],
              ),
            ),
            const SizedBox(height: SSpace.lg),
            _Legs(job: _job),
            if (_error != null) ...[
              const SizedBox(height: SSpace.lg),
              Container(
                padding: const EdgeInsets.all(SSpace.md),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBEBEB),
                  borderRadius: BorderRadius.circular(SRadius.md),
                  border: Border.all(color: SColors.danger, width: 0.8),
                ),
                child: Text(_error!,
                    style: const TextStyle(
                        color: SColors.danger, height: 1.35)),
              ),
            ],
            const SizedBox(height: SSpace.xl),
            if (actions.isNotEmpty) ...[
              Text('Next', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: SSpace.md),
            ],
            ...actions.map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: SSpace.sm),
                  child: _destructive(a)
                      ? OutlinedButton(
                          onPressed: busy ? null : () => _run(a),
                          style: OutlinedButton.styleFrom(
                              foregroundColor: SColors.danger),
                          child: Text(a.label),
                        )
                      : FilledButton(
                          onPressed: busy ? null : () => _run(a),
                          child: busy
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: SColors.white))
                              : Text(a.label),
                        ),
                )),
          ],
        ),
      ),
    );
  }

  static bool _destructive(DriverAction a) =>
      a == DriverAction.fail ||
      a == DriverAction.cancel ||
      a == DriverAction.reject;
}

class _Legs extends StatelessWidget {
  final Map<String, dynamic> job;
  const _Legs({required this.job});

  @override
  Widget build(BuildContext context) {
    final from = _addr(job['pickup']);
    final to = _addr(job['dropoff']);
    if (from == null && to == null) {
      return const Text('The server returned no addresses for this job.',
          style: TextStyle(color: SColors.danger));
    }
    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: SColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (from != null) _Row(label: 'Pickup', value: from),
          if (from != null && to != null) const SizedBox(height: SSpace.md),
          if (to != null) _Row(label: 'Drop-off', value: to),
        ],
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

class _Row extends StatelessWidget {
  final String label, value;
  const _Row({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 13)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(
                  color: SColors.ink, fontWeight: FontWeight.w600)),
        ],
      );
}
