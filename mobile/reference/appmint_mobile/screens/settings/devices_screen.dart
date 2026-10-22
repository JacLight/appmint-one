import 'package:flutter/material.dart';

import '../../config/haho_theme.dart';
import '../../services/printer_service.dart';
import '../../services/scanner_service.dart';
import '../../services/stripe_terminal_service.dart';
import '../../services/nfc_service.dart';
import 'business_location_settings_screen.dart';
import 'printer_settings_screen.dart';
import '../../services/thermal/classic_printer.dart';
import 'scanner_settings_screen.dart';
import 'nfc_reader_pairing_screen.dart';

/// Single place to see every peripheral the operator has paired with this
/// device — card reader (Tap to Pay or M2), thermal printer, barcode
/// scanner. Each card shows live connection status and links to its
/// dedicated configuration screen.
///
/// Replaces the scattered "More → Printer / Payments" entries with a
/// proper Devices index. The dashboard's "Devices" tile points here.
class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  @override
  void initState() {
    super.initState();
    printerService.connectionRevision.addListener(_connectionChanged);
    stripeTerminalService.connectionRevision.addListener(_connectionChanged);
    printerService.verifyConnected();
  }

  void _connectionChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    printerService.connectionRevision.removeListener(_connectionChanged);
    stripeTerminalService.connectionRevision.removeListener(_connectionChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        title: const Text('Devices'),
        backgroundColor: HaHoColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh status',
            onPressed: () async {
              await printerService.verifyConnected();
              if (mounted) setState(() {});
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(HaHoSpacing.lg),
        children: [
          Text(
            'Set up this device’s printer and card reader before service. '
            'Check their connection status here.',
            style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
          ),
          const SizedBox(height: HaHoSpacing.lg),

          // ─── External card reader (M2 / BBPOS / WisePad) ───
          // Tap to Pay is intentionally NOT in this list — it's built
          // into the device's NFC, not a paired peripheral. The operator
          // just picks "Tap to Pay" at Checkout and the SDK initializes
          // transparently on first use. Only external readers need a
          // pair-and-leave-paired flow.
          _DeviceCard(
            icon: Icons.credit_card_outlined,
            title: 'Business location card terminal',
            status: _m2Status(),
            statusColor: _isM2() ? HaHoColors.success : HaHoColors.textGray,
            subtitle: _isM2()
                ? null
                : 'Optional — pair a Stripe M2, BBPOS WisePOS, or WisePad '
                      'reader. Skip this if you\'re using Tap to Pay on the '
                      'device itself; that works without setup.',
            onConfigure: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const BusinessLocationSettingsScreen(),
                ),
              );
              if (mounted) setState(() {});
            },
            configureLabel: _isM2() ? 'Manage' : 'Set up',
          ),
          const SizedBox(height: HaHoSpacing.sm),
          // Plain hint card explaining Tap to Pay needs nothing — head
          // off the "where do I configure it?" question.
          Container(
            padding: const EdgeInsets.all(HaHoSpacing.sm),
            decoration: BoxDecoration(
              color: HaHoColors.cardLight,
              borderRadius: BorderRadius.circular(HaHoRadius.md),
              border: Border.all(color: HaHoColors.border),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.contactless,
                  size: 18,
                  color: HaHoColors.textGray,
                ),
                const SizedBox(width: HaHoSpacing.sm),
                Expanded(
                  child: Text(
                    'Tap to Pay is built into this device — no setup. '
                    'Pick it at Checkout and the customer taps their card on this device.',
                    style: HaHoTextStyles.caption.copyWith(
                      color: HaHoColors.textGray,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: HaHoSpacing.md),

          // ─── Receipt printer ───
          _DeviceCard(
            icon: Icons.print_outlined,
            title: 'Receipt printer',
            status: _printerStatus(),
            statusColor: printerService.isConnected
                ? HaHoColors.success
                : HaHoColors.textGray,
            subtitle: printerService.isConnected
                ? null
                : 'ESC/POS receipt printer with 58mm or 80mm paper. '
                      '${ClassicPrinter.supported ? 'This device supports Bluetooth Classic (PIN), BLE and USB.' : 'Use a Bluetooth Low Energy (BLE) printer on this device.'}',
            onConfigure: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const PrinterSettingsScreen(),
                ),
              );
              if (mounted) setState(() {});
            },
            configureLabel: printerService.isConnected ? 'Manage' : 'Set up',
          ),
          const SizedBox(height: HaHoSpacing.md),

          // ─── Barcode scanner ───
          ValueListenableBuilder<int>(
            valueListenable: scannerService.revision,
            builder: (context, _, __) {
              final bleConn = scannerService.isBleConnected;
              final bleName = scannerService.connectedBleName;
              final camOn = scannerService.cameraScanEnabled;
              final hidOn = scannerService.hidCaptureEnabled;
              final lastHidScan = scannerService.lastHidScanAt;
              // Green has to mean "a scanner is connected". It used to mean
              // "the camera toggle is on", which is on by default — so this
              // card sat green with no scanner paired at all and read as if
              // hardware were connected.
              final status = bleConn
                  ? 'Connected: ${bleName ?? 'BLE scanner'}'
                  : scannerService.isHidConnected
                  ? 'Connected: ${scannerService.connectedHidName} · keyboard mode'
                  : hidOn && lastHidScan != null
                  ? 'Keyboard scan received at ${TimeOfDay.fromDateTime(lastHidScan).format(context)}'
                  : camOn
                  ? (hidOn
                        ? 'Keyboard scanner input ready · camera on'
                        : 'Camera scanning ready')
                  : (hidOn ? 'Keyboard scanner input ready' : 'Scanning off');
              return _DeviceCard(
                icon: Icons.qr_code_scanner,
                title: 'Barcode scanner',
                status: status,
                statusColor: bleConn || scannerService.isHidConnected
                    ? HaHoColors.success
                    : HaHoColors.textGray,
                subtitle: hidOn && lastHidScan != null && !bleConn
                    ? 'Keyboard input verified. Phone settings manage its connection; scan again to check it now.'
                    : 'Connect a scanner in BLE data mode here, or pair a keyboard-mode scanner in phone settings. Camera scanning is also available.',
                // Always open settings — never force a "connect" flow.
                onConfigure: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ScannerSettingsScreen(),
                    ),
                  );
                  if (mounted) setState(() {});
                },
                configureLabel:
                    bleConn ||
                        scannerService.isHidConnected ||
                        lastHidScan != null
                    ? 'Manage'
                    : 'Set up',
              );
            },
          ),
          const SizedBox(height: HaHoSpacing.md),

          // ─── NFC card reader (for tap quick-login) ───
          ValueListenableBuilder<int>(
            valueListenable: nfcService.revision,
            builder: (context, _, __) {
              final onDevice = nfcService.deviceNfcAvailable;
              final ble = nfcService.isBleConnected;
              return _DeviceCard(
                icon: Icons.nfc,
                title: 'NFC card reader',
                status: ble
                    ? 'Connected: ${nfcService.connectedBleName ?? 'BLE reader'}'
                    : onDevice
                    ? 'No reader paired · built-in NFC available'
                    : 'No NFC — pair a Bluetooth reader',
                // Only a reader that is actually connected is green. Having
                // built-in NFC hardware is a capability, not a connection.
                statusColor: ble ? HaHoColors.success : HaHoColors.textGray,
                subtitle:
                    'Used for tap card sign-in. Devices without built-in NFC '
                    '(e.g. iPad) need a Bluetooth NFC reader in BLE/serial '
                    'mode.',
                onConfigure: () async {
                  nfcService.ensureInitialized();
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NfcReaderPairingScreen(),
                    ),
                  );
                  if (mounted) setState(() {});
                },
                configureLabel: ble ? 'Manage' : 'Set up',
              );
            },
          ),
          const SizedBox(height: HaHoSpacing.md),

          // ─── Cash drawer (rides on the printer) ───
          _DeviceCard(
            icon: Icons.point_of_sale,
            title: 'Cash drawer',
            status: printerService.isConnected
                ? 'Wired to printer — kicks on cash settle'
                : 'Pair the printer first',
            statusColor: printerService.isConnected
                ? HaHoColors.success
                : HaHoColors.textGray,
            subtitle: printerService.isConnected
                ? null
                : 'Most cash drawers plug into the printer via RJ12 and open '
                      'on the printer\'s ESC/POS pulse command.',
            onConfigure: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const PrinterSettingsScreen(),
                ),
              );
              if (mounted) setState(() {});
            },
            configureLabel: printerService.isConnected ? 'Manage' : 'Set up',
          ),
        ],
      ),
    );
  }

  /// True only when an EXTERNAL Bluetooth reader is paired. Tap to Pay
  /// (which uses the device's own NFC) doesn't count for this card.
  /// isConnected now agrees with the SDK's own status, so this no longer
  /// reports a reader that has powered off or gone out of range.
  bool _isM2() =>
      stripeTerminalService.isConnected &&
      stripeTerminalService.connectionKind == 'bluetooth';

  String _m2Status() {
    if (!_isM2()) return 'Not connected';
    final r = stripeTerminalService.connectedReader;
    if (r != null) return 'Connected: ${r.label ?? r.serialNumber}';
    return 'Paired';
  }

  String _printerStatus() {
    if (!printerService.isConnected) return 'Not connected';
    final p = printerService.connected;
    final name = p?.name ?? p?.address ?? 'paired';
    final paper = printerService.paperMm == 58 ? '58mm' : '80mm';
    return 'Connected: $name · $paper paper';
  }
}

/// One card per device. Always shows status; tap to open its config.
class _DeviceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String status;
  final Color statusColor;
  final String? subtitle;
  final VoidCallback onConfigure;
  final String configureLabel;

  const _DeviceCard({
    required this.icon,
    required this.title,
    required this.status,
    required this.statusColor,
    this.subtitle,
    required this.onConfigure,
    this.configureLabel = 'Set up',
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(HaHoRadius.lg),
      child: InkWell(
        onTap: onConfigure,
        borderRadius: BorderRadius.circular(HaHoRadius.lg),
        child: Container(
          padding: const EdgeInsets.all(HaHoSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(HaHoRadius.lg),
            border: Border.all(color: HaHoColors.border),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(HaHoRadius.md),
                ),
                child: Icon(icon, color: statusColor, size: 22),
              ),
              const SizedBox(width: HaHoSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: HaHoTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            status,
                            style: HaHoTextStyles.caption.copyWith(
                              color: statusColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle!,
                        style: HaHoTextStyles.caption.copyWith(
                          color: HaHoColors.textGray,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: HaHoSpacing.sm),
              TextButton(onPressed: onConfigure, child: Text(configureLabel)),
            ],
          ),
        ),
      ),
    );
  }
}
