import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../models/stowbo_host.dart';
import '../../services/community_service.dart';
import '../../widgets/stowbo_widgets.dart';
import '../chat/chat_screen.dart';

/// Public host profile — the social anchor that lets a guest connect with a
/// host: follow them and message them. Profile detail comes from the community
/// people API; follow uses the community follow API.
class HostProfileScreen extends StatefulWidget {
  final StowboHost host;
  const HostProfileScreen({super.key, required this.host});
  @override
  State<HostProfileScreen> createState() => _HostProfileScreenState();
}

class _HostProfileScreenState extends State<HostProfileScreen> {
  final _api = communityService;
  bool _following = false;
  bool _busy = false;
  String? _followId; // the follow record id, needed to unfollow
  Map<String, dynamic>? _profile;

  String get _hostRef => widget.host.ownerEmail.isNotEmpty
      ? widget.host.ownerEmail
      : widget.host.ownerUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final profile = await _api.getProfile(_hostRef);
      final following = await _api.getFollowing();
      String? fid;
      for (final f in following) {
        final data = (f['data'] is Map)
            ? Map<String, dynamic>.from(f['data'])
            : f;
        if ((data['following'] ?? '').toString().toLowerCase() ==
            _hostRef.toLowerCase()) {
          fid = (f['sk'] ?? f['id'] ?? data['id'])?.toString();
          break;
        }
      }
      if (mounted) {
        setState(() {
          _profile = profile;
          _following = fid != null;
          _followId = fid;
        });
      }
    } catch (_) {}
  }

  Future<void> _toggleFollow() async {
    setState(() => _busy = true);
    try {
      if (_following) {
        if (_followId != null) await _api.unfollow(_followId!);
        setState(() {
          _following = false;
          _followId = null;
        });
      } else {
        await _api.follow(_hostRef);
        setState(() => _following = true);
        _load(); // refresh to grab the new follow id
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: SColors.danger));
      }
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.host;
    final bio = (_profile?['bio'] ?? _profile?['shortBio'] ?? '').toString();
    final company = (_profile?['company'] ?? '').toString();
    return Scaffold(
      appBar: AppBar(title: const Text('Host')),
      body: ListView(
        padding: const EdgeInsets.all(SSpace.xl),
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 34,
                backgroundColor: SColors.greenSoft,
                child: Text(
                  h.name.isNotEmpty ? h.name[0].toUpperCase() : '?',
                  style: const TextStyle(
                      color: SColors.green,
                      fontWeight: FontWeight.w700,
                      fontSize: 26),
                ),
              ),
              const SizedBox(width: SSpace.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(h.name,
                        style: Theme.of(context).textTheme.headlineSmall),
                    if (company.isNotEmpty)
                      Text(company,
                          style: const TextStyle(color: SColors.muted)),
                    Row(children: [
                      const Icon(Icons.sell_outlined,
                          size: 14, color: SColors.muted),
                      const SizedBox(width: 4),
                      Text(h.kind,
                          style: const TextStyle(
                              color: SColors.muted, fontSize: 13)),
                    ]),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SSpace.lg),
          Row(
            children: [
              Expanded(
                child: _busy
                    ? const Center(
                        child: SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                                color: SColors.clay, strokeWidth: 2.2)))
                    : _following
                        ? OutlinedButton.icon(
                            onPressed: _toggleFollow,
                            icon: const Icon(Icons.check_rounded),
                            label: const Text('Following'),
                          )
                        : ElevatedButton.icon(
                            onPressed: _toggleFollow,
                            icon: const Icon(Icons.add_rounded),
                            label: const Text('Follow'),
                          ),
              ),
              const SizedBox(width: SSpace.md),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ChatScreen(
                          recipientId: _hostRef,
                          recipientName: h.name,
                          subtitle: 'Host'),
                    ),
                  ),
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Message'),
                ),
              ),
            ],
          ),
          if (bio.isNotEmpty) ...[
            const SizedBox(height: SSpace.xl),
            Text('About', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: SSpace.sm),
            Text(bio, style: const TextStyle(color: SColors.ink2, height: 1.5)),
          ],
          const SizedBox(height: SSpace.xl),
          SCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(h.name, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 4),
                if (h.address.isNotEmpty)
                  Row(children: [
                    const Icon(Icons.place_outlined,
                        size: 15, color: SColors.muted),
                    const SizedBox(width: 4),
                    Expanded(
                        child: Text(h.address,
                            style: const TextStyle(color: SColors.muted))),
                  ]),
                const SizedBox(height: SSpace.sm),
                Text('${money(h.ratePerHour)} / item · hour',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
