import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../services/stripe_terminal_service.dart';

/// One-button, self-service card-reader pairing (Stripe M2 / BBPOS / WisePad).
///
/// No wizard, no forms. The host presses **Pair** and everything happens on
/// its own: resolve a Stripe location, scan over Bluetooth, connect to the
/// first reader in pairing mode, ride out any firmware update, done. The only
/// time we stop for the host is a genuine blocker (Bluetooth off, no reader
/// found, no listing to register against) — with a one-line fix and Retry.
class CardReaderScreen extends StatefulWidget {
  const CardReaderScreen({super.key});

  @override
  State<CardReaderScreen> createState() => _CardReaderScreenState();
}

/// Compact top-panel indicator that appears ONLY once a reader is paired, so
/// the host has one-tap access to it (status / unpair / re-pair). Hidden when
/// nothing is connected — it never clutters the header otherwise. Re-polls on
/// app resume and after returning from the reader screen.
class ReaderChip extends StatefulWidget {
  const ReaderChip({super.key});
  @override
  State<ReaderChip> createState() => _ReaderChipState();
}

class _ReaderChipState extends State<ReaderChip> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    // Rebuild the instant a reader connects/disconnects anywhere in the app.
    return ValueListenableBuilder<int>(
      valueListenable: stripeTerminalService.connectionRevision,
      builder: (context, _, __) => _chip(context),
    );
  }

  Widget _chip(BuildContext context) {
    final svc = stripeTerminalService;
    if (!svc.isConnected) return const SizedBox.shrink();
    final label = svc.isTapToPay ? 'Tap' : 'Reader';
    return Tooltip(
      message: 'Card reader — connected',
      child: InkWell(
        borderRadius: BorderRadius.circular(SRadius.pill),
        onTap: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CardReaderScreen()),
          );
          if (mounted) setState(() {});
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: SColors.greenSoft,
            borderRadius: BorderRadius.circular(SRadius.pill),
            border: Border.all(color: SColors.green.withValues(alpha: 0.3)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.contactless_rounded, size: 15, color: SColors.green),
            const SizedBox(width: 5),
            Text(label,
                style: const TextStyle(
                    color: SColors.green,
                    fontSize: 12,
                    fontWeight: FontWeight.w800)),
          ]),
        ),
      ),
    );
  }
}

enum _State { idle, working, done, error }

class _CardReaderScreenState extends State<CardReaderScreen> {
  final _svc = stripeTerminalService;
  final _api = StowboApi();

  _State _state = _State.idle;
  String _status = '';
  String? _error;
  StreamSubscription<List<Reader>>? _sub;

