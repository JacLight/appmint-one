import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'setup.dart';

/// Stowbo brand system — ported from the marketing site (webpages/stowbo).
/// Warm paper background, clay-orange primary CTA, forest-green secondary,
/// amber/lime accents. Space Grotesk (display) + Inter (body). Pill buttons,
/// 22px cards, soft warm shadows.
class SColors {
  // Surfaces
  static const paper = Color(0xFFF5F1E8);
  static const paper2 = Color(0xFFEEE7D8);
  static const card = Color(0xFFFFFDF8);
  static const white = Color(0xFFFFFFFF);

  // Ink / text
  static const ink = Color(0xFF181A12);
  static const ink2 = Color(0xFF3F4338);
  static const muted = Color(0xFF6F7362);
  static const faint = Color(0xFFA3A493);

  // Brand
  static const clay = Color(0xFFCF6A3C); // primary CTA
  static const clay2 = Color(0xFFB5552C);
  static const claySoft = Color(0xFFF4E2D5);
  static const green = Color(0xFF2B5233); // secondary / success
  static const green2 = Color(0xFF1E3C25);
  static const greenSoft = Color(0xFFE5EEDE);
  static const amber = Color(0xFFE3A531);
  static const lime = Color(0xFFA7DD39);
  static const lime2 = Color(0xFF93CB22);

  // Lines
  static const line = Color(0xFFE8E1D0);
  static const line2 = Color(0xFFF0EADC);

  static const danger = Color(0xFFC0432E);
}

class SRadius {
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 18.0; // images
  static const xl = 22.0; // cards
  static const pill = 999.0;
}

class SSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 22.0;
  static const xxl = 32.0;
}

class SShadow {
  static const soft = [
    BoxShadow(color: Color(0x14201C0F), blurRadius: 20, offset: Offset(0, 6)),
  ];
  static const lg = [
    BoxShadow(color: Color(0x26201C0F), blurRadius: 54, offset: Offset(0, 22)),
  ];
}

class StowboTheme {
  /// The theme a setup wears.
  ///
  /// The whole claim of this app is that one codebase becomes somebody's own
  /// product, and the primary button is the most visible thing in it — so it
  /// cannot stay Stowbo's clay on every brand. Colours and fonts come from the
  /// setup; the shapes, spacing and surfaces stay shared, because those are
  /// the design system, not the branding.
  static ThemeData forBrand(Brand brand) {
    final base = light;
    final text = _text(ThemeData.light(useMaterial3: true).textTheme,
        displayFont: brand.displayFont, bodyFont: brand.bodyFont);

    return base.copyWith(
      textTheme: text,
      colorScheme: base.colorScheme.copyWith(
        primary: brand.primary,
        secondary: brand.accent,
      ),
      appBarTheme: base.appBarTheme.copyWith(
        titleTextStyle: text.titleLarge?.copyWith(fontSize: 20),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: brand.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SRadius.pill)),
          textStyle: text.labelLarge,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: brand.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SRadius.pill)),
          textStyle: text.labelLarge,
        ),
      ),
      inputDecorationTheme: base.inputDecorationTheme.copyWith(
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: BorderSide(color: brand.primary, width: 1.8),
        ),
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: brand.primary,
        selectionHandleColor: brand.primary,
        selectionColor: brand.primary.withValues(alpha: 0.25),
      ),
      progressIndicatorTheme:
          ProgressIndicatorThemeData(color: brand.primary),
    );
  }

  /// The fonts a setup may name, resolved by hand.
  ///
  /// Deliberately NOT `GoogleFonts.getFont(name)`: a dynamic lookup keeps the
  /// package's whole generated font catalogue alive through tree-shaking, and
  /// it cost 9MB of APK the first time this was written that way. Adding a
  /// font to a brand means adding a line here — which is also the only place
  /// that says which fonts this app ships.
  static TextStyle _display(String? name) => switch (name) {
        'Fraunces' => GoogleFonts.fraunces(),
        'Space Grotesk' => GoogleFonts.spaceGrotesk(),
        'Inter' => GoogleFonts.inter(),
        _ => GoogleFonts.spaceGrotesk(),
      };

  static TextTheme _bodyTheme(String? name, TextTheme base) =>
      switch (name) {
        'Fraunces' => GoogleFonts.frauncesTextTheme(base),
        'Space Grotesk' => GoogleFonts.spaceGroteskTextTheme(base),
        _ => GoogleFonts.interTextTheme(base),
      };

  static TextTheme _text(TextTheme base, {String? displayFont, String? bodyFont}) {
    final body = _bodyTheme(bodyFont, base);
    final disp = _display(displayFont);
    return body.copyWith(
      displayLarge: disp.copyWith(
          fontSize: 34,
          fontWeight: FontWeight.w700,
          letterSpacing: -1,
          color: SColors.ink,
          height: 1.03),
      headlineMedium: disp.copyWith(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.6,
          color: SColors.ink),
      headlineSmall: disp.copyWith(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
          color: SColors.ink),
      titleLarge: disp.copyWith(
          fontSize: 17, fontWeight: FontWeight.w600, color: SColors.ink),
      titleMedium: disp.copyWith(
          fontSize: 15, fontWeight: FontWeight.w600, color: SColors.ink),
      labelLarge: disp.copyWith(
          fontSize: 15, fontWeight: FontWeight.w600, color: SColors.ink),
    ).apply(bodyColor: SColors.ink2, displayColor: SColors.ink);
  }

  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: SColors.paper,
      colorScheme: base.colorScheme.copyWith(
        primary: SColors.clay,
        onPrimary: Colors.white,
        secondary: SColors.green,
        onSecondary: Colors.white,
        surface: SColors.card,
        onSurface: SColors.ink,
        error: SColors.danger,
      ),
      textTheme: _text(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: SColors.paper,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: SColors.ink),
        titleTextStyle: GoogleFonts.spaceGrotesk(
            fontSize: 20, fontWeight: FontWeight.w700, color: SColors.ink),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: SColors.clay,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SRadius.pill)),
          textStyle: GoogleFonts.spaceGrotesk(
              fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: SColors.ink,
          side: const BorderSide(color: SColors.line, width: 1.6),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(SRadius.pill)),
          textStyle: GoogleFonts.spaceGrotesk(
              fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SColors.card,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.line, width: 1.6),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.line, width: 1.6),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.clay, width: 1.8),
        ),
        hintStyle: const TextStyle(color: SColors.faint),
        labelStyle: const TextStyle(color: SColors.muted),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: SColors.card,
        side: const BorderSide(color: SColors.line, width: 1.4),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SRadius.pill)),
        labelStyle: GoogleFonts.spaceGrotesk(
            fontSize: 13, fontWeight: FontWeight.w600, color: SColors.ink2),
      ),
      dividerColor: SColors.line,
    );
  }
}
