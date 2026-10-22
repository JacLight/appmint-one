import 'package:flutter/material.dart';

import '../config/stowbo_theme.dart';

/// An image area for a card.
///
/// Shows the real photo when there is one. When there is not — which is most
/// of a demo, and plenty of a real catalog — it draws a deterministic gradient
/// keyed off the name with the item's initial set into it. Grey rectangles are
/// what make a catalog look unfinished; this reads as deliberate, and two
/// items never collide on the same colour by accident.
class ThumbArt extends StatelessWidget {
  final String name;
  final String? imageUrl;
  final double? width, height;
  final double radius;
  final IconData? icon;

  const ThumbArt({
    super.key,
    required this.name,
    this.imageUrl,
    this.width,
    this.height,
    this.radius = SRadius.lg,
    this.icon,
  });

  /// Hand-picked pairs — a generated hue would wander into muddy greens and
  /// clash with the paper background.
  static const _palettes = <List<Color>>[
    [Color(0xFF2B5233), Color(0xFF6FA06B)],
    [Color(0xFFCF6A3C), Color(0xFFE8A472)],
    [Color(0xFF14213D), Color(0xFF4B6A9B)],
    [Color(0xFF7A3B5E), Color(0xFFC77EA0)],
    [Color(0xFF1F5E63), Color(0xFF63B0B5)],
    [Color(0xFF8A5B16), Color(0xFFD7A24B)],
  ];

  List<Color> get _palette {
    var h = 0;
    for (final c in name.codeUnits) {
      h = (h * 31 + c) & 0x7fffffff;
    }
    return _palettes[h % _palettes.length];
  }

  @override
  Widget build(BuildContext context) {
    final colours = _palette;
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _painted(colours, initial))
            : _painted(colours, initial),
      ),
    );
  }

  Widget _painted(List<Color> colours, String initial) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: colours,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: Colors.white.withValues(alpha: 0.9), size: 26)
              : Text(
                  initial,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.92),
                    fontSize: (height ?? 80) * 0.34,
                    fontWeight: FontWeight.w800,
                  ),
                ),
        ),
      );
}
