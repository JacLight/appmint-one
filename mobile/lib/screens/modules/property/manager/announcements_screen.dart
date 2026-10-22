import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/property_provider.dart';
import '../../../../services/property_api.dart';
import '../../shared/module_states.dart';
import '../property_widgets.dart';

/// Tell the building something.
///
/// Water off on Tuesday, lift engineer on Thursday, bins moved. The read side
/// is live — these are the same `site_notice` records residents acknowledge —
/// and posting goes through the host endpoint the spec defines.
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final p = context.read<PropertyProvider>();
      if (p.announcements.isEmpty && !p.announcementsLoading) {
        p.loadAnnouncements();
      }
      // The buildings are what the audience picker offers.
      if (p.buildings.isEmpty && !p.loading) p.loadPortfolio();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PropertyProvider>();
    final brand = CurrentSetup.brand;

    return Scaffold(
      backgroundColor: SColors.paper,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: brand.primary,
        foregroundColor: Colors.white,
        onPressed: () => _compose(context),
        icon: const Icon(Icons.campaign_rounded),
        label: const Text('Announce',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: p.loadAnnouncements,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl * 2),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Text(
                'Announcements',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                ),
              ),
            ),
            if (p.announcementsError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: p.announcementsError!,
                    onRetry: p.loadAnnouncements),
              )
            else if (p.announcementsLoading && p.announcements.isEmpty)
              const ModuleLoading()
            else if (p.announcements.isEmpty)
              const Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.campaign_rounded,
                  title: 'Nothing posted',
                  body:
                      'Post a notice and every resident sees it, with a tap to '
                      'confirm they read it.',
                ),
              )
            else ...[
              SectionHead(title: 'Posted · ${p.announcements.length}'),
              for (final n in p.announcements)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.md),
                  child: _PostedRow(notice: n),
                ),
            ],
          ],
        ),
      ),
    );
  }

  void _compose(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (_) => const _ComposeSheet(),
    );
  }
}

class _PostedRow extends StatelessWidget {
  final Map<String, dynamic> notice;
  const _PostedRow({required this.notice});

  @override
  Widget build(BuildContext context) {
    final title = '${notice['title'] ?? 'Notice'}';
    final category = '${notice['category'] ?? 'info'}';
    final status = '${notice['status'] ?? ''}';
    final stats = notice['stats'];
    final seen = stats is Map ? stats['displays'] ?? stats['views'] : null;
    final accepted = stats is Map ? stats['accepts'] : null;

    return Container(
      padding: const EdgeInsets.all(SSpace.md),
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: SColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 2,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: SColors.ink,
                        height: 1.25)),
                const SizedBox(height: 3),
                Text(
                  [
                    category,
                    if (status.isNotEmpty) status,
                    // Read counts are the point of a noticeboard; only shown
                    // when the server actually reports them.
                    if (seen != null) '$seen seen',
                    if (accepted != null) '$accepted confirmed',
                  ].join(' · '),
                  style: const TextStyle(color: SColors.muted, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ComposeSheet extends StatefulWidget {
  const _ComposeSheet();

  @override
  State<_ComposeSheet> createState() => _ComposeSheetState();
}

class _ComposeSheetState extends State<_ComposeSheet> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  String _category = 'announcement';
  String _audience = '';
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await propertyApi.announce({
        'title': _title.text.trim(),
        'bodyText': _body.text.trim(),
        'category': _category,
        'displayType': 'banner',
        'status': 'active',
        // Empty = the whole portfolio. A notice sent to everyone when it was
        // meant for one building is worse than one nobody reads.
        if (_audience.isNotEmpty) 'listing': _audience,
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      context.read<PropertyProvider>().loadAnnouncements();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: SColors.green, content: Text('Notice posted.')));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = '$e'.replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final buildings = context.watch<PropertyProvider>().buildings;
    final valid = _title.text.trim().length > 3 && _body.text.trim().length > 8;

    return Padding(
      padding: EdgeInsets.only(
        left: SSpace.lg,
        right: SSpace.lg,
        top: SSpace.lg,
        bottom: MediaQuery.of(context).viewInsets.bottom + SSpace.lg,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('New notice',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                )),
            const SizedBox(height: SSpace.lg),
            TextField(
              controller: _title,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600, color: SColors.ink),
              decoration: _dec('Headline — "Water off Tuesday 9–2"'),
            ),
            const SizedBox(height: SSpace.md),
            TextField(
              controller: _body,
              maxLines: 4,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(fontSize: 14, color: SColors.ink),
              decoration: _dec('What is happening, when, and what to do'),
            ),
            const SizedBox(height: SSpace.lg),
            const Text('Kind',
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink)),
            const SizedBox(height: SSpace.sm),
            Wrap(
              spacing: SSpace.sm,
              children: [
                for (final c in const ['announcement', 'alert', 'reminder', 'info'])
                  GestureDetector(
                    onTap: () => setState(() => _category = c),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.md, vertical: SSpace.sm),
                      decoration: BoxDecoration(
                        color: _category == c ? brand.primary : SColors.paper2,
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                      child: Text(c,
                          style: TextStyle(
                              color: _category == c
                                  ? Colors.white
                                  : SColors.ink2,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
              ],
            ),
            if (buildings.isNotEmpty) ...[
              const SizedBox(height: SSpace.lg),
              Text('Who sees it',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink)),
              const SizedBox(height: SSpace.sm),
              Wrap(
                spacing: SSpace.sm,
                runSpacing: SSpace.sm,
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _audience = ''),
                    child: _chip('Everyone', _audience.isEmpty, brand.primary),
                  ),
                  for (final b in buildings)
                    GestureDetector(
                      onTap: () =>
                          setState(() => _audience = '${b['name'] ?? ''}'),
                      child: _chip(
                        '${b['title'] ?? b['name']}',
                        _audience == '${b['name'] ?? ''}',
                        brand.primary,
                      ),
                    ),
                ],
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: SSpace.lg),
              ModuleError(message: _error!),
            ],
            const SizedBox(height: SSpace.xl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: brand.primary,
                  disabledBackgroundColor: SColors.line,
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md + 4),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill)),
                ),
                onPressed: _sending || !valid ? null : _post,
                child: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Text(
                        _audience.isEmpty
                            ? 'Post to everyone'
                            : 'Post to this ${words.lower(LexiconKeys.property)}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _chip(String label, bool selected, Color colour) => Container(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.md, vertical: SSpace.sm),
        decoration: BoxDecoration(
          color: selected ? colour : SColors.paper2,
          borderRadius: BorderRadius.circular(SRadius.pill),
        ),
        child: Text(label,
            style: TextStyle(
                color: selected ? Colors.white : SColors.ink2,
                fontSize: 12,
                fontWeight: FontWeight.w700)),
      );

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: SColors.faint, fontSize: 13.5),
        filled: true,
        fillColor: SColors.paper,
        contentPadding: const EdgeInsets.all(SSpace.md),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide: const BorderSide(color: SColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SRadius.md),
          borderSide:
              BorderSide(color: CurrentSetup.brand.primary, width: 1.4),
        ),
      );
}
