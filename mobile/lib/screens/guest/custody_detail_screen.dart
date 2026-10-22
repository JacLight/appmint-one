import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../config/stowbo_theme.dart';
import '../../models/custody.dart';
import '../../providers/auth_provider.dart';
import '../../providers/custody_provider.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';

/// Guest's view of a single booking. Shows the handoff code (the trust anchor),
/// the live custody state, and the running charge once stored.
class CustodyDetailScreen extends StatelessWidget {
  final Custody custody;
  final bool justBooked;
  const CustodyDetailScreen(
      {super.key, required this.custody, this.justBooked = false});

  @override
  Widget build(BuildContext context) {
    final c = custody;
    return Scaffold(
      appBar: AppBar(
        title: Text(c.hostName),
        actions: [
          IconButton(
            tooltip: 'Message host',
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ChatScreen(
                  recipientId:
                      c.hostEmail.isNotEmpty ? c.hostEmail : c.hostId,
                  recipientName: c.hostName,
                  subtitle: 'Host',
                  bookingId: c.sk,
                ),
              ),
            ),
          ),
          if (c.status == CustodyStatus.reserved)
            IconButton(
              tooltip: 'Cancel booking',
              icon: const Icon(Icons.cancel_outlined, color: SColors.danger),
              onPressed: () => _confirmCancel(context, c),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(SSpace.xl),
        children: [
          if (justBooked)
            Container(
              margin: const EdgeInsets.only(bottom: SSpace.lg),
              padding: const EdgeInsets.all(SSpace.md),
              decoration: BoxDecoration(
                  color: SColors.greenSoft,
                  borderRadius: BorderRadius.circular(SRadius.md)),
              child: Row(children: const [
                Icon(Icons.check_circle_rounded, color: SColors.green),
                SizedBox(width: SSpace.sm),
                Expanded(
                  child: Text('Reserved! Show this code at drop-off.',
                      style: TextStyle(
                          color: SColors.green2, fontWeight: FontWeight.w600)),
                ),
              ]),
            ),
          Row(
            children: [
              CustodyBadge(c.status),
              const Spacer(),
              Text('${c.itemCount} item${c.itemCount > 1 ? 's' : ''}',
                  style: const TextStyle(
                      color: SColors.muted, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: SSpace.lg),
          if (c.status == CustodyStatus.reserved ||
              c.status == CustodyStatus.stored)
            _HandoffQr(
              bookingId: c.sk,
              code: c.status == CustodyStatus.stored
                  ? c.pickupCode
                  : c.handoffCode,
              isPickup: c.status == CustodyStatus.stored,
            ),
          const SizedBox(height: SSpace.lg),
          SCard(
            child: Column(
              children: [
                _step(
                  done: true,
                  active: c.status == CustodyStatus.reserved,
                  icon: Icons.event_available_rounded,
                  title: 'Reserved',
                  subtitle: 'Show your code at the counter to drop off.',
                ),
                _connector(c.status.index >= CustodyStatus.stored.index),
                _step(
                  done: c.status.index >= CustodyStatus.stored.index,
                  active: c.status == CustodyStatus.stored,
                  icon: Icons.inventory_2_rounded,
                  title: 'Stored',
                  subtitle: c.storedAt == null
                      ? 'The host photographs and counts your items.'
                      : 'Held for ${humanDuration(c.elapsed())} · est. ${money(c.estimatedCharge())}',
                ),
                _connector(c.status.index >= CustodyStatus.retrieved.index),
                _step(
                  done: c.status.index >= CustodyStatus.retrieved.index,
                  active: c.status == CustodyStatus.retrieved,
                  icon: Icons.check_circle_rounded,
                  title: 'Retrieved',
                  subtitle: 'Show your code again to grab your stuff.',
                ),
                _connector(c.status == CustodyStatus.closed),
                _step(
                  done: c.status == CustodyStatus.closed,
                  active: c.status == CustodyStatus.closed,
                  icon: Icons.receipt_long_rounded,
                  title: 'Settled',
                  subtitle: c.amount == null
                      ? 'Final charge for the time held.'
                      : 'Charged ${money(c.amount!)}. Thanks!',
                ),
              ],
            ),
          ),
          const SizedBox(height: SSpace.lg),
          if (c.awaitingPayment) _PayCard(custody: c),
          if (c.isPaid)
            SCard(
              color: SColors.greenSoft,
              child: Row(children: [
                const Icon(Icons.receipt_long_rounded, color: SColors.green),
                const SizedBox(width: SSpace.md),
                Expanded(
                  child: Text(
                    'Paid ${money(c.amount!)}${c.paymentMethod == 'cash' ? ' (cash)' : ''} · thanks for using Stowbo!',
                    style: const TextStyle(
                        color: SColors.green2, fontWeight: FontWeight.w600),
                  ),
                ),
              ]),
            ),
          if (c.status == CustodyStatus.stored)
            SCard(
              color: SColors.ink,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Running charge',
                      style: TextStyle(
                          color: SColors.lime,
                          fontSize: 12,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(money(c.estimatedCharge()),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 30,
                          fontWeight: FontWeight.w700)),
                  Text('${c.itemCount} item(s) · held ${humanDuration(c.elapsed())}',
                      style: const TextStyle(color: Color(0xFFC9CABF))),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _step({
    required bool done,
    required bool active,
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final color = done ? SColors.green : SColors.faint;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
              color: done ? SColors.greenSoft : SColors.line2,
              shape: BoxShape.circle),
          child: Icon(icon, size: 20, color: color),
        ),
        const SizedBox(width: SSpace.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: active || done ? SColors.ink : SColors.muted)),
              const SizedBox(height: 2),
              Text(subtitle,
                  style:
                      const TextStyle(color: SColors.muted, fontSize: 13)),
              const SizedBox(height: SSpace.md),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmCancel(BuildContext context, Custody c) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Cancel booking?'),
        content: Text(
            'Cancel your reservation at ${c.hostName}? This can only be done before drop-off.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep it')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (yes != true || !context.mounted) return;
    final ok = await context.read<CustodyProvider>().cancel(c.sk);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Booking cancelled'), backgroundColor: SColors.ink));
      Navigator.pop(context);
    } else {
      final err = context.read<CustodyProvider>().error ?? 'Could not cancel';
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err), backgroundColor: SColors.danger));
    }
  }

  Widget _connector(bool filled) => Padding(
        padding: const EdgeInsets.only(left: 18),
        child: Container(
          width: 2,
          height: 14,
          color: filled ? SColors.green : SColors.line,
          margin: const EdgeInsets.only(bottom: SSpace.sm),
        ),
      );
}

/// The scannable handoff — QR the host scans + the code as a fallback.
class _HandoffQr extends StatelessWidget {
  final String bookingId;
  final String code;
  final bool isPickup;
  const _HandoffQr(
      {required this.bookingId, required this.code, required this.isPickup});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: SColors.ink,
        borderRadius: BorderRadius.circular(SRadius.lg),
      ),
      child: Column(
        children: [
          Text(isPickup ? 'SHOW AT PICKUP' : 'SHOW AT DROP-OFF',
              style: const TextStyle(
                  color: SColors.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: SSpace.md),
          Container(
            padding: const EdgeInsets.all(SSpace.md),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(SRadius.md)),
            child: QrImageView(
              data: '$bookingId|$code',
              size: 190,
              backgroundColor: Colors.white,
              padding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: SSpace.md),
          Text(code.isEmpty ? bookingId : code.split('').join(' '),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3)),
          const SizedBox(height: 4),
          const Text('The host scans this to verify.',
              style: TextStyle(color: Color(0xFF9D998C), fontSize: 12)),
        ],
      ),
    );
  }
}

