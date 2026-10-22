import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../config/home_apps.dart';
import '../config/device_presets.dart';
import '../config/restaurant_device_presets.dart';
import '../services/storage_service.dart';

/// Which parts of the app this device shows.
///
/// **Opt-in, not opt-out.** The app covers far more ground than any one
/// operator uses — a restaurant box has no use for event badges, an events box
/// has none for tables — and showing everything at once is what made it hard
/// to read. So a fresh install starts with everything off except comms and
/// phone, and the operator switches on what they actually do. Even comms can
/// be switched off.
///
/// Stored as the set of things that ARE on. The older build stored the
/// opposite (a set of hidden things); [_load] migrates that once so nobody
/// opens the app to find their tools gone.
/// Path prefix for every mobile menu entry, matching the SDK catalogue
/// (`MOBILE_MENU_PREFIX` in sdk/src/types/mobile-app-menu.ts). Paths are
/// `/mobile/<group>/<item>` and the group/item ids mirror [kHomeAppGroups].
const String kMobileMenuPrefix = '/mobile';

class AppVisibilityProvider extends ChangeNotifier {
  static const _enabledGroupsKey = 'home_enabled_groups';
  static const _enabledItemsKey = 'home_enabled_items';
  static const _presetKey = 'home_device_preset';
  // The previous opt-out keys, read once during migration.
  static const _legacyHiddenGroupsKey = 'home_hidden_groups';
  static const _legacyHiddenItemsKey = 'home_hidden_items';
  static const _migratedKey = 'home_visibility_migrated';

  final StorageService _storage;
  AppVisibilityProvider([StorageService? storage])
    : _storage = storage ?? StorageService() {
    ready = _load();
  }

  late final Future<void> ready;
  String _devicePresetId = '';
  String get devicePresetId => _devicePresetId;
  bool get isRestaurantDevice =>
      restaurantDevicePresets.any((p) => p.id == _devicePresetId);

  bool get isEventDevice =>
      eventDevicePresets.any((p) => p.id == _devicePresetId);

  Future<void> applyRestaurantPreset(RestaurantDevicePreset preset) =>
      applyDevicePreset(preset);

  Future<void> applyDevicePreset(DevicePreset preset) async {
    await ready;
    _devicePresetId = preset.id;
    _enabledItems
      ..clear()
      ..addAll(preset.items);
    _enabledGroups
      ..clear()
      ..addAll(
        kHomeAppGroups
            .where((g) => g.items.any((i) => preset.items.contains(i.id)))
            .map((g) => g.id),
      );
    // The server's permissions are still checked when rendering each item.
    notifyListeners();
    await _persist();
  }

  final Set<String> _enabledGroups = {};
  final Set<String> _enabledItems = {};
  bool _loaded = false;

  bool get loaded => _loaded;

  // ── what the role allows, on top of what the device switched on ──────
  //
  // Two different questions: the server answers "may this person see it",
  // this device answers "does this box do it". Both must say yes, and the
  // server never overwrites the local switches — otherwise an operator's
  // setup would be clobbered on every sign-in.
  //
  // Unrestricted until the server says otherwise, so nothing changes for an
  // org that has not configured mobile menu access.
  // The rule, from the role's two lists:
  //
  //   show everything in `menuInclude`,
  //   show everything not named in either list,
  //   hide everything in `menuExclude`.
  //
  // **Absence means allowed** — a role that says nothing about the phone
  // withholds nothing, so an org that never configured this sees no change.
  // `menuInclude` earns its keep as the carve-back when a role excludes
  // `all`: hide everything, then name what comes back.
  Set<String> _menuInclude = const {};
  Set<String> _menuExclude = const {};

  /// True when nothing is being withheld.
  bool get serverUnrestricted => _menuExclude.isEmpty;

