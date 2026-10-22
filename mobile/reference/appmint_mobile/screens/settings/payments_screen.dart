import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import 'package:provider/provider.dart';

import '../../config/haho_theme.dart';
import '../../providers/location_provider.dart';
import '../../utils/bluetooth_permissions.dart';
import '../../utils/terminal_display.dart';

import 'business_location_settings_screen.dart';

import '../../services/stripe_terminal_service.dart';

/// Pair a reader using this device's existing business location.
/// Business setup is managed in the location settings, never duplicated here.
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

// Back-compat alias for older imports.
class CardReaderSettingsScreen extends PaymentsScreen {
  const CardReaderSettingsScreen({super.key});
}

/// What to call a reader on screen.
///
/// Prefer the label someone gave it in Stripe, then the model — "Stripe
/// Reader M2" reads as a device, where the bare serial number that used to be
/// shown here reads as a code and tells the operator nothing about which box
/// on the counter they are about to pair. The serial stays as the subtitle,
/// which is where a code belongs.
String readerName(Reader? r) {
  if (r == null) return 'Card reader';
  final label = r.label?.trim();
  if (label != null && label.isNotEmpty) return label;
  switch (r.deviceType) {
    case DeviceType.stripeM2:
      return 'Stripe Reader M2';
    case DeviceType.chipper2X:
      return 'BBPOS Chipper 2X BT';
    case DeviceType.wisePad3:
      return 'BBPOS WisePad 3';
    case DeviceType.wisePosE:
      return 'BBPOS WisePOS E';
    case DeviceType.tapToPay:
      return 'Tap to Pay';
    default:
      final t = r.deviceType?.name;
      return (t == null || t.isEmpty) ? 'Card reader' : t;
  }
}

enum _Step { setupRequired, registering, prepare, scan, pairing, done }

class _PaymentsScreenState extends State<PaymentsScreen> {
  final _svc = stripeTerminalService;

  // SDK init state.
  bool _initializing = true;
  String? _initError;

  _Step _step = _Step.registering;
  List<Reader> _discovered = const [];
  StreamSubscription<List<Reader>>? _discoverySub;
  Reader? _pairing;
  String? _error;
  bool _locationNeedsAttention = true;
  bool get _hasExternalReaderPaired =>
      _svc.isConnected &&
      _svc.connectionKind == 'bluetooth' &&
      _svc.isBoundToBusinessLocation(
        context.read<LocationProvider>().businessLocationName,
      );

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void dispose() {
    _discoverySub?.cancel();
    super.dispose();
  }

