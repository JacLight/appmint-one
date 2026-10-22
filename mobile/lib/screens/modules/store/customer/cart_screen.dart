import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/stowbo_theme.dart';
import '../../../../providers/store_provider.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';

/// The bag, and what it comes to.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>();
    final lines = store.cartLines;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SSpace.xl),
          children: [
            Text('Cart', style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: SSpace.xl),
            if (lines.isEmpty)
              const ModuleEmpty(
                icon: Icons.shopping_bag_outlined,
                title: 'Your cart is empty',
                body: 'Add something from Browse and it shows up here.',
              )
            else
              ...lines.map((l) => _Line(line: l)),
          ],
        ),
      ),
      bottomNavigationBar: lines.isEmpty
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(SSpace.xl),
              child: FilledButton(
                onPressed: null, // checkout lands with payment
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52)),
                child: Text('Checkout · ${store.cartCount} item'
                    '${store.cartCount == 1 ? '' : 's'}'),
              ),
            ),
    );
  }
}

class _Line extends StatelessWidget {
  final Map<String, dynamic> line;
  const _Line({required this.line});

  @override
  Widget build(BuildContext context) {
    final name = '${line['name'] ?? line['title'] ?? 'Item'}';
    final qty = line['quantity'] ?? line['qty'] ?? 1;
    final price = line['price'] ?? line['amount'];

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.md),
      child: Row(
        children: [
          ThumbArt(name: name, width: 60, height: 60, radius: SRadius.md),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: SColors.ink)),
                Text('Qty $qty',
                    style: const TextStyle(
                        color: SColors.muted, fontSize: 12.5)),
              ],
            ),
          ),
          if (price != null)
            Text('$price',
                style: const TextStyle(
                    fontWeight: FontWeight.w700, color: SColors.ink)),
        ],
      ),
    );
  }
}