  /// Apply the signed-in user's effective menu access, merged onto the user
  /// profile from their roles and groups.
  void setMenuAccess({
    required Set<String> include,
    required Set<String> exclude,
  }) {
    final inc = {for (final p in include) p.trim().toLowerCase()};
    final exc = {for (final p in exclude) p.trim().toLowerCase()};
    // Called from a ProxyProvider update, which runs during build — notifying
    // unconditionally there throws. Only speak up when something changed.
    final same =
        inc.length == _menuInclude.length &&
        inc.containsAll(_menuInclude) &&
        exc.length == _menuExclude.length &&
        exc.containsAll(_menuExclude);
    if (same) return;
    _menuInclude = inc;
    _menuExclude = exc;
    WidgetsBinding.instance.addPostFrameCallback((_) => notifyListeners());
  }

  /// Kept for callers that think in terms of an allow-list.
  void setServerGrant({
    required bool unrestricted,
    required Set<String> allowedPaths,
  }) => setMenuAccess(
    include: allowedPaths,
    exclude: unrestricted ? const {} : const {'all'},
  );

  /// Read the signed-in user's effective menu access straight off the sign-in
  /// payload. The permissions ride on the user profile, so they arrive with
  /// the sign-in response — there is nothing extra to fetch.
  ///
  /// The server sends `permissions.menu` keyed by role name:
  ///
  /// ```json
  /// { "Owner":       {"menuInclude": [], "menuExclude": [], "default": "all"},
  ///   "ContentAdmin":{"menuInclude": [], "menuExclude": [], "default": "manager"} }
  /// ```
  ///
  /// A person holds several roles at once, so the roles are unioned — the most
  /// generous one wins, which is how role grants work everywhere else. Each
  /// role gives its `default` tier (every item at or below it), plus anything
  /// its `menuInclude` names; `menuExclude` only withholds within that role.
  /// A role with `default: all` settles it: nothing is withheld.
  void applyUserProfile(Map<String, dynamic>? userJson) {
    final data = userJson?['data'];
    final perms = (data is Map ? data['permissions'] : null);
    if (perms is! Map) {
      setMenuAccess(include: const {}, exclude: const {});
      return;
    }

    final menu = perms['menu'];
    if (menu is! Map || menu.isEmpty) {
      // Nothing said about menus. Older servers put the lists flat on
      // `permissions`; honour that shape too rather than ignoring it.
      setMenuAccess(
        include: _mobileOnly(_readList(perms['menuInclude'])),
        exclude: _mobileOnly(_readList(perms['menuExclude'])),
      );
      return;
    }

    final granted = <String>{};
    var unrestricted = false;

    for (final entry in menu.entries) {
      final v = entry.value;
      if (v is! Map) continue;
      final tier = (v['default'] ?? '').toString().toLowerCase();
      if (tier == 'all') {
        unrestricted = true;
        break;
      }
      final include = _mobileOnly(_readList(v['menuInclude']));
      final exclude = _mobileOnly(_readList(v['menuExclude']));
      // What the tier gives this role, then its own carve-outs.
      final fromTier = <String>{
        for (final g in kHomeAppGroups)
          for (final i in g.items)
            if (_tierCovers(tier, i.access))
              '$kMobileMenuPrefix/${g.id}/${i.id}',
      };
      granted.addAll(
        {
          ...fromTier,
          ...include,
        }.where((path) => !exclude.contains(path)).toSet(),
      );
    }

    if (unrestricted) {
      setMenuAccess(include: const {}, exclude: const {});
      return;
    }
    // Union of what every role allows. Exclude `all` so anything not granted
    // by some role is withheld; the granted set carves it back.
    setMenuAccess(include: granted, exclude: const {'all'});
  }

  static List<String> _readList(dynamic raw) {
    final list = raw is List
        ? raw.map((e) => e.toString())
        : raw is String
        ? raw.split(',')
        : const <String>[];
    return [
      for (final p in list)
        if (p.trim().isNotEmpty) p.trim().toLowerCase(),
    ];
  }

  static Set<String> _mobileOnly(List<String> v) => {
    for (final p in v)
      if (p == 'all' || p.startsWith(kMobileMenuPrefix)) p,
  };

