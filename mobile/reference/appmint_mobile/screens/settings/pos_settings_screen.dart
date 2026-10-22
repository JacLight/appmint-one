import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/pos_device_settings.dart';

class PosSettingsScreen extends StatelessWidget {
  const PosSettingsScreen({super.key});

  Future<void> _rename(BuildContext context, String method) async {
    final settings = context.read<PosDeviceSettings>();
    final controller = TextEditingController(
      text: settings.displayName(method),
    );
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Name ${PosDeviceSettings.paymentMethods[method]}'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          decoration: const InputDecoration(
            labelText: 'Checkout display name',
            helperText: 'Leave empty to use the default name.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: const Text('Save name'),
          ),
        ],
      ),
    );
    // Let the dialog finish its dismissal before disposing its controller.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    controller.dispose();
    if (name == null || !context.mounted) return;
    await _change(context, () async {
      await settings.setDisplayName(method, name);
      return true;
    });
  }

  Future<void> _change(
    BuildContext context,
    Future<bool> Function() save,
  ) async {
    try {
      if (!await save() && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Keep at least one payment method enabled.'),
          ),
        );
      }
    } catch (e) {
      if (context.mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not save settings: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<PosDeviceSettings>();
    return Scaffold(
      appBar: AppBar(title: const Text('POS settings')),
      body: !settings.loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'On this device',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Choose the POS actions and payment methods available here.',
                ),
                const SizedBox(height: 16),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Show Send to prep'),
                  subtitle: Text(
                    settings.showPrep
                        ? 'Select items and send them to their prep stations.'
                        : 'Direct checkout. Prep controls are hidden.',
                  ),
                  value: settings.showPrep,
                  onChanged: (value) => _change(context, () async {
                    await settings.setShowPrep(value);
                    return true;
                  }),
                ),
                const Divider(height: 32),
                const Text(
                  'Payment methods',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Only enabled methods appear at checkout. Card methods still require their payment provider and reader setup.',
                ),
                for (final method in PosDeviceSettings.paymentMethods.entries)
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    title: Text(method.value),
                    subtitle: Text(
                      'Checkout: ${settings.displayName(method.key)}',
                    ),
                    secondary: IconButton(
                      tooltip: 'Rename ${method.value}',
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      onPressed: () => _rename(context, method.key),
                    ),
                    value: settings.allows(method.key),
                    onChanged: (value) => _change(
                      context,
                      () => settings.setPaymentMethod(method.key, value),
                    ),
                  ),
              ],
            ),
    );
  }
}