  Future<void> _initialize() async {
    setState(() {
      _initializing = true;
      _initError = null;
    });
    try {
      await _svc.ensureInitialized();
      if (!mounted) return;
      if (_hasExternalReaderPaired) {
        setState(() {
          _initializing = false;
          _step = _Step.done;
        });
        return;
      }
      setState(() => _initializing = false);
      // Resolve immediately so we land on the right starting step.
      await _resolveAndRoute();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initError = terminalErrorMessage(e);
        _initializing = false;
      });
    }
  }

  Future<void> _resolveAndRoute() async {
    setState(() {
      _step = _Step.registering;
      _error = null;
    });
    final loc = context.read<LocationProvider>();
    try {
      // Re-read the saved record on retry, including edits made in location settings.
      await loc.load();
      if (!mounted) return;
      if (loc.selectedId.isEmpty || loc.selectedLocation == null) {
        setState(() {
          _step = _Step.setupRequired;
          _locationNeedsAttention = true;
          _error =
              'Set this device’s business location in settings, then retry.';
        });
        return;
      }
      await _svc.ensureLocationForBusinessLocation(loc.businessLocationName);
      if (!mounted) return;
      setState(() => _step = _Step.prepare);
    } catch (e) {
      if (!mounted) return;
      final message = terminalErrorMessage(e);
      final missingAddress =
          message.toLowerCase().contains('address') ||
          message.toLowerCase().contains('location is missing');
      final invalidState = message.toLowerCase().contains('state or province');
      setState(() {
        _step = _Step.setupRequired;
        _locationNeedsAttention = missingAddress || invalidState;
        _error = missingAddress
            ? 'The saved business location has an incomplete address. '
                  'Complete its saved details here to continue connecting the reader.'
            : message;
      });
    }
  }

  Future<void> _openBusinessLocation() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const BusinessLocationSettingsScreen()),
    );
    if (mounted) await _resolveAndRoute();
  }

  // ─── Step transitions ─────────────────────────────────────────────────

  Future<void> _onPrepareContinue() async {
    // Android 12+ will not scan without these, and refuses silently: an empty
    // list, no error, and a reader that never shows up. Ask first and say so
    // plainly if the answer is no.
    final permissionProblem = await ensureTerminalPermissions();
    if (!mounted) return;
    if (permissionProblem != null) {
      setState(() {
        _error = permissionProblem;
        _step = _Step.prepare;
      });
      return;
    }
    setState(() {
      _step = _Step.scan;
      _discovered = const [];
      _error = null;
    });
    _discoverySub?.cancel();
    _discoverySub = _svc.discoverBluetoothReaders().listen(
      (readers) {
        if (mounted) setState(() => _discovered = readers);
      },
      onError: (e) {
        if (mounted) {
          setState(() {
            _error = terminalErrorMessage(e);
            _step = _Step.prepare;
          });
        }
      },
    );
  }

  Future<void> _onPickReader(Reader r) async {
    await _discoverySub?.cancel();
    _discoverySub = null;
    setState(() {
      _pairing = r;
      _step = _Step.pairing;
      _error = null;
    });
    try {
      await _svc.connectBluetooth(r);
      if (!mounted) return;
      setState(() => _step = _Step.done);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = terminalErrorMessage(e);
        _step = _Step.scan;
        _pairing = null;
      });
    }
  }

  Future<void> _unpair() async {
    await _svc.disconnect(forget: true);
    if (!mounted) return;
    setState(() {
      _step = _Step.prepare;
      _discovered = const [];
      _pairing = null;
    });
  }

  Future<void> _restart() async {
    setState(() {
      _step = _Step.prepare;
      _discovered = const [];
      _pairing = null;
      _error = null;
    });
  }

  // ─── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HaHoColors.background,
      appBar: AppBar(
        title: Consumer<LocationProvider>(
          builder: (_, location, _) {
            final data = location.selectedLocation?['data'];
            final label = data is Map ? data['title'] ?? data['name'] : null;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Card reader'),
                if (label != null)
                  Text(
                    '$label',
                    style: const TextStyle(
                      fontSize: 12,
                      color: HaHoColors.textGray,
                    ),
                  ),
              ],
            );
          },
        ),
        backgroundColor: HaHoColors.background,
        elevation: 0,
      ),
      body: _initializing
          ? const Center(child: CircularProgressIndicator())
          : _initError != null
          ? _ErrorState(message: _initError!, onRetry: _initialize)
          : SafeArea(
              child: Column(
                children: [
                  _StepHeader(current: _step),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(HaHoSpacing.lg),
                      child: _buildStep(),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case _Step.setupRequired:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _locationNeedsAttention
                  ? 'Configure business location'
                  : 'Payment setup needed',
              style: HaHoTextStyles.h3,
            ),
            const SizedBox(height: HaHoSpacing.sm),
            Text(
              _error ?? 'Check this device’s business location.',
              style: HaHoTextStyles.body.copyWith(color: HaHoColors.textGray),
            ),
            const SizedBox(height: HaHoSpacing.lg),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _openBusinessLocation,
                  icon: const Icon(Icons.settings_outlined, size: 18),
                  label: const Text('Open business location'),
                ),
                OutlinedButton.icon(
                  onPressed: _resolveAndRoute,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ],
        );
      case _Step.registering:
        return const _RegisteringStep();
      case _Step.prepare:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) ...[
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 16),
            ],
            _PrepareStep(enabled: true, onContinue: _onPrepareContinue),
          ],
        );
      case _Step.scan:
        return _ScanStep(
          readers: _discovered,
          error: _error,
          onPick: _onPickReader,
          onBack: () {
            _discoverySub?.cancel();
            setState(() => _step = _Step.prepare);
          },
          onRescan: _onPrepareContinue,
        );
      case _Step.pairing:
        return _PairingStep(reader: _pairing);
      case _Step.done:
        return _DoneStep(
          reader: _svc.connectedReader,
          onUnpair: _unpair,
          onReplace: _restart,
        );
    }
  }
}