  @override
  void initState() {
    super.initState();
    // If a reader is already paired, land straight on the "done" view.
    if (_svc.isConnected && _svc.connectionKind == 'bluetooth') {
      _state = _State.done;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  // ── the whole magic, one method ──────────────────────────────────────────
  Future<void> _pair() async {
    if (_state == _State.working) return;
    setState(() {
      _state = _State.working;
      _error = null;
      _status = 'Waking up…';
    });
    try {
      await _svc.restoreConnection();
      if (!mounted) return;

      if (_svc.isConnected && _svc.connectionKind == 'bluetooth') {
        setState(() => _state = _State.done);
        return;
      }

      // 1. A Stripe location to register the reader against — resolved silently.
      setState(() => _status = 'Getting things ready…');
      await _ensureLocation();
      if (!mounted) return;

      // 2. Scan and connect to the first reader we see in pairing mode.
      setState(() => _status = 'Looking for your reader…');
      final reader = await _firstReader();
      if (!mounted) return;
      if (reader == null) {
        throw Exception(
            'No reader found. Hold the power button for ~4 seconds until the '
            'lights flash, make sure Bluetooth is on, then try again.');
      }

      setState(() =>
          _status = 'Pairing ${reader.label ?? reader.serialNumber}…');
      await _svc.connectBluetooth(reader);

      if (!mounted) return;
      setState(() => _state = _State.done);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _state = _State.error;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  /// Resolve from the host's own listing and its saved address on every pairing.
  Future<void> _ensureLocation() async {
    final listings = await _api.hostListings();
    if (listings.isEmpty) {
      throw Exception(
          'Add a listing with an address first — the reader registers to it.');
    }
    Map<String, dynamic>? listing = listings.first;
    if (listings.length > 1) {
      if (!mounted) return;
      listing = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        builder: (context) => SafeArea(child: ListView(shrinkWrap: true, children: [
          const ListTile(title: Text('Where will you use this reader?')),
          for (final item in listings)
            ListTile(
              title: Text('${item['data']?['title'] ?? item['title'] ?? 'Listing'}'),
              onTap: () => Navigator.pop(context, item),
            ),
        ])),
      );
      if (listing == null) throw Exception('Choose a listing to pair the reader.');
    }
    final id = (listing['sk'] ??
            listing['id'] ??
            (listing['data'] is Map
                ? listing['data']['sk']
                : null) ??
            '')
        .toString();
    if (id.isEmpty) throw Exception('Could not resolve a location for the reader.');
    await _svc.ensureLocationForListing(id);
  }

  /// First reader discovered in pairing mode — waits up to the SDK's discovery
  /// timeout, resolving as soon as one shows up.
  Future<Reader?> _firstReader() async {
    final completer = Completer<Reader?>();
    await _sub?.cancel();
    _sub = _svc.discoverBluetoothReaders().listen(
      (readers) {
        if (readers.isNotEmpty && !completer.isCompleted) {
          completer.complete(readers.first);
        }
      },
      onError: (Object e, StackTrace stack) {
        if (!completer.isCompleted) completer.completeError(e, stack);
      },
      onDone: () {
        if (!completer.isCompleted) completer.complete(null);
      },
    );
    // Discovery streams for ~30s; give up a hair after so we surface "not found".
    try {
      return await completer.future
          .timeout(const Duration(seconds: 32), onTimeout: () => null);
    } finally {
      await _sub?.cancel();
      _sub = null;
    }
  }

  Future<void> _unpair() async {
    setState(() {
      _state = _State.working;
      _status = 'Unpairing…';
    });
    try {
      await _svc.disconnect();
    } catch (_) {/* best-effort */}
    if (!mounted) return;
    setState(() => _state = _State.idle);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Card reader')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: _body(),
        ),
      ),
    );
  }

  Widget _body() {
    switch (_state) {
      case _State.working:
        return _WorkingView(status: _status);
      case _State.done:
        return _DoneView(
          reader: _svc.connectedReader,
          onUnpair: _unpair,
          onReplace: _pair,
        );
      case _State.error:
        return _ErrorView(message: _error ?? 'Something went wrong', onRetry: _pair);
      case _State.idle:
        return _IdleView(onPair: _pair);
    }
  }
}

class _IdleView extends StatelessWidget {
  final VoidCallback onPair;
  const _IdleView({required this.onPair});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        Center(
          child: Container(
            width: 108,
            height: 108,
            decoration: BoxDecoration(
                color: SColors.claySoft, shape: BoxShape.circle),
            child: const Icon(Icons.contactless_rounded,
                size: 56, color: SColors.clay),
          ),
        ),
        const SizedBox(height: SSpace.xl),
        Text('Pair a card reader',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayLarge),
        const SizedBox(height: SSpace.sm),
        const Text(
          'Turn your reader on and hold its power button until the lights '
          'flash. Then tap Pair — we handle the rest.',
          textAlign: TextAlign.center,
          style: TextStyle(color: SColors.muted, fontSize: 14),
        ),
        const Spacer(),
        ElevatedButton.icon(
          onPressed: onPair,
          style: ElevatedButton.styleFrom(
              backgroundColor: SColors.clay,
              minimumSize: const Size.fromHeight(56)),
          icon: const Icon(Icons.bluetooth_searching_rounded,
              color: Colors.white),
          label: const Text('Pair',
              style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16)),
        ),
        const SizedBox(height: SSpace.sm),
        const Center(
          child: Text('Stripe M2 · BBPOS WisePOS · WisePad',
              style: TextStyle(color: SColors.faint, fontSize: 12)),
        ),
      ],
    );
  }
}

