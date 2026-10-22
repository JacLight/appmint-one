import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// One read of a plate/tag from a photo: the best guess plus every candidate
/// line, so the operator can pick another if the guess is wrong. Recognition is
/// on-device; nothing here talks to the server.
class PlateRead {
  /// Best guess — a plate-shaped token if one was found, else the boldest line.
  final String best;

  /// Every distinct line the recognizer saw, cleaned, in reading order. The UI
  /// offers these as one-tap alternatives when [best] is wrong.
  final List<String> candidates;

  const PlateRead({required this.best, required this.candidates});

  bool get isEmpty => best.isEmpty;
}

/// On-device OCR tuned for short alphanumeric identifiers — a plate, a bag tag,
/// a bay label. Not a general document reader: it ranks lines by how much they
/// look like a plate and hands back the winner for the operator to confirm.
class PlateOcrService {
  final TextRecognizer _recognizer =
      TextRecognizer(script: TextRecognitionScript.latin);

  /// Read [imagePath] (a captured photo) and return the best plate candidate.
  Future<PlateRead> read(String imagePath) async {
    final input = InputImage.fromFilePath(imagePath);
    final result = await _recognizer.processImage(input);

    // Flatten to individual lines. Plates are single lines; multi-word blocks
    // are addresses, stickers, dealer frames — noise we rank below a plate.
    final lines = <String>[];
    for (final block in result.blocks) {
      for (final line in block.lines) {
        final cleaned = _clean(line.text);
        if (cleaned.isNotEmpty) lines.add(cleaned);
      }
    }

    // Distinct, preserving reading order.
    final seen = <String>{};
    final candidates =
        lines.where((l) => seen.add(l)).toList(growable: false);

    if (candidates.isEmpty) {
      return const PlateRead(best: '', candidates: []);
    }

    // Score every line; the best plate-shaped one wins. If nothing looks like a
    // plate, fall back to the longest alphanumeric line (likely the tag).
    final ranked = [...candidates]
      ..sort((a, b) => _score(b).compareTo(_score(a)));
    final best = _score(ranked.first) > 0
        ? ranked.first
        : candidates.reduce((a, b) => a.length >= b.length ? a : b);

    return PlateRead(best: best, candidates: candidates);
  }

  /// Upper-case, strip everything but A–Z/0–9 and a single space, collapse runs.
  /// A plate read as "7-ABC 123" or "7ABC123" both normalize the same way.
  String _clean(String raw) {
    final up = raw.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9 ]'), '');
    return up.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  /// How plate-like a line is. Plates are 4–8 chars, mostly alphanumeric, and
  /// usually mix letters and digits. Pure words and long strings score low.
  int _score(String s) {
    final compact = s.replaceAll(' ', '');
    final len = compact.length;
    if (len < 4 || len > 9) return 0;
    final hasLetter = RegExp(r'[A-Z]').hasMatch(compact);
    final hasDigit = RegExp(r'[0-9]').hasMatch(compact);
    var score = 0;
    if (len >= 5 && len <= 8) score += 3; // typical plate length
    if (hasLetter && hasDigit) score += 4; // plates mix the two
    if (!s.contains(' ')) score += 1; // plates rarely have spaces once cleaned
    // Penalize things that are clearly words (all letters) or numbers (all
    // digits) — a bag-tag number is still fine, just ranked under a real plate.
    if (hasLetter && !hasDigit) score -= 1;
    return score;
  }

  void dispose() => _recognizer.close();
}
