import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../config/stowbo_theme.dart';
import '../../services/file_service.dart';
import '../../services/stowbo_api.dart';

/// A scanned pickup code → what the server says must be checked → hand over.
///
/// Works for both the owner's own code and a hand-off (delegated pickup). The
/// SERVER decides what is allowed and what must be verified; this sheet shows
/// that checklist, collects the host's confirmations and the handover photo,
/// and sends them back. Returns true when something was handed over.
Future<bool> showHandoverSheet(BuildContext context, StowboApi api, String code) async {
  Map<String, dynamic> r;
  try {
    r = await api.hostHandover(code);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: SColors.danger));
    }
    return false;
  }
  if (!context.mounted) return false;
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _HandoverSheet(api: api, code: code, resolved: r),
  );
  return done == true;
}

class _HandoverSheet extends StatefulWidget {
  final StowboApi api;
  final String code;
  final Map<String, dynamic> resolved;
  const _HandoverSheet({required this.api, required this.code, required this.resolved});
  @override
  State<_HandoverSheet> createState() => _HandoverSheetState();
}

class _HandoverSheetState extends State<_HandoverSheet> {
  late final Map<String, dynamic> r = widget.resolved;
  late final bool delegate = r['kind'] == 'delegate';
  late final List<String> needs = (r['verify'] is List) ? (r['verify'] as List).map((e) => e.toString()).toList() : const ['qr'];
  late final List<Map<String, dynamic>> items =
      (r['items'] is List) ? (r['items'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
  late Set<String> picked = items.map((i) => i['id'].toString()).toSet();
  final Set<String> ticked = {'qr'}; // the QR is what got us here
  final List<Map<String, dynamic>> photos = [];
  final _note = TextEditingController();
  bool busy = false;
  String? error;

  Map<String, dynamic> get collector => r['collector'] is Map ? Map<String, dynamic>.from(r['collector']) : {};
  bool get allowed => r['allowed'] == true;
  bool get photoRequired => r['photoRequired'] == true;
  bool get ready => allowed && picked.isNotEmpty && needs.every(ticked.contains) && (!photoRequired || photos.isNotEmpty);

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    final shot = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 82) ??
        await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 82);
    if (shot == null) return;
    setState(() => busy = true);
    try {
      final bytes = await shot.readAsBytes();
      final url = await fileService.upload(bytes, shot.name.isNotEmpty ? shot.name : 'handover.jpg', location: 'stowbo/handover');
      if (url != null && url.isNotEmpty) {
        setState(() => photos.add({'url': url, 'name': shot.name, 'mimeType': shot.mimeType ?? 'image/jpeg'}));
      }
    } catch (e) {
      setState(() => error = 'Photo upload failed — ${e.toString().replaceFirst('Exception: ', '')}');
    }
    if (mounted) setState(() => busy = false);
  }

  Future<void> _handOver() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final res = await widget.api.hostCompleteHandover({
        'code': widget.code,
        'items': picked.toList(),
        'verified': ticked.toList(),
        if (photos.isNotEmpty) 'photos': photos,
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
        if (delegate && (collector['name'] ?? '').toString().isNotEmpty) 'collectorName': collector['name'],
      });
      if (!mounted) return;
      final n = (res['handedOver'] as List?)?.length ?? picked.length;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Handed over $n item${n == 1 ? '' : 's'}${delegate ? ' to ${collector['name'] ?? 'the collector'}' : ''}'),
          backgroundColor: SColors.green));
      Navigator.pop(context, true);
    } catch (e) {
      setState(() {
        busy = false;
        error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _refuse() async {
    final reasons = (r['refuseReasons'] is List) ? (r['refuseReasons'] as List).map((e) => e.toString()).toList() : ['wrong_person', 'other'];
    final labels = {
      'wrong_person': 'Wrong person',
      'expired': 'Pass expired',
      'revoked': 'Pass revoked — no longer valid',
      'id_mismatch': 'ID does not match',
      'other': 'Other',
    };
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        backgroundColor: SColors.card,
        title: const Text('Refuse pickup'),
        children: [
          for (final x in reasons)
            SimpleDialogOption(onPressed: () => Navigator.pop(ctx, x), child: Text(labels[x] ?? x)),
        ],
      ),
    );
    if (reason == null) return;
    setState(() => busy = true);
    try {
      for (final id in (picked.isEmpty ? items.map((i) => i['id'].toString()) : picked)) {
        await widget.api.hostRefusePickup(id, {
          'reason': reason,
          'code': widget.code,
          if (delegate && (collector['name'] ?? '').toString().isNotEmpty) 'who': collector['name'],
          if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
        });
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Refused — the owner has been told'), backgroundColor: SColors.green));
      Navigator.pop(context, false);
    } catch (e) {
      setState(() {
        busy = false;
        error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  String _label(Map<String, dynamic> i) =>
      (i['label'] ?? i['identifier'] ?? (i['unit'] != null ? 'Bay ${i['unit']}' : i['listing']) ?? 'Item').toString();

  @override
  Widget build(BuildContext context) {
    final until = r['validUntil'] != null ? DateTime.tryParse(r['validUntil'].toString())?.toLocal() : null;
    final held = (r['heldForOthers'] is List) ? (r['heldForOthers'] as List).whereType<Map>().toList() : const [];
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
            color: SColors.paper, borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
        padding: const EdgeInsets.all(SSpace.xl),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(delegate ? Icons.person_pin_circle_rounded : Icons.qr_code_2_rounded,
                  color: delegate ? SColors.clay : SColors.green),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: Text(delegate ? 'Delegated pickup' : 'Pickup',
                    style: Theme.of(context).textTheme.displayLarge),
              ),
            ]),
            const SizedBox(height: SSpace.xs),
            Text(
              delegate
                  ? '${collector['name'] ?? 'Someone'} is collecting for the owner · verify: ${r['verifyLabel'] ?? 'QR'}${until != null ? ' · until ${DateFormat('EEE d MMM, h:mm a').format(until)}' : ''}'
                  : 'The owner is collecting${r['reference'] != null ? ' · #${r['reference']}' : ''}',
              style: const TextStyle(color: SColors.muted),
            ),
            if (!allowed) ...[
              const SizedBox(height: SSpace.md),
              Container(
                padding: const EdgeInsets.all(SSpace.md),
                decoration: BoxDecoration(
                    color: SColors.danger.withValues(alpha: .1), borderRadius: BorderRadius.circular(SRadius.md)),
                child: Row(children: [
                  const Icon(Icons.block_rounded, color: SColors.danger),
                  const SizedBox(width: SSpace.sm),
                  Expanded(child: Text((r['message'] ?? 'Not allowed').toString(),
                      style: const TextStyle(color: SColors.danger, fontWeight: FontWeight.w600))),
                ]),
              ),
            ],
            if ((r['note'] ?? '').toString().isNotEmpty || r['photo'] != null) ...[
              const SizedBox(height: SSpace.md),
              Container(
                padding: const EdgeInsets.all(SSpace.md),
                decoration: BoxDecoration(color: SColors.card, borderRadius: BorderRadius.circular(SRadius.md), border: Border.all(color: SColors.line)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('FROM THE OWNER', style: TextStyle(fontSize: 11, letterSpacing: 1.2, color: SColors.faint, fontWeight: FontWeight.w700)),
                  if ((r['note'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(r['note'].toString())),
                  if (r['photo'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: SSpace.sm),
                      child: ClipRRect(borderRadius: BorderRadius.circular(SRadius.sm), child: Image.network(r['photo'].toString(), height: 140, fit: BoxFit.cover)),
                    ),
                ]),
              ),
            ],
            const SizedBox(height: SSpace.md),
            const Text('Handing over', style: TextStyle(fontWeight: FontWeight.w700)),
            for (final i in items)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                value: picked.contains(i['id'].toString()),
                onChanged: allowed ? (v) => setState(() => v == true ? picked.add(i['id'].toString()) : picked.remove(i['id'].toString())) : null,
                title: Text(_label(i)),
                subtitle: Text(i['present'] == true ? 'Here' : 'Already out'),
                activeColor: SColors.green,
              ),
            for (final h in held)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: const Icon(Icons.lock_outline_rounded, color: SColors.faint, size: 18),
                title: Text(_label(Map<String, dynamic>.from(h)), style: const TextStyle(color: SColors.muted)),
                subtitle: Text('Handed to ${h['delegatedTo']} — their pass releases it', style: const TextStyle(fontSize: 12)),
              ),
            if (allowed && needs.any((n) => n != 'qr')) ...[
              const SizedBox(height: SSpace.sm),
              const Text('Before you hand over', style: TextStyle(fontWeight: FontWeight.w700)),
              if (needs.contains('name'))
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: ticked.contains('name'),
                  onChanged: (v) => setState(() => v == true ? ticked.add('name') : ticked.remove('name')),
                  title: Text('They gave the name ${collector['name'] ?? ''}'),
                  activeColor: SColors.green,
                ),
              if (needs.contains('id'))
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: ticked.contains('id'),
                  onChanged: (v) => setState(() => v == true ? ticked.add('id') : ticked.remove('id')),
                  title: Text('Photo ID matches ${collector['name'] ?? 'the name on the pass'}'),
                  activeColor: SColors.green,
                ),
            ],
            if (allowed) ...[
              const SizedBox(height: SSpace.sm),
              Row(children: [
                OutlinedButton.icon(
                  onPressed: busy ? null : _addPhoto,
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: Text(photos.isEmpty ? (photoRequired ? 'Handover photo (required)' : 'Handover photo') : '${photos.length} photo${photos.length == 1 ? '' : 's'}'),
                ),
                const SizedBox(width: SSpace.sm),
                for (final p in photos.take(3))
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.network(p['url'].toString(), width: 40, height: 40, fit: BoxFit.cover)),
                  ),
              ]),
              const SizedBox(height: SSpace.sm),
              TextField(controller: _note, decoration: const InputDecoration(labelText: 'Note (optional)')),
            ],
            if (error != null) ...[
              const SizedBox(height: SSpace.sm),
              Text(error!, style: const TextStyle(color: SColors.danger)),
            ],
            const SizedBox(height: SSpace.lg),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy || items.isEmpty ? null : _refuse,
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 12), minimumSize: const Size.fromHeight(50)),
                  icon: const Icon(Icons.block_rounded, size: 18, color: SColors.danger),
                  label: const Text('Refuse', maxLines: 1, style: TextStyle(color: SColors.danger)),
                ),
              ),
              const SizedBox(width: SSpace.sm),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: busy || !ready ? null : _handOver,
                  style: ElevatedButton.styleFrom(backgroundColor: SColors.clay, padding: const EdgeInsets.symmetric(horizontal: 12), minimumSize: const Size.fromHeight(50)),
                  icon: busy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.handshake_rounded, size: 18),
                  label: const Text('Hand over', maxLines: 1),
                ),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}