  /// Tiers widen everyone → maker → manager → admin. A role at [roleTier]
  /// gets every item at or below it. `none` gets nothing.
  static bool _tierCovers(String roleTier, String itemTier) {
    const order = ['everyone', 'maker', 'manager', 'admin'];
    if (roleTier == 'none') return false;
    if (roleTier == 'all') return true;
    final r = order.indexOf(roleTier);
    final i = order.indexOf(itemTier);
    if (r < 0 || i < 0) return false;
    return r >= i;
  }

  /// Whether the role permits this item. [itemId] may be empty to ask about
  /// the group alone. Also used for parts with no local switch — the bottom
  /// tabs (`nav`) and the More sections (`more`) — which is why this takes
  /// plain strings rather than reading [kHomeAppGroups].
  bool serverAllows(String groupId, [String itemId = '']) {
    if (_menuInclude.isEmpty && _menuExclude.isEmpty) return true;
    final g = '$kMobileMenuPrefix/${groupId.toLowerCase()}';
    final full = itemId.isEmpty ? g : '$g/${itemId.toLowerCase()}';
    bool named(Set<String> set) =>
        set.contains('all') || set.contains(full) || set.contains(g);
    // Named in include wins, even over a broader exclude. Otherwise shown
    // unless something excludes it.
    if (named(_menuInclude)) return true;
    return !named(_menuExclude);
  }

  bool isGroupVisible(String groupId) =>
      _enabledGroups.contains(groupId) &&
      (serverAllows(groupId) ||
          kHomeAppGroups.any(
            (g) =>
                g.id == groupId &&
                g.items.any(
                  (i) =>
                      _enabledItems.contains(i.id) &&
                      serverAllows(groupId, i.id),
                ),
          ));

  bool isItemVisible(String itemId) {
    if (!_enabledItems.contains(itemId)) return false;
    final groupId = _groupIdOf(itemId);
    return groupId == null
        ? serverAllows('', itemId)
        : serverAllows(groupId, itemId);
  }

  /// Which section an app belongs to, for the server-grant path.
  static String? _groupIdOf(String itemId) {
    for (final g in kHomeAppGroups) {
      if (g.items.any((i) => i.id == itemId)) return g.id;
    }
    return null;
  }

  /// True when the role forbids it outright — the settings screen shows these
  /// disabled with a reason rather than as a switch that does nothing.
  bool serverDeniesItem(String itemId) {
    final groupId = _groupIdOf(itemId);
    return !(groupId == null
        ? serverAllows('', itemId)
        : serverAllows(groupId, itemId));
  }

  /// What a brand-new install starts with: whatever the catalogue marks
  /// `defaultOn`. Today that is comms and phone, nothing else.
  static Set<String> get _defaultGroups => {
    for (final g in kHomeAppGroups)
      if (g.defaultOn) g.id,
  };
  static Set<String> get _defaultItems => {
    for (final g in kHomeAppGroups)
      for (final i in g.items)
        if (i.defaultOn) i.id,
  };

  Future<void> _load() async {
    try {
      await _storage.initialize(); // idempotent — SharedPreferences is cached
      final prefs = _storage.prefs;

      _devicePresetId = prefs.getString(_presetKey) ?? '';

      final storedGroups = prefs.getStringList(_enabledGroupsKey);
      final storedItems = prefs.getStringList(_enabledItemsKey);

      if (storedGroups != null || storedItems != null) {
        _enabledGroups
          ..clear()
          ..addAll(storedGroups ?? const []);
        _enabledItems
          ..clear()
          ..addAll(storedItems ?? const []);
      } else if (!(prefs.getBool(_migratedKey) ?? false) &&
          (prefs.getStringList(_legacyHiddenGroupsKey) != null ||
              prefs.getStringList(_legacyHiddenItemsKey) != null)) {
        // Someone was already using the old hide-what-you-don't-want screen.
        // Keep exactly what they had on: everything minus what they hid.
        final hiddenGroups =
            (prefs.getStringList(_legacyHiddenGroupsKey) ?? const []).toSet();
        final hiddenItems =
            (prefs.getStringList(_legacyHiddenItemsKey) ?? const []).toSet();
        for (final g in kHomeAppGroups) {
          if (!hiddenGroups.contains(g.id)) _enabledGroups.add(g.id);
          for (final i in g.items) {
            if (!hiddenItems.contains(i.id)) _enabledItems.add(i.id);
          }
        }
        await prefs.setBool(_migratedKey, true);
        await _persist();
      } else {
        // Fresh install: comms and phone only.
        _enabledGroups
          ..clear()
          ..addAll(_defaultGroups);
        _enabledItems
          ..clear()
          ..addAll(_defaultItems);
        await _persist();
      }
      _loaded = true;
      notifyListeners();
    } catch (e) {
      // Fall back to the defaults rather than an empty app.
      _enabledGroups.addAll(_defaultGroups);
      _enabledItems.addAll(_defaultItems);
      _loaded = true;
      notifyListeners();
      if (kDebugMode) print('Failed to load app visibility: $e');
    }
  }

