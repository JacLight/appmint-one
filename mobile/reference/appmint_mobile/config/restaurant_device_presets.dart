import 'device_presets.dart';

// Keep existing callers and saved restaurant layout IDs compatible.
typedef RestaurantDevicePreset = DevicePreset;

const restaurantDevicePresets = [
  RestaurantDevicePreset(
    'restaurant_all',
    'Restaurant — all tools',
    'Reservations, seating, orders, prep tickets and payments.',
    {
      'reservations',
      'checkin',
      'floor',
      'pos',
      'tabs',
      'kitchen',
      'take_payment',
      'devices',
    },
  ),
  RestaurantDevicePreset(
    'restaurant_front_desk',
    'Front desk',
    'Book guests, manage arrivals, seat parties and open table tabs.',
    {'reservations', 'checkin', 'floor', 'tabs', 'phone'},
  ),
  RestaurantDevicePreset(
    'restaurant_server',
    'Server handheld',
    'Open a table, take orders, send items to prep and settle the bill.',
    {'floor', 'pos', 'tabs', 'devices'},
  ),
  RestaurantDevicePreset(
    'restaurant_kitchen',
    'Prep display',
    'Track orders through your configured prep stations and production steps.',
    {'kitchen'},
  ),
  RestaurantDevicePreset(
    'restaurant_cashier',
    'Cashier',
    'Find open tabs and collect payment against the guest’s bill.',
    {'tabs', 'pos', 'take_payment', 'devices'},
  ),
];
