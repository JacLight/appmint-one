import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/haho_theme.dart';
import '../providers/pos_provider.dart';

/// The phone's always-visible order summary; full service actions open on demand.
class PosMobileCart extends StatelessWidget {
  final VoidCallback onReview;
  final String actionLabel;
  final bool busy;
  const PosMobileCart({
    super.key,
    required this.onReview,
    this.actionLabel = 'Review order',
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosProvider>();
    final cart = pos.activeTab;
    final items = cart?.productItems ?? const [];
    final count = items.fold<num>(0, (sum, item) => sum + item.quantity);
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: HaHoColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              child: Row(
                children: [
                  const Icon(
                    Icons.shopping_bag_outlined,
                    size: 18,
                    color: Color(0xFF16776B),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      // A table's order says so before it is first saved.
                      cart?.isPersisted == true ||
                              (cart?.tabLabel ?? '').trim().isNotEmpty
                          ? cart!.displayLabel
                          : 'Current order',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    '$count item${count == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: HaHoColors.textGray,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: items.isEmpty
                  ? const Center(
                      child: Text(
                        'Scan a barcode or tap a product',
                        style: TextStyle(
                          fontSize: 13,
                          color: HaHoColors.textGray,
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: items.length,
                      separatorBuilder: (_, _) =>
                          const Divider(height: 1, color: HaHoColors.border),
                      itemBuilder: (_, index) {
                        final item = items[index];
                        final editable = item.isUnfired && cart?.isPaid != true;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      item.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    Text(
                                      // The guest's choices (Oat milk) and any note, then the state.
                                      [
                                        ...item.seatAndCourse,
                                        ...item.options
                                            .where((o) => o['name'] != 'prepStation')
                                            .map((o) => o['value'] ?? '')
                                            .where((v) => v.isNotEmpty),
                                        if ((item.specialInstructions ?? '').trim().isNotEmpty)
                                          item.specialInstructions!.trim(),
                                        item.isFired
                                            ? 'Sent to prep'
                                            : '\$${item.unitPrice.toStringAsFixed(2)} each',
                                      ].join(' · '),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: HaHoColors.textGray,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                tooltip: 'Decrease ${item.name}',
                                onPressed: editable
                                    ? () => pos.adjustQty(index, -1)
                                    : null,
                                icon: const Icon(Icons.remove, size: 18),
                                constraints: const BoxConstraints(
                                  minWidth: 40,
                                  minHeight: 44,
                                ),
                                padding: const EdgeInsets.all(8),
                              ),
                              Text(
                                '${item.quantity}',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              IconButton(
                                tooltip: 'Increase ${item.name}',
                                onPressed: editable
                                    ? () => pos.adjustQty(index, 1)
                                    : null,
                                icon: const Icon(Icons.add, size: 18),
                                constraints: const BoxConstraints(
                                  minWidth: 40,
                                  minHeight: 44,
                                ),
                                padding: const EdgeInsets.all(8),
                              ),
                              SizedBox(
                                width: 64,
                                child: Text(
                                  '\$${item.amount.toStringAsFixed(2)}',
                                  textAlign: TextAlign.end,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: HaHoColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Subtotal',
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 11,
                            color: HaHoColors.textGray,
                          ),
                        ),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            '\$${(cart?.subtotal ?? 0).toStringAsFixed(2)}',
                            maxLines: 1,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: items.isEmpty || busy ? null : onReview,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16776B),
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 44),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.arrow_forward, size: 18),
                    label: Text(busy ? 'Saving…' : actionLabel),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
