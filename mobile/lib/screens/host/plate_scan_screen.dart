import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/stowbo_theme.dart';
import '../../services/stowbo_api.dart';
import '../../services/file_service.dart';
import '../../services/plate_ocr_service.dart';
import 'host_walkin_screen.dart';
import 'take_payment_sheet.dart';
import 'checkout_flow.dart';

/// The valet's one-button flow. Point the camera at a plate; the phone reads it
/// on-device, then looks it up in our records and decides what this is:
///
///   • the car is HERE right now  → a pickup → hand back / check out inline
///   • a KNOWN plate, not in custody → a returning customer → take in, prefilled
///   • an UNKNOWN plate            → new → register with the plate + photo
///
/// The operator never types a plate they didn't have to, and never re-keys a
/// returning customer we already know.
class PlateScanScreen extends StatefulWidget {
  /// The lane the car is being taken into, if the operator already picked one.
  final String? listing;
  const PlateScanScreen({super.key, this.listing});
  @override
  State<PlateScanScreen> createState() => _PlateScanScreenState();
}

enum _Phase { capturing, reading, ready }

class _PlateScanScreenState extends State<PlateScanScreen> {
  final _api = stowboApi;
  final _ocr = PlateOcrService();
  final _plate = TextEditingController();

  _Phase _phase = _Phase.capturing;
  String? _photoPath; // local capture
  String? _photoUrl; // uploaded evidence
  List<String> _candidates = [];

