import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/logistics_provider.dart';
import 'track_screen.dart';

/// Past and in-flight orders. Status is the server's word, shown as given.
class MyDeliveriesScreen extends StatefulWidget {
  const MyDeliveriesScreen({super.key});
  @override
  State<MyDeliveriesScreen> createState() => _MyDeliveriesScreenState();
}

class _MyDeliveriesScreenState extends State<MyDeliveriesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => context.read<LogisticsProvider>().loadOrders());
  }

  @override
  Widget build(BuildContext context) {
    final logistics = context.watch<LogisticsProvider>();
    final jobs = CurrentSetup.term(LexiconKeys.jobs);

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => logistics.loadOrders(),
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              Text(jobs, style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xl),
              if (logistics.loadingOrders)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.only(top: SSpace.xxl),
                  child: CircularProgressIndicator(
                      color: SColors.clay, strokeWidth: 2.5),
                ))
              else if (logistics.ordersError != null)
                _Message(
                  icon: Icons.error_outline_rounded,
                  title: "Can't load your $jobs".toLowerCase(),
                  body: logistics.ordersError!,
                  danger: true,
                )
              else if (logistics.orders.isEmpty)
                _Message(
                  icon: Icons.inbox_outlined,
                  title: 'Nothing yet',
                  body: 'Your ${jobs.toLowerCase()} will appear here once you book one.',
                )
              else
                ...logistics.orders.map((o) => _OrderCard(order: o)),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  const _OrderCard({required this.order});

  String get _id => '${order['id'] ?? order['jobId'] ?? ''}';

  @override
  Widget build(BuildContext context) {
    final status = '${order['status'] ?? ''}';
    final from = _addr(order['pickup']);
    final to = _addr(order['dropoff']);

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Material(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.xl),
        child: InkWell(
          borderRadius: BorderRadius.circular(SRadius.xl),
          onTap: _id.isEmpty
              ? null
              : () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => TrackScreen(jobId: _id))),
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
                      child: Text(
                        status.isEmpty ? 'No status from the server' : status,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: status.isEmpty ? SColors.danger : SColors.ink,
                        ),
                      ),
                    ),
                    if (order['total'] != null || order['price'] != null)
                      Text('${order['total'] ?? order['price']}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: SColors.ink)),
                  ],
                ),
                if (from != null || to != null) ...[
                  const SizedBox(height: SSpace.sm),
                  if (from != null)
                    _Leg(icon: Icons.trip_origin_rounded, text: from),
                  if (to != null) ...[
                    const SizedBox(height: 2),
                    _Leg(icon: Icons.place_rounded, text: to),
                  ],
                ],
                if (order['createdate'] != null) ...[
                  const SizedBox(height: SSpace.sm),
                  Text('${order['createdate']}',
                      style: const TextStyle(
                          color: SColors.faint, fontSize: 12)),
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
  Widget build(BuildContext context) {
    return Row(
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
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title, body;
  final bool danger;
  const _Message({
    required this.icon,
    required this.title,
    required this.body,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: SSpace.xxl),
      child: Column(
        children: [
          Icon(icon, size: 34, color: danger ? SColors.danger : SColors.faint),
          const SizedBox(height: SSpace.md),
          Text(title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center),
          const SizedBox(height: SSpace.xs),
          Text(body,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: danger ? SColors.danger : SColors.muted, height: 1.4)),
        ],
      ),
    );
  }
}
