import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';

/// Check out an item, but SHOW THE COST — before (a preview) and after (what was
/// actually added to the bill). The operator must see the number at hand-back;
/// both call sites used to fire `itemCheckout` and throw the statement away.
///
/// Returns true only if a checkout actually happened, so the caller reloads.
Future<bool> runCheckout(
  BuildContext context,
  StowboApi api,
  String itemId, {
  String? label,
}) async {
  // 1) Preview — writes nothing, tells us the cost and whether it CAN close.
  Map<String, dynamic> preview;
  try {
    preview = await api.itemCheckoutPreview(itemId);
  } catch (e) {
    _toast(context, e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    return false;
  }
  if (!context.mounted) return false;

  final canCheckOut = preview['canCheckOut'] == true;
  final used = double.tryParse('${preview['used']}') ?? 0;
  final overstay = double.tryParse('${preview['overstay']}') ?? 0;
  final cur = (preview['currency'] ?? 'USD').toString();
  final due = used + overstay;

  if (!canCheckOut) {
    _toast(context, 'Still here — move it out first, then check out.',
        SColors.danger);
    return false;
  }

  // 2) Confirm, WITH the cost in front of the operator.
  final go = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: SColors.card,
      title: Text('Check out${label != null ? ' · $label' : ''}?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('This closes the stay and frees the space.',
              style: TextStyle(color: SColors.muted)),
          const SizedBox(height: SSpace.md),
          if (due <= 0)
            const Text('Nothing to collect.',
                style: TextStyle(fontWeight: FontWeight.w700))
          else ...[
            _line('This stay', '$cur ${used.toStringAsFixed(2)}'),
            if (overstay > 0)
              _line('Overstay', '$cur ${overstay.toStringAsFixed(2)}',
                  danger: true),
            const Divider(color: SColors.line),
            _line('Added to the bill', '$cur ${due.toStringAsFixed(2)}',
                bold: true),
          ],
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel')),
        ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Check out')),
      ],
    ),
  );
  if (go != true || !context.mounted) return false;

  // 3) Close it, and report what actually got charged.
  try {
    final res = await api.itemCheckout(itemId);
    final charged = (double.tryParse('${res['used']}') ?? 0) +
        (double.tryParse('${res['overstay']}') ?? 0);
    _toast(
        context,
        charged > 0
            ? 'Checked out · $cur ${charged.toStringAsFixed(2)} added to the bill'
            : 'Checked out',
        SColors.green);
    return true;
  } catch (e) {
    _toast(context, e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    return false;
  }
}

void _toast(BuildContext context, String msg, Color color) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color));
}

Widget _line(String k, String v, {bool bold = false, bool danger = false}) =>
    Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k,
              style: TextStyle(color: danger ? SColors.danger : SColors.muted)),
          Text(v,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: danger ? SColors.danger : SColors.ink)),
        ],
      ),
    );