// ─── Wizard step: spinner while we POST to Stripe ───────────────────────

class _RegisteringStep extends StatelessWidget {
  const _RegisteringStep();
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: const [
        SizedBox(height: HaHoSpacing.xxl),
        Center(child: CircularProgressIndicator()),
        SizedBox(height: HaHoSpacing.lg),
        Center(
          child: Text(
            'Checking saved business location…',
            style: TextStyle(fontSize: 14, color: HaHoColors.textGray),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}

// ─── Step header — visual progress ─────────────────────────────────────

class _StepHeader extends StatelessWidget {
  final _Step current;
  const _StepHeader({required this.current});

  static const _labels = ['Setup', 'Scan', 'Done'];

  static int _bucketFor(_Step step) => switch (step) {
    _Step.setupRequired || _Step.registering => 0,
    _Step.prepare || _Step.scan || _Step.pairing => 1,
    _Step.done => 2,
  };

  @override
  Widget build(BuildContext context) {
    final currentIndex = _bucketFor(current);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: HaHoSpacing.lg,
        vertical: HaHoSpacing.md,
      ),
      color: HaHoColors.background,
      child: Row(
        children: [
          for (var i = 0; i < _labels.length; i++) ...[
            _stepBubble(i, currentIndex, _labels[i]),
            if (i < _labels.length - 1)
              Expanded(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  color: i < currentIndex
                      ? HaHoColors.primary
                      : HaHoColors.border,
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _stepBubble(int idx, int curr, String label) {
    final done = idx < curr;
    final active = idx == curr;
    final bg = done
        ? HaHoColors.primary
        : active
        ? HaHoColors.primary
        : Colors.white;
    final fg = done || active ? Colors.white : HaHoColors.textGray;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: Border.all(
              color: done || active ? HaHoColors.primary : HaHoColors.border,
            ),
          ),
          child: done
              ? Icon(Icons.check, size: 14, color: fg)
              : Text(
                  '${idx + 1}',
                  style: TextStyle(
                    color: fg,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: active ? HaHoColors.textDark : HaHoColors.textGray,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ─── Step 1: Prepare ─────────────────────────────────────────────────────

class _PrepareStep extends StatelessWidget {
  final VoidCallback onContinue;
  final bool enabled;
  const _PrepareStep({required this.onContinue, this.enabled = true});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Put the reader in pairing mode', style: HaHoTextStyles.h3),
        const SizedBox(height: HaHoSpacing.lg),
        Container(
          padding: const EdgeInsets.all(HaHoSpacing.xl),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(HaHoRadius.lg),
            border: Border.all(color: HaHoColors.border),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.credit_card,
                size: 64,
                color: HaHoColors.primary,
              ),
              const SizedBox(height: HaHoSpacing.md),
              Text(
                'Hold the power button',
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Press and hold the M2\'s power button for ~4 seconds, until '
                'you see the LEDs flash. That\'s pairing mode.',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: HaHoSpacing.md),
        _SubtleHint(
          icon: Icons.bluetooth,
          text:
              'Make sure Bluetooth is on. If your reader has been paired to '
              'another phone, unpair it there first.',
        ),
        const SizedBox(height: HaHoSpacing.xl),
        Row(
          children: [
            Expanded(
              child: _PrimaryButton(
                label: 'Scan for readers',
                icon: Icons.bluetooth_searching,
                enabled: enabled,
                onPressed: onContinue,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Step 3: Scan ───────────────────────────────────────────────────────

class _ScanStep extends StatelessWidget {
  final List<Reader> readers;
  final String? error;
  final void Function(Reader r) onPick;
  final VoidCallback onBack;
  final VoidCallback onRescan;
  const _ScanStep({
    required this.readers,
    required this.error,
    required this.onPick,
    required this.onBack,
    required this.onRescan,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('Pick your reader', style: HaHoTextStyles.h3)),
            if (readers.isEmpty)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          readers.isEmpty
              ? 'Looking for nearby readers. Keep your reader powered on and nearby.'
              : 'Tap the row that matches your reader\'s serial.',
          style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
        ),
        const SizedBox(height: HaHoSpacing.lg),
        if (readers.isEmpty)
          Container(
            padding: const EdgeInsets.all(HaHoSpacing.xl),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(HaHoRadius.lg),
              border: Border.all(color: HaHoColors.border),
            ),
            child: const Icon(
              Icons.bluetooth_searching,
              size: 48,
              color: HaHoColors.textGray,
            ),
          )
        else
          ...readers.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(HaHoRadius.lg),
                child: InkWell(
                  borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  onTap: () => onPick(r),
                  child: Container(
                    padding: const EdgeInsets.all(HaHoSpacing.md),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(HaHoRadius.lg),
                      border: Border.all(color: HaHoColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.credit_card,
                          color: HaHoColors.primary,
                        ),
                        const SizedBox(width: HaHoSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                readerName(r),
                                style: HaHoTextStyles.body.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${r.serialNumber}'
                                '${terminalBatteryLabel(r.batteryLevel)}',
                                style: HaHoTextStyles.caption.copyWith(
                                  color: HaHoColors.textGray,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_ios,
                          size: 14,
                          color: HaHoColors.textGray,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (error != null) ...[
          const SizedBox(height: HaHoSpacing.sm),
          _Banner(tone: HaHoColors.error, message: error!),
        ],
        const SizedBox(height: HaHoSpacing.xl),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onBack,
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: HaHoSpacing.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onRescan,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Rescan'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Step 4: Pairing (loading) ──────────────────────────────────────────

class _PairingStep extends StatelessWidget {
  final Reader? reader;
  const _PairingStep({required this.reader});

  @override
  Widget build(BuildContext context) {
    // Bind to the terminal service's update-progress notifier so a
    // firmware update fires the progress bar instead of leaving the
    // operator watching an indeterminate spinner for 5+ minutes.
    return ValueListenableBuilder<ReaderUpdate?>(
      valueListenable: stripeTerminalService.updateProgress,
      builder: (context, update, _) {
        if (update != null && update.phase == 'installing') {
          return _UpdatingView(progress: update.progress);
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: HaHoSpacing.xxl),
            const Center(child: CircularProgressIndicator()),
            const SizedBox(height: HaHoSpacing.lg),
            Text(
              'Pairing ${readerName(reader)}…',
              style: HaHoTextStyles.body,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              'This can take up to 30 seconds. If the reader has a firmware '
              'update pending, we\'ll show progress here.',
              style: HaHoTextStyles.caption.copyWith(
                color: HaHoColors.textGray,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        );
      },
    );
  }
}

/// Big visible progress view shown while the M2's firmware is updating.
/// Reader firmware updates can take 2-5 minutes — without surfacing the
/// progress the operator would keep tapping cancel thinking the pair hung.
class _UpdatingView extends StatelessWidget {
  final double progress; // 0.0 – 1.0
  const _UpdatingView({required this.progress});

  @override
  Widget build(BuildContext context) {
    final pct = (progress * 100).clamp(0, 100).toStringAsFixed(0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: HaHoSpacing.xl),
        Center(
          child: Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: HaHoColors.primary.withValues(alpha: 0.10),
            ),
            child: const Icon(
              Icons.system_update_alt,
              size: 44,
              color: HaHoColors.primary,
            ),
          ),
        ),
        const SizedBox(height: HaHoSpacing.lg),
        Center(
          child: Text(
            'Updating reader firmware',
            style: HaHoTextStyles.h3,
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 4),
        Center(
          child: Text(
            'First-time pair — Stripe is pushing the latest firmware to the M2. '
            'This can take 2–5 minutes. Keep the reader powered on and within '
            'Bluetooth range.',
            style: HaHoTextStyles.caption.copyWith(color: HaHoColors.textGray),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: HaHoSpacing.xl),
        // Big visible progress bar.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(HaHoRadius.pill),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 10,
                  backgroundColor: HaHoColors.border,
                  valueColor: const AlwaysStoppedAnimation(HaHoColors.primary),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '$pct%',
                textAlign: TextAlign.center,
                style: HaHoTextStyles.body.copyWith(
                  fontWeight: FontWeight.w700,
                  color: HaHoColors.textDark,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: HaHoSpacing.lg),
        const _SubtleHint(
          icon: Icons.warning_amber_outlined,
          text:
              'Don\'t cancel or switch apps — interrupting a firmware update '
              'can leave the reader stuck in recovery mode.',
        ),
      ],
    );
  }
}

// ─── Step 5: Done ───────────────────────────────────────────────────────

class _DoneStep extends StatelessWidget {
  final Reader? reader;
  final VoidCallback onUnpair;
  final VoidCallback onReplace;
  const _DoneStep({
    required this.reader,
    required this.onUnpair,
    required this.onReplace,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(HaHoSpacing.xl),
          decoration: BoxDecoration(
            color: HaHoColors.success.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(HaHoRadius.lg),
            border: Border.all(
              color: HaHoColors.success.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            children: [
              const Icon(
                Icons.check_circle,
                size: 48,
                color: HaHoColors.success,
              ),
              const SizedBox(height: HaHoSpacing.md),
              Text(
                readerName(reader),
                style: HaHoTextStyles.h3,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                '${reader?.deviceType?.name ?? '—'}'
                '${terminalBatteryLabel(reader?.batteryLevel)}',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
              ),
              const SizedBox(height: HaHoSpacing.lg),
              Text(
                'Ready to take card-present payments. Pick your card terminal payment option at '
                'Checkout to charge through this device.',
                style: HaHoTextStyles.caption.copyWith(
                  color: HaHoColors.textGray,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
        const SizedBox(height: HaHoSpacing.lg),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onReplace,
                icon: const Icon(Icons.swap_horiz, size: 16),
                label: const Text('Pair a different reader'),
              ),
            ),
            const SizedBox(width: HaHoSpacing.sm),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: HaHoColors.error,
                  side: const BorderSide(color: HaHoColors.error),
                ),
                onPressed: onUnpair,
                icon: const Icon(Icons.bluetooth_disabled, size: 16),
                label: const Text('Unpair'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Shared bits ────────────────────────────────────────────────────────

class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool enabled;
  final VoidCallback onPressed;
  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.enabled,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: enabled ? onPressed : null,
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: HaHoColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final String message;
  final Color tone;
  const _Banner({required this.message, required this.tone});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.sm),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
      ),
      child: Text(
        message,
        style: HaHoTextStyles.body.copyWith(
          color: tone,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _SubtleHint extends StatelessWidget {
  final IconData icon;
  final String text;
  const _SubtleHint({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(HaHoSpacing.sm),
      decoration: BoxDecoration(
        color: HaHoColors.cardLight,
        borderRadius: BorderRadius.circular(HaHoRadius.md),
        border: Border.all(color: HaHoColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: HaHoColors.textGray),
          const SizedBox(width: HaHoSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: HaHoTextStyles.caption.copyWith(
                color: HaHoColors.textGray,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(HaHoSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: HaHoColors.error, size: 48),
            const SizedBox(height: HaHoSpacing.md),
            Text(
              message,
              style: HaHoTextStyles.body.copyWith(color: HaHoColors.error),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: HaHoSpacing.lg),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
