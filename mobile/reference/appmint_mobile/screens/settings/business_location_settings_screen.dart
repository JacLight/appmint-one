import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../services/stripe_terminal_service.dart';
import '../../utils/business_location_access.dart';
import 'business_location_screen.dart';
import 'payments_screen.dart';

/// Location settings own the business address and the terminal registration.
/// The API independently enforces content.update on saved location edits.
class BusinessLocationSettingsScreen extends StatelessWidget {
  const BusinessLocationSettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final locations = context.watch<LocationProvider>();
    final user = context.watch<AuthProvider>().rawUser;
    final canEdit = canManageBusinessLocation(user);
    final record = locations.selectedLocation;
    final details = record?['data'] as Map? ?? {};
    final address = details['address'] as Map? ?? {};
    final label =
        '${details['title'] ?? details['name'] ?? 'No location assigned'}';
    final addressText = [
      address['street1'],
      address['street2'],
      address['city'],
      address['state'] ?? address['region'],
      address['zip'],
      address['country'],
    ].where((v) => v != null && '$v'.trim().isNotEmpty).join(', ');
    return Scaffold(
      appBar: AppBar(title: const Text('Business location')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(label, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('This device’s assigned business location.'),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.place_outlined),
              title: const Text('Business details'),
              subtitle: Text(
                addressText.isEmpty
                    ? 'Add the saved business address'
                    : addressText,
              ),
              trailing: canEdit && record != null
                  ? const Icon(Icons.edit_outlined)
                  : const Icon(Icons.lock_outline),
              onTap: !canEdit || record == null
                  ? null
                  : () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) => BusinessLocationScreen(
                          location: record,
                          canEdit: canEdit,
                        ),
                      ),
                    ),
            ),
          ),
          if (!canEdit)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Your role cannot change business location details. Ask a location administrator.',
              ),
            ),
          const SizedBox(height: 12),
          ValueListenableBuilder<int>(
            valueListenable: stripeTerminalService.connectionRevision,
            builder: (_, _, _) => Card(
              child: ListTile(
                leading: const Icon(Icons.credit_card_outlined),
                title: const Text('Card terminal (M2)'),
                subtitle: Text(
                  stripeTerminalService.isConnected &&
                          stripeTerminalService.connectionKind == 'bluetooth' &&
                          stripeTerminalService.isBoundToBusinessLocation(
                            locations.businessLocationName,
                          )
                      ? 'Connected for $label'
                      : 'Not connected · $label',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: record == null
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) => const PaymentsScreen(),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
