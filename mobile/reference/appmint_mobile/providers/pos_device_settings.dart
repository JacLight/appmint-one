import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Device presentation controls. These never grant payment permissions.
class PosDeviceSettings extends ChangeNotifier {
  static const paymentMethods = <String, String>{
    'cash': 'Cash',
    'taptopay': 'Tap to Pay',
    'm2': 'Card terminal (M2)',
    'card': 'Online card',
    'bank': 'Bank transfer',
    'other': 'Other',
  };
  static const _prepKey = 'pos_device_show_prep';
  static const _methodsKey = 'pos_device_payment_methods';
  static const _labelPrefix = 'pos_device_payment_label_';
  final Map<String, String> _labels = {};
  late final Future<void> ready;
  bool loaded = false;
  bool showPrep = true;
  Set<String> _enabled = paymentMethods.keys.toSet();

  PosDeviceSettings() {
    ready = _load();
  }
  bool allows(String method) => loaded && _enabled.contains(method);
  List<String> get enabledMethods =>
      paymentMethods.keys.where(_enabled.contains).toList();
  String displayName(String method) =>
      _labels[method] ??
      (method == 'm2' ? 'Card' : paymentMethods[method] ?? method);

  Future<void> setDisplayName(String method, String name) async {
    await ready;
    if (!paymentMethods.containsKey(method))
      throw ArgumentError('Unknown payment method');
    final label = name.trim();
    if (label.length > 40) throw ArgumentError('Use up to 40 characters');
    final prefs = await SharedPreferences.getInstance();
    final saved = label.isEmpty
        ? await prefs.remove('$_labelPrefix$method')
        : await prefs.setString('$_labelPrefix$method', label);
    if (!saved) throw StateError('Could not save payment name.');
    if (label.isEmpty) {
      _labels.remove(method);
    } else {
      _labels[method] = label;
    }
    notifyListeners();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    for (final method in paymentMethods.keys) {
      final label = prefs.getString('$_labelPrefix$method')?.trim();
      if (label != null && label.isNotEmpty) _labels[method] = label;
    }
    showPrep = prefs.getBool(_prepKey) ?? true;
    final stored = prefs.getStringList(_methodsKey);
    if (stored != null) {
      _enabled = stored.where(paymentMethods.containsKey).toSet();
      if (_enabled.isEmpty) _enabled = paymentMethods.keys.toSet();
    }
    loaded = true;
    notifyListeners();
  }

  Future<void> setShowPrep(bool value) async {
    await ready;
    final prefs = await SharedPreferences.getInstance();
    if (!await prefs.setBool(_prepKey, value))
      throw StateError('Could not save POS settings.');
    showPrep = value;
    notifyListeners();
  }

  Future<bool> setPaymentMethod(String method, bool enabled) async {
    await ready;
    if (!paymentMethods.containsKey(method)) return false;
    final next = {..._enabled};
    if (enabled) {
      next.add(method);
    } else {
      next.remove(method);
    }
    if (next.isEmpty) return false;
    final prefs = await SharedPreferences.getInstance();
    if (!await prefs.setStringList(_methodsKey, next.toList()))
      throw StateError('Could not save payment methods.');
    _enabled = next;
    notifyListeners();
    return true;
  }
}
