import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/scheduling_provider.dart';
import '../../shared/module_states.dart';

/// The customer's own bookings.
///
/// Every noun on this screen comes from the setup's lexicon, so the same
/// widget reads "Appointments" in a clinic, "Matters" in a law firm and
/// "Classes" in a studio.
class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<SchedulingProvider>().loadBookings());
  }

  @override
  Widget build(BuildContext context) {
    final scheduling = context.watch<SchedulingProvider>();
    final plural = CurrentSetup.term(LexiconKeys.bookings);

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: () => scheduling.loadBookings(),
          child: ListView(
            padding: const EdgeInsets.all(SSpace.xl),
            children: [
              Text(plural, style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: SSpace.xl),
              if (scheduling.loadingBookings)
                const ModuleLoading()
              else if (scheduling.bookingsError != null)
                ModuleError(message: scheduling.bookingsError!)
              else if (scheduling.bookings.isEmpty)
                ModuleEmpty(
                  icon: Icons.event_available_outlined,
                  title: 'Nothing booked',
                  body: 'Your ${plural.toLowerCase()} appear here once you '
                      'book one.',
                )
              else
                ...scheduling.bookings.map((b) => _BookingCard(booking: b)),
            ],
          ),
        ),
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final Map<String, dynamic> booking;
  const _BookingCard({required this.booking});

  String get _id => '${booking['id'] ?? booking['reservationId'] ?? ''}';

  @override
  Widget build(BuildContext context) {
    final title = booking['serviceName'] ??
        booking['title'] ??
        CurrentSetup.term(LexiconKeys.booking);
    final when = booking['serviceDate'] ??
        booking['startDate'] ??
        booking['appointmentDate'];
    final status = '${booking['status'] ?? ''}';

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          border: Border.all(color: SColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('$title',
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                if (status.isNotEmpty)
                  Text(status,
                      style: const TextStyle(
                          color: SColors.muted, fontSize: 12.5)),
              ],
            ),
            if (when != null) ...[
              const SizedBox(height: SSpace.xs),
              Row(
                children: [
                  const Icon(Icons.schedule_rounded,
                      size: 14, color: SColors.muted),
                  const SizedBox(width: SSpace.xs),
                  Text('$when'.replaceFirst('T', ' ').split('.').first,
                      style: const TextStyle(
                          color: SColors.ink2, fontSize: 13)),
                ],
              ),
            ],
            if (_id.isNotEmpty) ...[
              const SizedBox(height: SSpace.md),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () async {
                    final err = await context
                        .read<SchedulingProvider>()
                        .cancel(_id);
                    if (err != null && context.mounted) {
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text(err)));
                    }
                  },
                  style: TextButton.styleFrom(
                      foregroundColor: SColors.danger,
                      padding: EdgeInsets.zero),
                  child: const Text('Cancel'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