/// Guest card-payment CTA shown once items are handed back (RETRIEVED, unpaid).
class _PayCard extends StatefulWidget {
  final Custody custody;
  const _PayCard({required this.custody});
  @override
  State<_PayCard> createState() => _PayCardState();
}

class _PayCardState extends State<_PayCard> {
  bool _paying = false;

  Future<void> _pay() async {
    setState(() => _paying = true);
    final cp = context.read<CustodyProvider>();
    final email = context.read<AuthProvider>().user?.email;
    final charged = await cp.payWithCard(widget.custody, email: email);
    if (!mounted) return;
    setState(() => _paying = false);
    if (charged != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Paid ${money(charged)} ✓'),
          backgroundColor: SColors.green));
      Navigator.pop(context);
    } else if (cp.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(cp.error!), backgroundColor: SColors.danger));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.custody;
    return SCard(
      color: SColors.ink,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('AMOUNT DUE',
              style: TextStyle(
                  color: SColors.lime,
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(money(c.estimatedCharge()),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w700)),
          Text('${c.itemCount} item(s) · held ${humanDuration(c.elapsed())}',
              style: const TextStyle(color: Color(0xFFC9CABF))),
          const SizedBox(height: SSpace.lg),
          ElevatedButton.icon(
            onPressed: _paying ? null : _pay,
            icon: _paying
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2.2))
                : const Icon(Icons.credit_card_rounded),
            label: Text(_paying ? 'Processing…' : 'Pay with card'),
          ),
          const SizedBox(height: 6),
          const Center(
            child: Text('Paid at pickup — only for the time held.',
                style: TextStyle(color: Color(0xFF9D998C), fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
