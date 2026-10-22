import 'package:flutter/material.dart';

import '../../../config/stowbo_theme.dart';

/// Server job statuses, rendered for people.
///
/// The vocabulary is the server's, from
/// `appengine/src/logistics/delivery.service.ts`. The customer and the driver
/// get different words for the same state: a customer cares that their parcel
/// is on its way, a driver cares which step they are on.
abstract final class JobStatus {
  static const pending = 'pending';
  static const assigned = 'assigned';
  static const accepted = 'accepted';
  static const arrivedPickup = 'arrived_pickup';
  static const pickedUp = 'picked_up';
  static const arrivedDropoff = 'arrived_dropoff';
  static const delivered = 'delivered';
  static const completed = 'completed';
  static const cancelled = 'cancelled';
  static const failed = 'failed';
  static const rejected = 'rejected';

  static String of(Map<String, dynamic> job) =>
      '${job['status'] ?? ''}'.toLowerCase().trim();

  /// What the customer sees.
  static String forCustomer(String status) => switch (status) {
        pending => 'Finding a driver',
        assigned || accepted => 'Driver on the way to pickup',
        arrivedPickup => 'Driver at pickup',
        pickedUp => 'On the way to you',
        arrivedDropoff => 'Driver has arrived',
        delivered || completed => 'Delivered',
        cancelled => 'Cancelled',
        failed => "Couldn't be completed",
        rejected => 'Declined',
        _ => 'In progress',
      };

  /// What the driver sees.
  static String forDriver(String status) => switch (status) {
        pending => 'Offered to you',
        assigned => 'Assigned to you',
        accepted => 'Accepted',
        arrivedPickup => 'At pickup',
        pickedUp => 'Picked up',
        arrivedDropoff => 'At drop-off',
        delivered => 'Delivered',
        completed => 'Completed',
        cancelled => 'Cancelled',
        failed => 'Failed',
        rejected => 'Declined',
        _ => 'In progress',
      };

  static bool isFinished(String status) =>
      status == completed ||
      status == cancelled ||
      status == failed ||
      status == rejected;

  static Color colour(String status) => switch (status) {
        completed || delivered => SColors.green,
        cancelled || failed || rejected => SColors.danger,
        pending => SColors.amber,
        _ => SColors.clay,
      };
}
