import 'package:flutter/material.dart';

/// Business-app color palette. The original coral/cyan combo read as
/// "kids' app"; this swaps in a slate + blue + emerald palette common to
/// modern SaaS dashboards (Stripe, Linear, Notion, Vercel admin) — neutral
/// enough that financial / operational data stays readable.
class HaHoColors {
  // Backgrounds — cool off-white instead of cream so all the new accents
  // sit on it cleanly.
  static const Color background = Color(0xFFF8FAFC); // slate-50
  static const Color cardLight = Color(0xFFFFFFFF); // white
  static const Color cardDark = Color(0xFF1F2937);  // slate-800 (was teal)

  // Primary & accent
  static const Color primary = Color(0xFF1F2937); // slate-800 (was coral red)
  static const Color accent = Color(0xFF2563EB);  // blue-600 (was bright cyan)

  // Status colors — saturated enough to read at a glance but not loud.
  static const Color success = Color(0xFF059669); // emerald-600 (was minty teal)
  static const Color warning = Color(0xFFD97706); // amber-600 (was washed yellow)
  static const Color error   = Color(0xFFDC2626); // red-600   (was coral pink)

  // Text
  static const Color textDark = Color(0xFF0F172A);  // slate-900
  static const Color textLight = Color(0xFFFFFFFF);
  static const Color textGray = Color(0xFF64748B);  // slate-500

  // Dividers & borders
  static const Color divider = Color(0xFFE2E8F0); // slate-200
  static const Color border  = Color(0xFFE2E8F0); // slate-200
}

/// HaHo Design System Spacing
class HaHoSpacing {
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 32.0;

  // Card specific
  static const double cardPadding = 20.0;
  static const double cardMargin = 16.0;
  static const double sectionSpacing = 24.0;
}

/// HaHo Design System Radius
class HaHoRadius {
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 28.0;
  static const double pill = 100.0;
}

/// HaHo Design System Shadows
class HaHoShadows {
  static List<BoxShadow> card = [
    BoxShadow(
      color: Colors.black.withOpacity(0.08),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> cardLight = [
    BoxShadow(
      color: Colors.black.withOpacity(0.04),
      blurRadius: 8,
      offset: const Offset(0, 2),
    ),
  ];

  static List<BoxShadow> fab = [
    BoxShadow(
      color: HaHoColors.primary.withOpacity(0.3),
      blurRadius: 16,
      offset: const Offset(0, 6),
    ),
  ];
}

/// HaHo Design System Text Styles
class HaHoTextStyles {
  // Headings
  static const TextStyle h1 = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: HaHoColors.textDark,
    height: 1.2,
  );

  static const TextStyle h2 = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: HaHoColors.textDark,
    height: 1.3,
  );

  static const TextStyle h3 = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: HaHoColors.textDark,
    height: 1.3,
  );

  static const TextStyle h4 = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: HaHoColors.textDark,
    height: 1.4,
  );

  // Body text
  static const TextStyle body = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.normal,
    color: HaHoColors.textDark,
    height: 1.5,
  );

  static const TextStyle bodySmall = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: HaHoColors.textGray,
    height: 1.5,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.normal,
    color: HaHoColors.textGray,
    height: 1.4,
  );

  // Stats & Numbers
  static const TextStyle stats = TextStyle(
    fontSize: 48,
    fontWeight: FontWeight.bold,
    color: HaHoColors.textLight,
    height: 1.2,
  );

  static const TextStyle statsMedium = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: HaHoColors.textLight,
    height: 1.2,
  );

  // Button text
  static const TextStyle button = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: HaHoColors.textLight,
  );

  static const TextStyle buttonSmall = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: HaHoColors.textLight,
  );
}

/// HaHo Theme Data
class HaHoTheme {
  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: HaHoColors.background,
    colorScheme: const ColorScheme.light(
      primary: HaHoColors.primary,
      secondary: HaHoColors.accent,
      error: HaHoColors.error,
      background: HaHoColors.background,
      surface: HaHoColors.cardLight,
    ),

    // App Bar Theme
    appBarTheme: const AppBarTheme(
      backgroundColor: HaHoColors.background,
      elevation: 0,
      centerTitle: true,
      iconTheme: IconThemeData(color: HaHoColors.textDark),
      titleTextStyle: HaHoTextStyles.h3,
    ),

    // Card Theme
    cardTheme: CardThemeData(
      color: HaHoColors.cardLight,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(HaHoRadius.xxl),
      ),
      margin: const EdgeInsets.symmetric(
        horizontal: HaHoSpacing.cardMargin,
        vertical: HaHoSpacing.sm,
      ),
    ),

    // Elevated Button Theme
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: HaHoColors.primary,
        foregroundColor: HaHoColors.textLight,
        elevation: 0,
        padding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.lg,
          vertical: HaHoSpacing.md,
        ),
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(HaHoRadius.pill),
        ),
        textStyle: HaHoTextStyles.button,
      ),
    ),

    // Outlined Button Theme
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: HaHoColors.textDark,
        side: const BorderSide(color: HaHoColors.border),
        padding: const EdgeInsets.symmetric(
          horizontal: HaHoSpacing.lg,
          vertical: HaHoSpacing.md,
        ),
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(HaHoRadius.pill),
        ),
      ),
    ),

    // Input Decoration Theme
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: HaHoColors.cardLight,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: HaHoSpacing.xl,
        vertical: HaHoSpacing.lg,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaHoRadius.xxl),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaHoRadius.xxl),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaHoRadius.xxl),
        borderSide: const BorderSide(color: HaHoColors.accent, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(HaHoRadius.xxl),
        borderSide: const BorderSide(color: HaHoColors.error, width: 2),
      ),
    ),

    // Bottom Navigation Bar Theme
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: HaHoColors.cardLight,
      selectedItemColor: HaHoColors.textDark,
      unselectedItemColor: HaHoColors.textGray,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),

    // Divider Theme
    dividerTheme: const DividerThemeData(
      color: HaHoColors.divider,
      thickness: 1,
      space: 1,
    ),
  );

  static ThemeData get darkTheme => lightTheme; // Dark theme same as light for now
}

/// App Theme - Alias for HaHo Theme
class AppTheme {
  static ThemeData get lightTheme => HaHoTheme.lightTheme;
  static ThemeData get darkTheme => HaHoTheme.darkTheme;
}
