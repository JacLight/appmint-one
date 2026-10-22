import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import '../../config/haho_theme.dart';
import '../../services/nfc_service.dart';
import '../../utils/bluetooth_permissions.dart';

/// In-app pairing for a Bluetooth NFC reader — same scan-and-connect pattern
/// as the BLE barcode scanner. Used on devices with no built-in NFC (e.g.
/// iPad) so card taps still flow into the app. The reader must be in
/// BLE/serial mode (not HID).
class NfcReaderPairingScreen extends StatefulWidget {
  const NfcReaderPairingScreen({super.key});

  @override
  State<NfcReaderPairingScreen> createState() =>
      _NfcReaderPairingScreenState();
}

class _NfcReaderPairingScreenState extends State<NfcReaderPairingScreen> {
  BluetoothDevice? _connecting;
  String? _error;

  @override
  void initState() {
    super.initState();
    _start();
  }

  /// Readers already bonded/connected at OS level. They never advertise, so
  /// the scan alone cannot find them.
  List<BluetoothDevice> _known = const [];

  Future<void> _loadKnown() async {
    try {
      final k = await nfcService.knownDevices();
      if (mounted) setState(() => _known = k);
    } catch (_) {/* non-fatal */}
  }

  Future<void> _start() async {
    // Android 12+ will not scan without these, and fails silently.
    final permissionProblem = await ensureBluetoothPermissions();
    if (!mounted) return;
    if (permissionProblem != null) {
      setState(() => _error = permissionProblem);
      return;
    }
    final on = await nfcService.ensureBluetoothOn();
    if (!on) {
      setState(() => _error =
          'Bluetooth is off. Turn it on in Control Center, then retry.');
      return;
    }
    await nfcService.startBleScan();
    await _loadKnown();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    nfcService.stopBleScan();
    super.dispose();
  }

  Future<void> _connect(BluetoothDevice d) async {
    setState(() {
      _connecting = d;
      _error = null;
    });
    try {
      await nfcService.connectBleReader(d);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('NFC reader connected'),
        backgroundColor: HaHoColors.success,
        behavior: SnackBarBehavior.floating,
      ));
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _connecting = null;
        _error = describeBleConnectError(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(title: const Text('Pair NFC Reader'), actions: [
        IconButton(
            onPressed: () async {
              await nfcService.startBleScan();
              if (mounted) setState(() {});
            },
            icon: const Icon(Icons.refresh)),
      ]),
      body: Column(
        children: [
          if (_error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(HaHoSpacing.lg),
              color: HaHoColors.error.withOpacity(0.1),
              child: Text(_error!,
                  style: HaHoTextStyles.bodySmall
                      .copyWith(color: HaHoColors.error)),
            ),
          Padding(
            padding: const EdgeInsets.all(HaHoSpacing.lg),
            child: Text(
              'Power on your Bluetooth NFC reader (BLE/serial mode) and tap '
              'it below to connect.',
              style: HaHoTextStyles.bodySmall
                  .copyWith(color: HaHoColors.textGray),
            ),
          ),
          if (_known.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Already paired on this phone',
                    style: HaHoTextStyles.bodySmall.copyWith(
                        color: HaHoColors.textGray, fontWeight: FontWeight.w600)),
              ),
            ),
            for (final d in _known)
              ListTile(
                leading: const Icon(Icons.bluetooth_connected, color: HaHoColors.primary),
                title: Text(d.platformName.trim().isEmpty
                    ? d.remoteId.str
                    : d.platformName.trim()),
                subtitle: Text(d.remoteId.str,
                    style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray)),
                trailing: TextButton(
                  onPressed: () => _connect(d),
                  child: const Text('Use this'),
                ),
              ),
            const Divider(height: 1, color: HaHoColors.border),
          ],
          Expanded(
            child: StreamBuilder<List<ScanResult>>(
              stream: nfcService.bleScanResults,
              builder: (context, snap) {
                final results = (snap.data ?? [])
                    .where((r) =>
                        r.device.platformName.isNotEmpty ||
                        r.advertisementData.advName.isNotEmpty)
                    .toList();
                if (results.isEmpty) {
                  return const Center(
                      child: Padding(
                    padding: EdgeInsets.all(HaHoSpacing.xl),
                    child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: HaHoSpacing.lg),
                          Text('Scanning for NFC readers…'),
                        ]),
                  ));
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(HaHoSpacing.lg),
                  itemCount: results.length,
                  separatorBuilder: (_, __) =>
                      const SizedBox(height: HaHoSpacing.sm),
                  itemBuilder: (context, i) {
                    final r = results[i];
                    final name = r.device.platformName.isNotEmpty
                        ? r.device.platformName
                        : r.advertisementData.advName;
                    final busy = _connecting?.remoteId == r.device.remoteId;
                    return Container(
                      decoration: BoxDecoration(
                        color: HaHoColors.cardLight,
                        borderRadius: BorderRadius.circular(HaHoRadius.lg),
                      ),
                      child: ListTile(
                        leading: const Icon(Icons.nfc,
                            color: HaHoColors.accent),
                        title: Text(name, style: HaHoTextStyles.body),
                        subtitle: Text(r.device.remoteId.str,
                            style: HaHoTextStyles.caption),
                        trailing: busy
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2))
                            : const Icon(Icons.chevron_right),
                        onTap: _connecting != null
                            ? null
                            : () => _connect(r.device),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
