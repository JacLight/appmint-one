import 'package:geolocator/geolocator.dart';

import '../config/setup.dart';

/// Why the device location could not be used. The UI shows the exact reason
/// (never a silent no-op) so the guest knows whether to turn on GPS, grant the
/// permission, or open Settings.
enum LocationFailure {
  serviceDisabled, // location services off at the OS level
  denied, // permission denied this time
  deniedForever, // permission permanently denied — must open Settings
  error, // lookup threw / timed out
}

class LocationResult {
  final Position? position;
  final LocationFailure? failure;
  const LocationResult._(this.position, this.failure);

  factory LocationResult.ok(Position p) => LocationResult._(p, null);
  factory LocationResult.fail(LocationFailure f) => LocationResult._(null, f);

  bool get ok => position != null;
  double? get lat => position?.latitude;
  double? get lng => position?.longitude;
}

/// Device GPS with explicit permission handling. Never throws to the caller —
/// returns a [LocationResult] carrying either a position or a typed failure.
class LocationService {
  Position? _last;
  Position? get last => _last;

  Future<LocationResult> current() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return LocationResult.fail(LocationFailure.serviceDisabled);
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied) {
        return LocationResult.fail(LocationFailure.denied);
      }
      if (perm == LocationPermission.deniedForever) {
        return LocationResult.fail(LocationFailure.deniedForever);
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      _last = pos;
      return LocationResult.ok(pos);
    } catch (_) {
      // Fall back to a last known fix if we ever got one.
      try {
        final known = await Geolocator.getLastKnownPosition();
        if (known != null) {
          _last = known;
          return LocationResult.ok(known);
        }
      } catch (_) {}
      return LocationResult.fail(LocationFailure.error);
    }
  }

  /// Straight-line distance in metres between two points.
  static double metresBetween(
          double lat1, double lng1, double lat2, double lng2) =>
      Geolocator.distanceBetween(lat1, lng1, lat2, lng2);

  /// Shared across every setup, so no brand or trade word is baked in here.
  /// [purpose] completes the sentence when the caller has one worth saying
  /// ("to see spaces near you", "to go online").
  static String label(LocationFailure f, {String? purpose}) {
    final why = (purpose == null || purpose.isEmpty) ? 'to continue' : purpose;
    switch (f) {
      case LocationFailure.serviceDisabled:
        return 'Location is turned off. Turn it on $why.';
      case LocationFailure.denied:
        return 'Location permission is needed $why.';
      case LocationFailure.deniedForever:
        final brand = CurrentSetup.brand.name;
        return brand.isEmpty
            ? 'Location is blocked. Enable it for this app in Settings.'
            : 'Location is blocked. Enable it for $brand in Settings.';
      case LocationFailure.error:
        return "Couldn't get your location. Try again.";
    }
  }
}

final locationService = LocationService();
