import 'package:flutter/material.dart';

import '../config/setup.dart';
import '../config/stowbo_theme.dart';

/// The current setup's wordmark.
///
/// Looks for `assets/images/<setup id>_wordmark.png` and falls back to the
/// brand name set in type when that asset is not bundled. The fallback matters:
/// without it a setup with no artwork yet would render whichever logo happened
/// to be in the repo, and a muvmnt build would show Stowbo's.
class BrandWordmark extends StatelessWidget {
  final double size;
  const BrandWordmark({super.key, this.size = 32});

  @override
  Widget build(BuildContext context) {
    final setup = CurrentSetup.value;
    final name = setup.brand.name.isEmpty ? 'Appmint One' : setup.brand.name;

    return Image.asset(
      'assets/images/${setup.id}_wordmark.png',
      height: size * 1.15,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => _TypeWordmark(name: name, size: size),
    );
  }
}

class _TypeWordmark extends StatelessWidget {
  final String name;
  final double size;
  const _TypeWordmark({required this.name, required this.size});

  @override
  Widget build(BuildContext context) {
    // `size` is the height a logo image would occupy. Setting type at that
    // size produces a second headline competing with the screen's own title,
    // so the mark is set smaller and wider — it should read as a brand mark
    // above the page, not as the page's heading.
    return Text(
      name.toUpperCase(),
      style: TextStyle(
        fontSize: size * 0.42,
        height: 1.15,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
        color: SColors.ink2,
      ),
    );
  }
}