class _WorkingView extends StatelessWidget {
  final String status;
  const _WorkingView({required this.status});
  @override
  Widget build(BuildContext context) {
    // Surface firmware-update progress if the SDK reports it — a first pair can
    // push firmware for minutes, and a bare spinner reads as "hung".
    return ValueListenableBuilder<ReaderUpdate?>(
      valueListenable: stripeTerminalService.updateProgress,
      builder: (context, update, _) {
        final updating = update != null && update.phase == 'installing';
        // Center on BOTH axes: a Center that fills the space, holding a
        // shrink-wrapped, cross-centered column — so the spinner and text sit
        // dead-middle no matter the parent's layout.
        return Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: SSpace.xl),
            child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (updating) ...[
                const Icon(Icons.system_update_alt_rounded,
                    size: 56, color: SColors.clay),
                const SizedBox(height: SSpace.lg),
                Text('Updating reader firmware',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.displayLarge),
                const SizedBox(height: SSpace.xs),
                const Text(
                  'First pair — this can take a few minutes. Keep the reader on '
                  'and close by. Don’t close the app.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: SColors.muted, fontSize: 13),
                ),
                const SizedBox(height: SSpace.xl),
                ClipRRect(
                  borderRadius: BorderRadius.circular(SRadius.pill),
                  child: LinearProgressIndicator(
                    value: update.progress,
                    minHeight: 10,
                    backgroundColor: SColors.line,
                    valueColor: const AlwaysStoppedAnimation(SColors.clay),
                  ),
                ),
                const SizedBox(height: 6),
                Text('${(update.progress * 100).clamp(0, 100).toStringAsFixed(0)}%',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: SColors.ink)),
              ] else ...[
                const CircularProgressIndicator(color: SColors.clay),
                const SizedBox(height: SSpace.lg),
                Text(status,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: SColors.ink,
                        fontSize: 15,
                        fontWeight: FontWeight.w600)),
              ],
            ],
            ),
          ),
        );
      },
    );
  }
}

class _DoneView extends StatelessWidget {
  final Reader? reader;
  final VoidCallback onUnpair;
  final VoidCallback onReplace;
  const _DoneView({
    required this.reader,
    required this.onUnpair,
    required this.onReplace,
  });
  @override
  Widget build(BuildContext context) {
    final battery = reader?.batteryLevel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        Container(
          padding: const EdgeInsets.all(SSpace.xl),
          decoration: BoxDecoration(
              color: SColors.greenSoft,
              borderRadius: BorderRadius.circular(SRadius.xl)),
          child: Column(
            children: [
              const Icon(Icons.check_circle_rounded,
                  size: 56, color: SColors.green),
              const SizedBox(height: SSpace.md),
              Text(reader?.label ?? reader?.serialNumber ?? 'Reader paired',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displayLarge),
              const SizedBox(height: 4),
              Text(
                '${reader?.deviceType?.name ?? 'Reader'}'
                '${battery != null ? '  •  ${(battery * 100).toStringAsFixed(0)}% battery' : ''}',
                style: const TextStyle(color: SColors.muted, fontSize: 13),
              ),
              const SizedBox(height: SSpace.md),
              const Text(
                'Ready. On Take payment, tap the customer’s card on the reader.',
                textAlign: TextAlign.center,
                style: TextStyle(color: SColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
        const Spacer(),
        OutlinedButton.icon(
          onPressed: onReplace,
          icon: const Icon(Icons.swap_horiz_rounded, size: 18),
          label: const Text('Pair a different reader'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
        ),
        const SizedBox(height: SSpace.sm),
        OutlinedButton.icon(
          onPressed: onUnpair,
          icon: const Icon(Icons.bluetooth_disabled_rounded,
              size: 18, color: SColors.danger),
          label:
              const Text('Unpair', style: TextStyle(color: SColors.danger)),
          style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
              side: const BorderSide(color: SColors.danger)),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(),
        const Center(
          child: Icon(Icons.error_outline_rounded,
              size: 56, color: SColors.danger),
        ),
        const SizedBox(height: SSpace.lg),
        Text(message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: SColors.ink, fontSize: 15)),
        const Spacer(),
        ElevatedButton.icon(
          onPressed: onRetry,
          style: ElevatedButton.styleFrom(
              backgroundColor: SColors.clay,
              minimumSize: const Size.fromHeight(54)),
          icon: const Icon(Icons.refresh_rounded, color: Colors.white),
          label: const Text('Try again',
              style: TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }
}