  bool _looking = false;
  List<Map<String, dynamic>> _results = [];
  bool _didLookup = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _capture());
  }

  @override
  void dispose() {
    _ocr.dispose();
    _plate.dispose();
    super.dispose();
  }

  Future<void> _capture() async {
    try {
      final shot = await ImagePicker().pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.rear,
        imageQuality: 85,
      );
      if (shot == null) {
        if (mounted) Navigator.pop(context); // cancelled the camera
        return;
      }
      setState(() {
        _photoPath = shot.path;
        _phase = _Phase.reading;
      });
      // Read on-device, then upload the photo as evidence in the background.
      final read = await _ocr.read(shot.path);
      if (!mounted) return;
      _plate.text = read.best;
      setState(() {
        _candidates = read.candidates;
        _phase = _Phase.ready;
      });
      _uploadEvidence(shot);
      if (read.best.isNotEmpty) _lookup();
    } catch (e) {
      if (!mounted) return;
      setState(() => _phase = _Phase.ready);
      _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    }
  }

  Future<void> _uploadEvidence(XFile shot) async {
    try {
      final bytes = await shot.readAsBytes();
      final name = 'plate_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final url =
          await fileService.upload(bytes, name, location: 'stowbo/valet');
      if (mounted && url != null) setState(() => _photoUrl = url);
    } catch (_) {
      // Evidence upload is best-effort; the plate + flow still work without it.
    }
  }

  Future<void> _lookup() async {
    final q = _plate.text.trim();
    if (q.length < 2) return;
    setState(() {
      _looking = true;
      _didLookup = true;
    });
    try {
      final res = await _api.hostResolve(q);
      final list = (res['results'] is List)
          ? List<Map<String, dynamic>>.from(
              (res['results'] as List).map((e) => Map<String, dynamic>.from(e)))
          : <Map<String, dynamic>>[];
      if (mounted) setState(() => _results = list);
    } catch (e) {
      if (mounted) _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    } finally {
      if (mounted) setState(() => _looking = false);
    }
  }

  // ── classify what the lookup found ────────────────────────────────────────
  List<Map<String, dynamic>> get _allItems => _results
      .expand((r) => (r['items'] is List)
          ? (r['items'] as List).map((e) => {
                ...Map<String, dynamic>.from(e),
                '_booking': r['booking'],
                '_customer': r['customer'],
                '_reference': r['reference'],
              })
          : const <Map<String, dynamic>>[])
      .toList();

  /// Items in custody right now — checked in, not checked out.
  List<Map<String, dynamic>> get _active => _allItems
      .where((i) => i['checkedInAt'] != null && i['checkedOutAt'] == null)
      .toList();

  String? get _knownCustomer {
    for (final r in _results) {
      final c = (r['customer'] ?? '').toString();
      if (c.isNotEmpty) return c;
    }
    return null;
  }

  // ── actions ───────────────────────────────────────────────────────────────
  Future<void> _run(Future<void> Function() op, String done) async {
    setState(() => _looking = true);
    try {
      await op();
      if (!mounted) return;
      _toast(done, SColors.green);
      await _lookup(); // refresh state → actions update
    } catch (e) {
      if (!mounted) return;
      _toast(e.toString().replaceFirst('Exception: ', ''), SColors.danger);
    } finally {
      if (mounted) setState(() => _looking = false);
    }
  }

  Future<void> _itemAction(String itemId, String action) {
    switch (action) {
      case 'checkin':
        return _run(() => _api.itemCheckin(itemId).then((_) {}), 'Checked in');
      case 'in':
        return _run(
            () => _api.itemMovement(itemId, {'direction': 'in'}).then((_) {}),
            'Moved in');
      case 'out':
        return _run(
            () => _api.itemMovement(itemId, {'direction': 'out'}).then((_) {}),
            'Handed back');
      case 'checkout':
        // Show the cost (preview → confirm → what was charged), then refresh.
        return runCheckout(context, _api, itemId).then((done) async {
          if (done && mounted) await _lookup();
        });
      default:
        return Future.value();
    }
  }

  Future<void> _register() async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => HostWalkinScreen(
          initialPlate: _plate.text.trim(),
          initialCustomer: _knownCustomer,
          platePhotoUrl: _photoUrl,
          initialListing: widget.listing,
        ),
      ),
    );
    if (saved == true && mounted) Navigator.pop(context, true);
  }

  void _toast(String msg, Color bg) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(msg), backgroundColor: bg));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan a plate')),
      body: _phase == _Phase.capturing
          ? const Center(child: CircularProgressIndicator(color: SColors.clay))
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(SSpace.xl),
                children: [
                  _photoCard(),
                  const SizedBox(height: SSpace.lg),
                  _plateField(),
                  if (_candidates.length > 1) ...[
                    const SizedBox(height: SSpace.sm),
                    _candidateChips(),
                  ],
                  const SizedBox(height: SSpace.xl),
                  _resultPanel(),
                ],
              ),
            ),
    );
  }

  Widget _photoCard() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(SRadius.lg),
      child: Stack(children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: _photoPath != null
              ? Image.file(File(_photoPath!), fit: BoxFit.cover)
              : Container(color: SColors.paper2),
        ),
        if (_phase == _Phase.reading)
          Positioned.fill(
            child: Container(
              color: Colors.black.withValues(alpha: 0.35),
              child: const Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  CircularProgressIndicator(color: Colors.white),
                  SizedBox(height: SSpace.sm),
                  Text('Reading plate…',
                      style: TextStyle(color: Colors.white)),
                ]),
              ),
            ),
          ),
        Positioned(
          right: SSpace.sm,
          bottom: SSpace.sm,
          child: Material(
            color: Colors.black54,
            shape: const CircleBorder(),
            child: IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              tooltip: 'Retake',
              onPressed: _capture,
            ),
          ),
        ),
      ]),
    );
  }

  Widget _plateField() {
    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.md),
        border: Border.all(color: SColors.line, width: 1.3),
      ),
      padding: const EdgeInsets.symmetric(horizontal: SSpace.md),
      child: Row(children: [
        const Icon(Icons.pin_rounded, color: SColors.muted),
        const SizedBox(width: SSpace.sm),
        Expanded(
          child: TextField(
            controller: _plate,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: 2),
            decoration: const InputDecoration(
                hintText: 'PLATE', border: InputBorder.none),
            onSubmitted: (_) => _lookup(),
          ),
        ),
        TextButton(
          onPressed: _looking ? null : _lookup,
          child: const Text('Look up'),
        ),
      ]),
    );
  }

  Widget _candidateChips() {
    return Wrap(
      spacing: SSpace.sm,
      runSpacing: 6,
      children: _candidates.take(6).map((c) {
        final sel = c == _plate.text.trim();
        return ChoiceChip(
          label: Text(c),
          selected: sel,
          onSelected: (_) {
            _plate.text = c;
            _lookup();
          },
          selectedColor: SColors.claySoft,
        );
      }).toList(),
    );
  }

  // ── the branch panel ──────────────────────────────────────────────────────
  Widget _resultPanel() {
    if (_looking && !_didLookup) {
      return const Center(child: CircularProgressIndicator(color: SColors.clay));
    }
    if (!_didLookup) {
      return const SizedBox.shrink();
    }
    if (_active.isNotEmpty) return _pickupPanel();
    if (_results.isNotEmpty) return _returningPanel();
    return _newPanel();
  }

  /// The car is here now → pick-up. Show each active item with its legal moves.
  Widget _pickupPanel() {
    final customer = _knownCustomer ?? 'Guest';
    return _panel(
      tone: SColors.green,
      badge: 'HERE NOW',
      title: customer,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _active.map((it) {
          final unit = (it['unit'] ?? '').toString();
          final ident = (it['identifier'] ?? '').toString();
          final over = it['overstaying'] == true;
          final actions = (it['actions'] is List)
              ? List<String>.from(it['actions'].map((e) => e.toString()))
              : <String>[];
          return Padding(
            padding: const EdgeInsets.only(top: SSpace.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.directions_car_rounded,
                      size: 18, color: SColors.ink2),
                  const SizedBox(width: 6),
                  Text(ident.isNotEmpty ? ident : 'Item',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (unit.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    _tag('Bay $unit'),
                  ],
                  if (over) ...[const SizedBox(width: 8), _tag('OVERSTAY', SColors.danger)],
                ]),
                const SizedBox(height: SSpace.sm),
                Wrap(
                  spacing: SSpace.sm,
                  runSpacing: 6,
                  children: actions
                      .map((a) => _actionBtn(it, a, _looking))
                      .toList(),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  /// Known plate, nothing in custody → returning customer.
  Widget _returningPanel() {
    final customer = _knownCustomer ?? 'Returning guest';
    final visits = _results.length;
    return _panel(
      tone: SColors.clay,
      badge: 'RETURNING',
      title: customer,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$visits past ${visits == 1 ? 'visit' : 'visits'} on this plate.',
              style: const TextStyle(color: SColors.ink2)),
          const SizedBox(height: SSpace.md),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _looking ? null : _register,
              style: ElevatedButton.styleFrom(backgroundColor: SColors.green),
              icon: const Icon(Icons.login_rounded),
              label: const Text('Take in again'),
            ),
          ),
        ],
      ),
    );
  }

  /// No record → new car.
  Widget _newPanel() {
    return _panel(
      tone: SColors.ink2,
      badge: 'NEW',
      title: _plate.text.trim().isEmpty ? 'No plate read' : _plate.text.trim(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Not in our records. Register it now.',
              style: TextStyle(color: SColors.ink2)),
          const SizedBox(height: SSpace.md),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _looking ? null : _register,
              style: ElevatedButton.styleFrom(backgroundColor: SColors.clay),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Register this plate'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(Map<String, dynamic> item, String action, bool busy) {
    const labels = {
      'checkin': 'Check in',
      'in': 'Bring in',
      'out': 'Hand back',
      'checkout': 'Check out',
      'charge': 'Collect payment',
    };
    final itemId = item['id'].toString();
    final isReturn = action == 'out' || action == 'checkout';
    final isCharge = action == 'charge';
    return ElevatedButton(
      onPressed: busy
          ? null
          : () => isCharge ? _chargePlate(item) : _itemAction(itemId, action),
      style: ElevatedButton.styleFrom(
        backgroundColor: isCharge
            ? SColors.ink
            : (isReturn ? SColors.green : SColors.clay),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      ),
      child: Text(labels[action] ?? action),
    );
  }

  /// The valet collects what's owed right here — the resolve told us this item
  /// needs a charge (e.g. an overstay to settle before release). Was silently
  /// dropped, so a car could be handed back with money still owed.
  Future<void> _chargePlate(Map<String, dynamic> item) async {
    final ok = await TakePaymentSheet.show(
      context,
      bookingId: (item['_booking'] ?? '').toString(),
      listingId: (item['listing'] ?? '').toString(),
      presetCategory: 'balance',
    );
    if (ok == true && mounted) await _lookup();
  }

  Widget _panel({
    required Color tone,
    required String badge,
    required String title,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.lg),
        border: Border.all(color: tone.withValues(alpha: 0.4), width: 1.4),
        boxShadow: SShadow.soft,
      ),
      padding: const EdgeInsets.all(SSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: tone.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(SRadius.pill),
              ),
              child: Text(badge,
                  style: TextStyle(
                      color: tone,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                      letterSpacing: 1)),
            ),
            const Spacer(),
            if (_looking)
              const SizedBox(
                  height: 16,
                  width: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: SColors.muted)),
          ]),
          const SizedBox(height: SSpace.sm),
          Text(title,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: SSpace.xs),
          child,
        ],
      ),
    );
  }

  Widget _tag(String t, [Color? c]) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: (c ?? SColors.ink2).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(SRadius.pill),
        ),
        child: Text(t,
            style: TextStyle(
                color: c ?? SColors.ink2,
                fontSize: 11,
                fontWeight: FontWeight.w700)),
      );
}
