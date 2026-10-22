import '../models/stowbo_host.dart';
import 'stowbo_api.dart';

/// Discovery (guest) + listing management (host) against the real Stowbo
/// engine (`/client/stowbo/*`).
class HostService {
  final StowboApi _api = stowboApi;

  /// Public browse — active listings.
  Future<List<StowboHost>> browse({String? kind}) async {
    final records = await _api.browse(spaceType: kind);
    return records.map(StowboHost.fromListingRecord).toList();
  }

  Future<StowboHost?> getById(String listingId) async {
    final res = await _api.listingDetail(listingId);
    final listing = res['listing'];
    if (listing is Map) {
      return StowboHost.fromListingRecord(Map<String, dynamic>.from(listing));
    }
    return null;
  }

  /// Free capacity for a window → { capacity, booked, available, sufficient }.
  Future<Map<String, dynamic>> availability(
    String listingId, {
    required DateTime start,
    required DateTime end,
    int quantity = 1,
    List<Map<String, dynamic>>? addOns,
  }) =>
      _api.availability(listingId,
          startDate: start.toUtc().toIso8601String(),
          endDate: end.toUtc().toIso8601String(),
          quantity: quantity,
          addOns: addOns);

  /// The signed-in host's own listings (server-scoped; ownerUserId ignored).
  Future<List<StowboHost>> myListings(String ownerUserId) async {
    final records = await _api.hostListings();
    return records.map(StowboHost.fromListingRecord).toList();
  }

  Future<StowboHost> createListing(StowboHost host) async {
    final res = await _api.createListing(host.toListingBody());
    return StowboHost.fromListingRecord(res.isEmpty
        ? {
            'data': {...host.toListingBody(), 'name': host.name}
          }
        : res);
  }

  /// Apply to become a host (enrols in the stowbo-host benefit).
  Future<void> applyAsHost({Map<String, dynamic>? formData}) =>
      _api.applyAsHost({'agreementAccepted': true, 'formData': formData ?? {}});

  Future<Map<String, dynamic>> hostStatus() => _api.hostMe();

  /// { settled, pending, currency, bookings }
  Future<Map<String, dynamic>> earnings() => _api.earnings();

  /// Physical units for a listing (or all of the host's).
  Future<List<Map<String, dynamic>>> units({String? listing}) =>
      _api.hostUnits(listing: listing);

  Future<void> createUnit({
    required String listing,
    required String unitNumber,
    String? accessCode,
    String? notes,
  }) =>
      _api.createUnit({
        'listing': listing,
        'unitNumber': unitNumber,
        if (accessCode != null) 'accessCode': accessCode,
        if (notes != null) 'notes': notes,
      });

  /// A listing + its bookable children + applicable add-ons.
  Future<Map<String, dynamic>> detail(String listingId) =>
      _api.listingDetail(listingId);
}

final hostService = HostService();
