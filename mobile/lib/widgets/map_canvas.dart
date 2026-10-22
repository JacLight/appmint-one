import 'dart:math';

import 'package:flutter/material.dart';

import '../config/stowbo_theme.dart';

/// The map surface behind a map-first screen.
///
/// When the org's Google key is available the real map goes here. Until then
/// this draws a stylised street plan rather than leaving a grey rectangle —
/// a blank block reads as broken, and the layout of a map-first screen cannot
/// be judged against an empty box.
class MapCanvas extends StatelessWidget {
  /// Drawn deterministically, so the "city" does not reshuffle on every build.
  final int seed;
  const MapCanvas({super.key, this.seed = 7});

  @override
  Widget build(BuildContext context) => CustomPaint(
        painter: _StreetPainter(seed),
        size: Size.infinite,
      );
}

class _StreetPainter extends CustomPainter {
  final int seed;
  _StreetPainter(this.seed);

  static const _land = Color(0xFFEFEADF);
  static const _block = Color(0xFFE7E0D2);
  static const _road = Color(0xFFFFFDF8);
  static const _major = Color(0xFFF7F2E6);
  static const _water = Color(0xFFDCE6E4);

  @override
  void paint(Canvas canvas, Size size) {
    final r = Random(seed);
    canvas.drawRect(Offset.zero & size, Paint()..color = _land);

    // A river, so the plan has one organic line among the grid.
    final river = Path()..moveTo(size.width * 0.78, -20);
    river.cubicTo(size.width * 0.62, size.height * 0.25, size.width * 0.95,
        size.height * 0.5, size.width * 0.70, size.height + 20);
    canvas.drawPath(
        river,
        Paint()
          ..color = _water
          ..style = PaintingStyle.stroke
          ..strokeWidth = size.width * 0.11
          ..strokeCap = StrokeCap.round);

    // City blocks, then the roads drawn over them.
    const cols = 6, rows = 10;
    final cw = size.width / cols, ch = size.height / rows;
    final blockPaint = Paint()..color = _block;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        if (r.nextDouble() < 0.22) continue; // a square or a park
        final inset = 6.0 + r.nextDouble() * 5;
        final rect = Rect.fromLTWH(i * cw + inset, j * ch + inset,
            cw - inset * 2, ch - inset * 2);
        canvas.drawRRect(
            RRect.fromRectAndRadius(rect, const Radius.circular(3)),
            blockPaint);
      }
    }

    final road = Paint()
      ..color = _road
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5;
    final majorRoad = Paint()
      ..color = _major
      ..style = PaintingStyle.stroke
      ..strokeWidth = 13;

    for (var i = 1; i < cols; i++) {
      final x = i * cw;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height),
          i == 2 ? majorRoad : road);
    }
    for (var j = 1; j < rows; j++) {
      final y = j * ch;
      canvas.drawLine(Offset(0, y), Offset(size.width, y),
          j == 4 ? majorRoad : road);
    }
  }

  @override
  bool shouldRepaint(covariant _StreetPainter old) => old.seed != seed;
}

/// A pin, as the map would drop it.
class MapPin extends StatelessWidget {
  final Color colour;
  final IconData icon;
  final bool small;
  const MapPin({
    super.key,
    required this.colour,
    this.icon = Icons.place_rounded,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final d = small ? 26.0 : 38.0;
    return Container(
      width: d,
      height: d,
      decoration: BoxDecoration(
        color: colour,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: [
          BoxShadow(
            color: SColors.ink.withValues(alpha: 0.22),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Icon(icon, size: small ? 13 : 18, color: Colors.white),
    );
  }
}
