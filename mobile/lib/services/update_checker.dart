import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// Tells a tester when the build they are running is not the newest one.
///
/// Shared, unmodified, by every app in this repo — copied in rather than made a
/// package because the apps have no shared dependency of their own, and a file
/// that must be edited per app is a file that drifts.
///
/// Two values are baked in at build time by `apk-site/build.sh`:
///
///   --dart-define=APP_VERSION=1.0.0+3
///   --dart-define=UPDATE_MANIFEST_URL=http://<host>:8099/versions.json
///   --dart-define=APP_KEY=stowbo
///
/// A build without them (a store release, a plain `flutter run`) has no
/// manifest url, so [UpdateChecker.check] returns null and nothing is shown.
/// That is deliberate: a release build must never point testers at a laptop.
class UpdateInfo {
  final String appName;
  final String version; // "1.0.0+4"
  final String url; // direct apk link
  final String size;
  final String portal;

  const UpdateInfo({
    required this.appName,
    required this.version,
    required this.url,
    required this.size,
    required this.portal,
  });
}

class UpdateChecker {
  /// What this build is, as written into the apk.
  static const String currentVersion = String.fromEnvironment('APP_VERSION');

  /// Which entry in the manifest describes this app.
  static const String appKey = String.fromEnvironment('APP_KEY');

  /// Where the manifest lives. Empty on any build that was not made for testing.
  static const String manifestUrl = String.fromEnvironment('UPDATE_MANIFEST_URL');

  static bool get enabled =>
      manifestUrl.isNotEmpty && appKey.isNotEmpty && currentVersion.isNotEmpty;

  /// Build number out of `1.0.0+3`. Returns -1 when there is none, which sorts
  /// below every real build so an unnumbered build never looks newest.
  static int _build(String version) {
    final plus = version.indexOf('+');
    if (plus < 0) return -1;
    return int.tryParse(version.substring(plus + 1).trim()) ?? -1;
  }

  /// The newer build, or null when this is already it — or when anything at all
  /// goes wrong. An update check is a convenience; it must never interrupt the
  /// app, so every failure here is silent by design.
  static Future<UpdateInfo?> check() async {
    if (!enabled) return null;
    try {
      final res = await http
          .get(Uri.parse(manifestUrl))
          .timeout(const Duration(seconds: 6));
      if (res.statusCode != 200) return null;

      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final entry = (body['apps'] as Map<String, dynamic>?)?[appKey];
      if (entry is! Map) return null;

      final latest = (entry['version'] ?? '').toString();
      if (latest.isEmpty || latest == currentVersion) return null;
      // Only ever offer a build that is actually newer — a phone left on a
      // stale manifest should not be told to install backwards.
      if (_build(latest) <= _build(currentVersion)) return null;

      return UpdateInfo(
        appName: (entry['name'] ?? appKey).toString(),
        version: latest,
        url: (entry['url'] ?? '').toString(),
        size: (entry['size'] ?? '').toString(),
        portal: (body['portal'] ?? '').toString(),
      );
    } catch (_) {
      // Off the test network, portal down, manifest half-written — all of these
      // mean "cannot tell", not "there is a problem the tester must see".
      return null;
    }
  }
}

/// Wrap the app's home in this. It checks once, shortly after first paint, and
/// shows a dismissible banner if there is something newer.
///
///   home: UpdateGate(child: MyHomeScreen()),
class UpdateGate extends StatefulWidget {
  final Widget child;
  const UpdateGate({super.key, required this.child});

  @override
  State<UpdateGate> createState() => _UpdateGateState();
}

class _UpdateGateState extends State<UpdateGate> {
  UpdateInfo? _update;
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    if (UpdateChecker.enabled) {
      // After first frame: the tester sees their app, not a spinner over a
      // network call they never asked for.
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        final found = await UpdateChecker.check();
        if (found != null && mounted) setState(() => _update = found);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final update = _update;
    if (update == null || _dismissed) return widget.child;

    return Stack(
      children: [
        widget.child,
        Positioned(
          left: 12,
          right: 12,
          bottom: 12,
          child: SafeArea(
            child: Material(
              elevation: 8,
              borderRadius: BorderRadius.circular(14),
              color: const Color(0xFF181A12),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Update available — ${update.version}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'You are on ${UpdateChecker.currentVersion}'
                            '${update.size.isNotEmpty ? ' · ${update.size}' : ''}',
                            style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => _showHow(context, update),
                      child: const Text('Get it'),
                    ),
                    IconButton(
                      tooltip: 'Dismiss',
                      icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 18),
                      onPressed: () => setState(() => _dismissed = true),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// The address, selectable. No url_launcher: not every app in this repo has
  /// it, and a dependency added for a test-only banner is a poor trade.
  void _showHow(BuildContext context, UpdateInfo update) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${update.appName} ${update.version}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Open this on the phone to install the new build:'),
            const SizedBox(height: 10),
            SelectableText(
              update.portal.isNotEmpty ? update.portal : update.url,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            const Text(
              'You must be on the same Wi-Fi as the build machine.',
              style: TextStyle(fontSize: 12.5),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}
