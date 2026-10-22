import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/environment.dart';
import 'config/setup.dart';
import 'config/stowbo_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/checkout_provider.dart';
import 'providers/custody_provider.dart';
import 'providers/discovery_provider.dart';
import 'providers/driver_provider.dart';
import 'providers/logistics_provider.dart';
import 'providers/banking_provider.dart';
import 'providers/scheduling_provider.dart';
import 'providers/store_provider.dart';
import 'providers/property_provider.dart';
import 'providers/tenancy_provider.dart';
import 'providers/learning_provider.dart';
import 'providers/role_provider.dart';
import 'providers/setup_provider.dart';
import 'services/http_client.dart';
import 'services/storage_service.dart';
import 'services/stripe_service.dart';
import 'screens/root_screen.dart';
import 'services/update_checker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  EnvironmentConfig.setEnvironment(
      kReleaseMode ? Environment.production : Environment.development);

  await storageService.initialize();
  // Warm the app token in the background — do NOT block first paint on a
  // network round-trip (on web a slow/blocked token call would leave a blank
  // page). Requests fetch the token on demand anyway.
  unawaited(appengineHttpClient.initialize());

  // Initialize Stripe at startup (mobile only) so the native SDK has the
  // publishable key well before the guest taps Pay — setting it lazily inside
  // the pay flow races the sheet and it silently fails to present. (dfw_errand
  // does exactly this and its sheet works.)
  if (!kIsWeb) unawaited(StripeService.initialize());

  runApp(const AppmintOneApp());
}

class AppmintOneApp extends StatelessWidget {
  const AppmintOneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..restore()),
        ChangeNotifierProvider(create: (_) => RoleProvider()..load()),
        ChangeNotifierProvider(create: (_) => SetupProvider()..load()),
        ChangeNotifierProvider(create: (_) => DiscoveryProvider()),
        ChangeNotifierProvider(create: (_) => CustodyProvider()),
        ChangeNotifierProvider(create: (_) => CheckoutProvider()),
        ChangeNotifierProvider(create: (_) => LogisticsProvider()),
        ChangeNotifierProvider(create: (_) => DriverProvider()),
        ChangeNotifierProvider(create: (_) => BankingProvider()),
        ChangeNotifierProvider(create: (_) => SchedulingProvider()),
        ChangeNotifierProvider(create: (_) => StoreProvider()),
        ChangeNotifierProvider(create: (_) => PropertyProvider()),
        ChangeNotifierProvider(create: (_) => TenancyProvider()),
        ChangeNotifierProvider(create: (_) => LearningProvider()),
      ],
      child: Consumer<SetupProvider>(
        builder: (context, setups, _) => MaterialApp(
          key: ValueKey('setup-' + setups.active.id),
        // The OS task-switcher title is the setup's brand, not the
        // scaffold's name.
        title: CurrentSetup.brand.name.isEmpty
            ? 'Appmint One'
            : CurrentSetup.brand.name,
        debugShowCheckedModeBanner: false,
        // Each setup wears its own brand, buttons included.
        theme: StowboTheme.forBrand(setups.active.brand),
        // On a wide screen (web/desktop) keep the mobile-first layout centered
        // in a phone-width column instead of stretching edge to edge.
        builder: (context, child) {
          if (child == null) return const SizedBox.shrink();
          final w = MediaQuery.of(context).size.width;
          if (w <= 620) return child;
          return ColoredBox(
            color: SColors.paper2,
            child: Center(
              child: ClipRect(
                child: SizedBox(width: 480, child: child),
              ),
            ),
          );
        },
        home: const UpdateGate(child: RootScreen()),
      ),
        ),
    );
  }
}
