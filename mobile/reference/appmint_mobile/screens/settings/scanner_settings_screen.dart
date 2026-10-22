import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

import '../../config/haho_theme.dart';
import '../../services/scanner_service.dart';
import '../../utils/bluetooth_permissions.dart';

/// ONE screen for everything about the barcode scanner: the camera switch,
/// the app-wide hardware-scanner switch, the connected device, and the live
/// list of nearby Bluetooth scanners to tap-connect. No popups, no nested
/// flows — every option is visible here at once.
class ScannerSettingsScreen extends StatefulWidget {
  const ScannerSettingsScreen({super.key});

  @override
  State<ScannerSettingsScreen> createState() => _ScannerSettingsScreenState();
}

class _ScannerSettingsScreenState extends State<ScannerSettingsScreen> {
  BluetoothDevice? _connecting;

  /// Scanners the phone is already bonded to. A bonded device stops
  /// advertising, so the BLE scan can never list it — and a Classic (BR/EDR)
  /// scanner is not a BLE device at all and will never appear there either.
  List<BluetoothDevice> _known = const [];

  Future<void> _loadKnown() async {
    try {
      final k = await scannerService.knownDevices();
      if (mounted) setState(() => _known = k);
    } catch (_) {
      /* non-fatal */
    }
  }

  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await scannerService.ensureInitialized();
    unawaited(_loadKnown());
    final on = await scannerService.ensureBluetoothOn();
    if (!on) {
      if (mounted) {
        setState(
          () => _error =
              'Bluetooth is off — turn it on to see nearby scanners. The '
              'camera scanner still works without Bluetooth.',
        );
      }
      return;
    }
    await scannerService.startBleScan();
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    scannerService.stopBleScan();
    super.dispose();
  }

  Future<void> _connect(BluetoothDevice d) async {
    setState(() {
      _connecting = d;
      _error = null;
    });
    try {
      await scannerService.connectBleScanner(d);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Scanner connected'),
          backgroundColor: HaHoColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      setState(() => _connecting = null);
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
      appBar: AppBar(
        title: const Text('Barcode Scanner'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              await scannerService.startBleScan();
              if (mounted) setState(() {});
            },
          ),
        ],
      ),
      body: ValueListenableBuilder<int>(
        valueListenable: scannerService.revision,
        builder: (context, _, __) {
          final bleConn = scannerService.isBleConnected;
          return ListView(
            padding: const EdgeInsets.all(HaHoSpacing.lg),
            children: [
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
                  padding: const EdgeInsets.all(HaHoSpacing.md),
                  decoration: BoxDecoration(
                    color: HaHoColors.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(HaHoRadius.md),
                  ),
                  child: Text(
                    _error!,
                    style: HaHoTextStyles.bodySmall.copyWith(
                      color: HaHoColors.error,
                    ),
                  ),
                ),

              // ── Options (always visible, no popup) ──
              Material(
                color: HaHoColors.cardLight,
                borderRadius: BorderRadius.circular(HaHoRadius.lg),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    SwitchListTile(
                      title: const Text('Camera scanner'),
                      subtitle: const Text(
                        'On by default — works from any scan button with '
                        'no setup. Turn off only to stop camera scanning.',
                      ),
                      value: scannerService.cameraScanEnabled,
                      onChanged: (v) async {
                        await scannerService.setCameraScanEnabled(v);
                        if (mounted) setState(() {});
                      },
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('App-wide hardware scanner'),
                      subtitle: const Text(
                        'Receive keyboard-mode scans in POS and ticket '
                        'scanning without selecting a text field.',
                      ),
                      value: scannerService.hidCaptureEnabled,
                      onChanged: (v) async {
                        await scannerService.setHidCaptureEnabled(v);
                        if (mounted) setState(() {});
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: HaHoSpacing.lg),

              Material(
                color: HaHoColors.cardLight,
                borderRadius: BorderRadius.circular(HaHoRadius.lg),
                child: ListTile(
                  leading: Icon(
                    Icons.keyboard,
                    color: scannerService.lastHidScanAt != null
                        ? HaHoColors.success
                        : HaHoColors.textGray,
                  ),
                  title: Text(
                    scannerService.isHidConnected
                        ? scannerService.connectedHidName ?? 'Keyboard scanner'
                        : 'Keyboard scanner',
                  ),
                  subtitle: Text(
                    !scannerService.hidCaptureEnabled
                        ? 'Hardware input is off. Enable it above to receive scans.'
                        : scannerService.lastHidScanAt != null
                        ? 'Scan received at ${TimeOfDay.fromDateTime(scannerService.lastHidScanAt!).format(context)}. Open POS or ticket scanning to use it.'
                        : 'Waiting for a test scan. If paired in phone settings, scan a barcode now to verify input.',
                  ),
                ),
              ),
              const SizedBox(height: HaHoSpacing.lg),

              // ── Connected device ──
              if (bleConn) ...[
                Container(
                  decoration: BoxDecoration(
                    color: HaHoColors.cardLight,
                    borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  ),
                  child: ListTile(
                    leading: const Icon(
                      Icons.bluetooth_connected,
                      color: HaHoColors.success,
                    ),
                    title: Text(
                      scannerService.connectedBleName ?? 'BLE scanner',
                    ),
                    subtitle: const Text('Connected'),
                    trailing: TextButton(
                      onPressed: () async {
                        await scannerService.disconnectBle();
                        if (mounted) setState(() {});
                      },
                      child: const Text(
                        'Disconnect',
                        style: TextStyle(color: HaHoColors.error),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: HaHoSpacing.lg),
              ],

              // ── Nearby Bluetooth scanners (live, tap to connect) ──
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Nearby BLE devices',
                      style: HaHoTextStyles.caption.copyWith(
                        fontWeight: FontWeight.w600,
                        color: HaHoColors.textGray,
                      ),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      await scannerService.startBleScan();
                      await _loadKnown();
                      if (mounted) setState(() {});
                    },
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Rescan'),
                  ),
                ],
              ),
              const SizedBox(height: HaHoSpacing.sm),
              Text(
                'For direct pairing in Appmint, use your scanner’s BLE data '
                'mode. Keyboard-mode scanners pair in phone Bluetooth settings '
                'and are verified by a test scan above. Nearby devices may '
                'include accessories other than scanners.',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
              const SizedBox(height: HaHoSpacing.md),
              if (_known.isNotEmpty) ...[
                Text(
                  'Already paired on this phone',
                  style: HaHoTextStyles.caption.copyWith(
                    fontWeight: FontWeight.w600,
                    color: HaHoColors.textGray,
                  ),
                ),
                Text(
                  'A scanner already typing into the app is working as it '
                  'should — connecting to it here can drop that connection.',
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
                const SizedBox(height: HaHoSpacing.xs),
                for (final d in _known)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(
                      Icons.bluetooth_connected,
                      color: HaHoColors.primary,
                    ),
                    title: Text(
                      d.platformName.trim().isEmpty
                          ? d.remoteId.str
                          : d.platformName.trim(),
                    ),
                    subtitle: Text(
                      d.remoteId.str,
                      style: HaHoTextStyles.caption.copyWith(
                        color: HaHoColors.textGray,
                      ),
                    ),
                    trailing: TextButton(
                      onPressed: () => _connect(d),
                      child: const Text('Use this'),
                    ),
                  ),
                const SizedBox(height: HaHoSpacing.md),
              ],
              StreamBuilder<List<ScanResult>>(
                stream: scannerService.bleScanResults,
                builder: (context, snap) {
                  final results = (snap.data ?? [])
                      .where(
                        (r) =>
                            r.device.platformName.trim().isNotEmpty ||
                            r.advertisementData.advName.trim().isNotEmpty,
                      )
                      .toList();
                  if (results.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: HaHoSpacing.xl,
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: HaHoSpacing.md),
                              Text('Scanning…'),
                            ],
                          ),
                          const SizedBox(height: HaHoSpacing.md),
                          OutlinedButton.icon(
                            onPressed: () async {
                              await scannerService.startBleScan();
                              if (mounted) setState(() {});
                            },
                            icon: const Icon(Icons.refresh),
                            label: const Text('Rescan'),
                          ),
                        ],
                      ),
                    );
                  }
                  return Column(
                    children: results.map((r) {
                      final name = r.device.platformName.isNotEmpty
                          ? r.device.platformName
                          : r.advertisementData.advName;
                      final busy = _connecting?.remoteId == r.device.remoteId;
                      return Container(
                        margin: const EdgeInsets.only(bottom: HaHoSpacing.sm),
                        decoration: BoxDecoration(
                          color: HaHoColors.cardLight,
                          borderRadius: BorderRadius.circular(HaHoRadius.lg),
                        ),
                        child: ListTile(
                          leading: const Icon(
                            Icons.qr_code_scanner,
                            color: HaHoColors.accent,
                          ),
                          title: Text(name),
                          subtitle: Text(
                            r.device.remoteId.str,
                            style: HaHoTextStyles.caption,
                          ),
                          trailing: busy
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.chevron_right),
                          onTap: _connecting != null
                              ? null
                              : () => _connect(r.device),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),

              if (scannerService.lastScan != null) ...[
                const SizedBox(height: HaHoSpacing.lg),
                Text(
                  'Last scan: ${scannerService.lastScan?.code ?? ''}',
                  style: HaHoTextStyles.caption.copyWith(
                    color: HaHoColors.textGray,
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
