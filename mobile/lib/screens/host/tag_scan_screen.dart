import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../config/stowbo_theme.dart';

/// Point-and-read for a QR or barcode tag — a guest's booking code, a bag-check
/// ticket, a locker sticker, a bay label. Returns the decoded string to the
/// caller, which feeds it straight into `resolve` (the same search box the
/// operator would otherwise type into). This screen only reads; it takes no
/// action of its own.
class TagScanScreen extends StatefulWidget {
  const TagScanScreen({super.key});
  @override
  State<TagScanScreen> createState() => _TagScanScreenState();
}

class _TagScanScreenState extends State<TagScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode, BarcodeFormat.code128, BarcodeFormat.code39],
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final b in capture.barcodes) {
      final raw = (b.rawValue ?? '').trim();
      if (raw.isEmpty) continue;
      _handled = true;
      // Tags encode either a bare code/reference, or "bookingId|code". Resolve
      // matches on the reference and the identifier alike, so pass the most
      // useful token: the part after a pipe if present, else the whole string.
      // A pickup pass QR is `stowbo:pickup:<code>` — keep it whole; the counter
      // resolves it into a handover checklist.
      final code = raw.startsWith('stowbo:') ? raw : (raw.contains('|') ? raw.split('|').last.trim() : raw);
      Navigator.pop(context, code.isEmpty ? raw : code);
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan a tag'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded),
            tooltip: 'Torch',
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch_rounded),
            tooltip: 'Flip camera',
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(children: [
        MobileScanner(controller: _controller, onDetect: _onDetect),
        // Reticle
        Center(
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              border: Border.all(color: SColors.clay, width: 3),
              borderRadius: BorderRadius.circular(SRadius.lg),
            ),
          ),
        ),
        const Positioned(
          left: 0,
          right: 0,
          bottom: 48,
          child: Center(
            child: Text('Line up the QR or barcode',
                style: TextStyle(color: Colors.white70, fontSize: 14)),
          ),
        ),
      ]),
    );
  }
}
