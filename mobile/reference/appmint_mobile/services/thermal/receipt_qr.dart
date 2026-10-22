import 'package:image/image.dart' as img;
import 'package:qr/qr.dart';

/// A roughly 40 mm QR including a four-module white quiet zone. Integer
/// module sizes avoid blurred edges; 320 dots also fits 58 mm receipt paper.
img.Image receiptQrImage(String data) {
  final qr = QrImage(
    QrCode.fromData(data: data, errorCorrectLevel: QrErrorCorrectLevel.M),
  );
  const quietZone = 4;
  final modules = qr.moduleCount + quietZone * 2;
  final scale = 320 ~/ modules;
  if (scale < 2) {
    throw ArgumentError('QR content is too long to print clearly.');
  }
  // ESC/POS raster rows are byte-aligned. Pad instead of resizing modules.
  final symbolSide = modules * scale;
  final side = ((symbolSide + 7) ~/ 8) * 8;
  final inset = (side - symbolSide) ~/ 2;
  final image = img.Image(width: side, height: side);
  img.fill(image, color: img.ColorRgb8(255, 255, 255));
  for (var row = 0; row < qr.moduleCount; row++) {
    for (var col = 0; col < qr.moduleCount; col++) {
      if (!qr.isDark(row, col)) continue;
      final x = inset + (col + quietZone) * scale;
      final y = inset + (row + quietZone) * scale;
      img.fillRect(
        image,
        x1: x,
        y1: y,
        x2: x + scale - 1,
        y2: y + scale - 1,
        color: img.ColorRgb8(0, 0, 0),
      );
    }
  }
  return image;
}