  Future<void> _persist() async {
    try {
      await _storage.initialize();
      final prefs = _storage.prefs;
      await prefs.setStringList(_enabledGroupsKey, _enabledGroups.toList());
      await prefs.setStringList(_enabledItemsKey, _enabledItems.toList());
      await prefs.setString(_presetKey, _devicePresetId);
    } catch (e) {
      if (kDebugMode) print('Failed to persist app visibility: $e');
    }
  }

  /// Switching a group on brings its apps with it — nobody wants to enable a
  /// section and still find it empty.
  Future<void> setGroupVisible(String groupId, bool visible) async {
    final group = kHomeAppGroups.where((g) => g.id == groupId);
    if (visible) {
      _enabledGroups.add(groupId);
      for (final g in group) {
        _enabledItems.addAll(g.items.map((i) => i.id));
      }
    } else {
      _enabledGroups.remove(groupId);
    }
    notifyListeners();
    await _persist();
  }

  Future<void> setItemVisible(String itemId, bool visible) async {
    if (visible) {
      _enabledItems.add(itemId);
      // Turning on an app inside a section that is off would do nothing
      // visible, which reads as a broken switch.
      for (final g in kHomeAppGroups) {
        if (g.items.any((i) => i.id == itemId)) _enabledGroups.add(g.id);
      }
    } else {
      _enabledItems.remove(itemId);
    }
    notifyListeners();
    await _persist();
  }

  /// Back to a fresh install: comms and phone on, everything else off.
  Future<void> resetAll() async {
    _devicePresetId = '';
    _enabledGroups
      ..clear()
      ..addAll(_defaultGroups);
    _enabledItems
      ..clear()
      ..addAll(_defaultItems);
    notifyListeners();
    await _persist();
  }

  /// Switch everything on, for someone who does want the whole app.
  Future<void> enableAll() async {
    _devicePresetId = '';
    for (final g in kHomeAppGroups) {
      _enabledGroups.add(g.id);
      _enabledItems.addAll(g.items.map((i) => i.id));
    }
    notifyListeners();
    await _persist();
  }

  /// Groups with at least one visible item, each carrying only its visible
  /// items — ready for the dashboard to render. The comms group gates the
  /// More menu and phone button rather than the home grid, so it is not
  /// returned here.
  /// The manager's layout puts the team tools on Home, not only under More.
  bool get isManagerDevice => _devicePresetId == 'crm_team_manager';

  List<HomeAppGroup> visibleGroups() {
    final out = <HomeAppGroup>[];
    for (final g in kHomeAppGroups) {
      if (g.id == 'comms' || (g.id == 'team' && !isManagerDevice)) continue;
      if (!isGroupVisible(g.id)) continue;
      final items = g.items.where((i) => isItemVisible(i.id)).toList();
      if (items.isEmpty) continue;
      out.add(HomeAppGroup(g.id, g.title, items));
    }
    // The manager's own tools first.
    if (isManagerDevice) {
      final team = out.where((g) => g.id == 'team').toList();
      out.removeWhere((g) => g.id == 'team');
      out.insertAll(0, team);
    }
    return out;
  }
}
