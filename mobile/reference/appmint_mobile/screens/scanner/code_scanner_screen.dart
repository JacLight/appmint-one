import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../config/haho_theme.dart';
import '../../services/event_scan_queue.dart';

/// Generic QR / barcode scanner. Returns the scanned string via Navigator.pop.
/// Caller awaits the push and reads the result:
///
/// ```dart
/// final code = await Navigator.push<String?>(
///   context,
///   MaterialPageRoute(builder: (_) => const CodeScannerScreen(title: 'Scan SKU')),
/// );
/// if (code != null) { ... }
/// ```
///
/// Stops scanning as soon as the first valid barcode arrives so the caller
/// doesn't get duplicate hits. Vibrates on hit for tactile feedback.
class CodeScannerScreen extends StatefulWidget {
  /// AppBar title — describes what the user is scanning for ("Scan SKU",
  /// "Scan reservation", "Scan ticket", etc.).
  final String title;
  /// Optional caption shown below the viewfinder.
  final String? hint;
  /// Restrict to specific barcode formats. Empty = accept any.
  final List<BarcodeFormat> formats;
  /// If true, return immediately on first detection. If false, the user
  /// must confirm. Default true — POS-style: scan = enter.
  final bool autoSubmit;

  /// Continuous mode: process each presented code without closing the camera.
  final Future<String?> Function(BuildContext context, String code)? onScan;
  final Widget? footer;

  const CodeScannerScreen({
    super.key,
    this.title = 'Scan',
    this.hint,
    this.formats = const [],
    this.autoSubmit = true,
    this.onScan,
    this.footer,
  });

  @override
  State<CodeScannerScreen> createState() => _CodeScannerScreenState();
}

class _CodeScannerScreenState extends State<CodeScannerScreen> {
  late final MobileScannerController _controller;
  bool _torchOn = false;
  bool _handled = false;
  String? _preview;
  final _scanQueue = EventScanQueue();
  String? _scanMessage;
  bool _scanFailed = false;
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      formats: widget.formats.isEmpty ? const [] : widget.formats,
    );
  }

  @override
  void dispose() {
    _scanQueue.dispose();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_handled) return;
    final barcode = capture.barcodes.firstOrNull;
    final value = barcode?.rawValue?.trim();
    if (value == null || value.isEmpty) return;
    if (widget.onScan != null) {
      if (ModalRoute.of(context)?.isCurrent != true) return;
      await _scanQueue.submit(value, () async {
        if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
        setState(() {
          _processing = true;
          _scanFailed = false;
          _scanMessage = 'Looking up product…';
        });
        try {
          final message = await widget.onScan!(context, value);
          if (!mounted) return;
          setState(() => _scanMessage = message ?? 'Ready for the next product');
          if (message != null) await HapticFeedback.mediumImpact();
        } catch (error) {
          if (!mounted) return;
          setState(() {
            _scanFailed = true;
            _scanMessage = error.toString().replaceFirst(RegExp(r'^(Exception|Bad state): '), '');
          });
        } finally {
          if (mounted) setState(() => _processing = false);
        }
      });
      return;
    }
    setState(() {
      _handled = widget.autoSubmit; // lock if auto-submit
      _preview = value;
    });
    await HapticFeedback.mediumImpact();
    if (widget.autoSubmit && mounted) {
      await _controller.stop();
      if (!mounted) return;
      Navigator.pop(context, value);
    }
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      setState(() => _torchOn = !_torchOn);
    } catch (_) {
      // Some devices have no torch; ignore.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        actionsIconTheme: const IconThemeData(color: Colors.white),
        titleTextStyle: HaHoTextStyles.h3.copyWith(color: Colors.white),
        systemOverlayStyle: SystemUiOverlayStyle.light,
        elevation: 0,
        title: Text(widget.title),
        actions: [
          IconButton(
            tooltip: _torchOn ? 'Torch off' : 'Torch on',
            icon: Icon(_torchOn ? Icons.flash_on : Icons.flash_off),
            onPressed: _toggleTorch,
          ),
          IconButton(
            tooltip: 'Switch camera',
            icon: const Icon(Icons.cameraswitch),
            onPressed: () async {
              try {
                await _controller.switchCamera();
              } catch (_) {}
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Viewfinder overlay
          IgnorePointer(
            child: Center(
              child: Container(
                width: 260, height: 260,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 2),
                ),
              ),
            ),
          ),
          if (widget.hint != null)
            Positioned(
              top: 20, left: 20, right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: HaHoSpacing.md, vertical: HaHoSpacing.sm),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(HaHoRadius.pill),
                ),
                child: Text(
                  widget.hint!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
          if (widget.onScan != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: SafeArea(
                top: false,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(HaHoRadius.lg),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _scanMessage ?? 'Ready for the next product',
                        style: HaHoTextStyles.body.copyWith(
                          color: _scanFailed ? HaHoColors.error : HaHoColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text('Move the code out of view before scanning it again.', style: HaHoTextStyles.caption),
                      if (widget.footer != null) ...[
                        const SizedBox(height: 12),
                        widget.footer!,
                      ],
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _processing ? null : () => Navigator.pop(context),
                        child: const Text('Done'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          // Result strip — only used when autoSubmit=false (e.g., when the
          // caller wants a "did you mean ..." confirm step).
          if (!widget.autoSubmit && _preview != null)
            Positioned(
              left: 16, right: 16, bottom: 24,
              child: Container(
                padding: const EdgeInsets.all(HaHoSpacing.md),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(HaHoRadius.lg),
                ),
                child: Row(children: [
                  const Icon(Icons.qr_code, color: HaHoColors.primary),
                  const SizedBox(width: HaHoSpacing.sm),
                  Expanded(
                    child: Text(
                      _preview!,
                      style: HaHoTextStyles.body.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _preview = null;
                        _handled = false;
                      });
                    },
                    child: const Text('Rescan'),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: HaHoColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: () => Navigator.pop(context, _preview),
                    child: const Text('Use'),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}

/// Convenience: launch the scanner and return the scanned string (or null
/// if the user cancelled). Use from anywhere:
///
/// ```dart
/// final sku = await scanCode(context, title: 'Scan SKU');
/// ```
Future<String?> scanCode(
  BuildContext context, {
  String title = 'Scan',
  String? hint,
  List<BarcodeFormat> formats = const [],
  bool autoSubmit = true,
}) {
  return Navigator.push<String?>(
    context,
    MaterialPageRoute(
      builder: (_) => CodeScannerScreen(
        title: title,
        hint: hint,
        formats: formats,
        autoSubmit: autoSubmit,
      ),
    ),
  );
}
