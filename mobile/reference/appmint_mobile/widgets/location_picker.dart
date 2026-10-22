import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/haho_theme.dart';
import '../providers/location_provider.dart';
import '../providers/auth_provider.dart';
import '../utils/business_location_access.dart';
import '../screens/settings/business_location_settings_screen.dart';

class LocationPicker extends StatelessWidget {
  final double maxWidth;
  final bool allowAllLocations;
  const LocationPicker({
    super.key,
    this.maxWidth = 180,
    this.allowAllLocations = true,
  });

  String _nameOf(Map<String, dynamic> loc) {
    final data = loc['data'];
    final title = data is Map ? data['title'] : loc['title'];
    if (title is String && title.trim().isNotEmpty) return title;
    if (data is Map &&
        data['name'] is String &&
        (data['name'] as String).isNotEmpty) {
      return data['name'] as String;
    }
    final name = loc['name'];
    if (name is String && name.isNotEmpty) return name;
    return (loc['sk'] ?? '').toString();
  }

  void _open(BuildContext context, LocationProvider provider) {
    // Auto-refresh the list as the sheet opens — covers the common case
    // where the operator added / renamed a venue in admin and now wants
    // it to show up here.
    provider.load();
    final canAssign = canManageBusinessLocation(
      context.read<AuthProvider>().rawUser,
    );
    showModalBottomSheet(
      context: context,
      backgroundColor: HaHoColors.cardLight,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(HaHoRadius.xxl),
        ),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          // Consumer so the sheet re-renders when `provider.load()`
          // completes — otherwise the user sees the stale list with no
          // way to tell a refresh happened.
          child: Consumer<LocationProvider>(
            builder: (_, p, __) => Padding(
              padding: const EdgeInsets.symmetric(vertical: HaHoSpacing.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: HaHoSpacing.md),
                    decoration: BoxDecoration(
                      color: HaHoColors.border,
                      borderRadius: BorderRadius.circular(HaHoRadius.sm),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: HaHoSpacing.xl,
                    ),
                    child: Row(
                      children: [
                        Text(
                          allowAllLocations ? 'Locations' : 'Device location',
                          style: HaHoTextStyles.h3,
                        ),
                        const Spacer(),
                        if (p.loading)
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.refresh, size: 20),
                            tooltip: 'Refresh',
                            onPressed: p.load,
                          ),
                      ],
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.settings_outlined),
                    title: const Text('Business location settings'),
                    subtitle: const Text('Address and card terminal'),
                    onTap: () {
                      Navigator.pop(sheetCtx);
                      Navigator.push(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              const BusinessLocationSettingsScreen(),
                        ),
                      );
                    },
                  ),
                  if (!canAssign)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'Your role cannot change this device’s business location.',
                      ),
                    ),
                  const SizedBox(height: HaHoSpacing.sm),
                  Flexible(
                    child: RefreshIndicator(
                      onRefresh: p.load,
                      child: p.locations.isEmpty && !p.loading
                          ? ListView(
                              shrinkWrap: true,
                              padding: const EdgeInsets.all(HaHoSpacing.xl),
                              children: [
                                const Icon(
                                  Icons.place_outlined,
                                  size: 48,
                                  color: HaHoColors.textGray,
                                ),
                                const SizedBox(height: HaHoSpacing.md),
                                Text(
                                  'No locations.',
                                  style: HaHoTextStyles.body.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: HaHoSpacing.xs),
                                Text(
                                  'Pull down or tap refresh to try again.',
                                  style: HaHoTextStyles.caption.copyWith(
                                    color: HaHoColors.textGray,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            )
                          : ListView(
                              shrinkWrap: true,
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                if (allowAllLocations && canAssign)
                                  _OptionTile(
                                    label: 'All locations',
                                    selected: p.selectedId.isEmpty,
                                    onTap: () {
                                      p.select('');
                                      Navigator.pop(sheetCtx);
                                    },
                                  ),
                                if (allowAllLocations) const Divider(height: 1),
                                for (final loc in p.locations)
                                  _OptionTile(
                                    label: _nameOf(loc),
                                    selected:
                                        (loc['sk'] ?? '').toString() ==
                                        p.selectedId,
                                    onTap: !canAssign
                                        ? null
                                        : () async {
                                            await p.select(
                                              (loc['sk'] ?? '').toString(),
                                            );
                                            if (sheetCtx.mounted)
                                              Navigator.pop(sheetCtx);
                                          },
                                  ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<LocationProvider>(
      builder: (context, provider, _) {
        final selected = provider.selectedLocation;
        final label = selected == null ? 'All locations' : _nameOf(selected);
        return Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: HaHoSpacing.sm,
            vertical: HaHoSpacing.xs,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Material(
              color: HaHoColors.cardLight,
              borderRadius: BorderRadius.circular(HaHoRadius.pill),
              child: InkWell(
                borderRadius: BorderRadius.circular(HaHoRadius.pill),
                onTap: () => _open(context, provider),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: HaHoSpacing.md,
                    vertical: HaHoSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: HaHoColors.border),
                    borderRadius: BorderRadius.circular(HaHoRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.place_outlined,
                        size: 16,
                        color: HaHoColors.textGray,
                      ),
                      const SizedBox(width: HaHoSpacing.xs),
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: HaHoTextStyles.bodySmall.copyWith(
                            color: HaHoColors.textDark,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: HaHoSpacing.xs),
                      const Icon(
                        Icons.keyboard_arrow_down,
                        size: 18,
                        color: HaHoColors.textGray,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The assigned venue stays visible with the screen name. Only the cog opens
/// location configuration; normal service navigation keeps the saved selection.
class LocationAppBarTitle extends StatelessWidget {
  final String title;
  const LocationAppBarTitle({super.key, required this.title});

  @override
  Widget build(BuildContext context) => Consumer<LocationProvider>(
    builder: (context, provider, _) {
      const picker = LocationPicker(allowAllLocations: false);
      final selected = provider.selectedLocation;
      final label = selected == null
          ? (provider.loading ? 'Loading location…' : 'Set device location')
          : picker._nameOf(selected);
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 20,
              height: 1.1,
              fontWeight: FontWeight.w600,
              color: Color(0xFF192C36),
            ),
          ),
          Row(
            children: [
              SizedBox(
                width: 28,
                height: 28,
                child: IconButton(
                  tooltip: 'Configure device location',
                  onPressed: () => picker._open(context, provider),
                  style: IconButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(
                    Icons.settings_outlined,
                    size: 15,
                    color: Color(0xFF62737B),
                  ),
                ),
              ),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF62737B),
                  ),
                ),
              ),
            ],
          ),
        ],
      );
    },
  );
}

class _OptionTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _OptionTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      title: Text(
        label,
        style: HaHoTextStyles.body.copyWith(
          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
          color: selected ? HaHoColors.primary : HaHoColors.textDark,
        ),
      ),
      trailing: selected
          ? const Icon(Icons.check, color: HaHoColors.primary, size: 20)
          : null,
    );
  }
}
