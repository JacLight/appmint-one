import 'package:flutter/material.dart';
import '../../config/stowbo_theme.dart';
import '../../services/community_service.dart';
import '../../widgets/stowbo_widgets.dart';
import 'chat_screen.dart';

/// Message thread list — every host↔guest conversation the user is part of,
/// from the community API (`/client/community/messages/threads`).
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  final _api = communityService;
  List<Map<String, dynamic>> _threads = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _threads = await _api.getThreads();
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: SColors.clay,
          onRefresh: _load,
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: SColors.clay))
              : _threads.isEmpty
                  ? ListView(children: [
                      const SizedBox(height: 100),
                      EmptyState(
                        icon: Icons.forum_outlined,
                        title: _error ?? 'No messages yet',
                        subtitle: _error == null
                            ? 'Chats with hosts and guests about your bookings show up here.'
                            : null,
                      ),
                    ])
                  : ListView(
                      padding: const EdgeInsets.all(SSpace.xl),
                      children: [
                        Text('Messages',
                            style:
                                Theme.of(context).textTheme.displayLarge),
                        const SizedBox(height: SSpace.lg),
                        ..._threads.map(_threadTile),
                      ],
                    ),
        ),
      ),
    );
  }

  Widget _threadTile(Map<String, dynamic> t) {
    final other = (t['otherUser'] is Map)
        ? Map<String, dynamic>.from(t['otherUser'])
        : <String, dynamic>{};
    final name = [
      other['firstName'],
      other['lastName']
    ].where((s) => (s ?? '').toString().isNotEmpty).join(' ');
    final email = (other['email'] ?? '').toString();
    final display = name.isNotEmpty ? name : (email.isNotEmpty ? email : 'Chat');
    final last = (t['lastMessage'] is Map)
        ? (Map<String, dynamic>.from(t['lastMessage'])['content'] ?? '')
            .toString()
        : (t['lastMessage'] ?? '').toString();
    final unread = (t['unreadCount'] is num)
        ? (t['unreadCount'] as num).toInt()
        : 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: SSpace.sm),
      child: SCard(
        padding: const EdgeInsets.symmetric(
            horizontal: SSpace.lg, vertical: SSpace.md),
        onTap: email.isEmpty
            ? null
            : () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChatScreen(
                        recipientId: email, recipientName: display),
                  ),
                ).then((_) => _load()),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: SColors.claySoft,
              child: Text(
                display.isNotEmpty ? display[0].toUpperCase() : '?',
                style: const TextStyle(
                    color: SColors.clay2, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(display,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 13)),
                ],
              ),
            ),
            if (unread > 0)
              Container(
                margin: const EdgeInsets.only(left: SSpace.sm),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                    color: SColors.clay,
                    borderRadius: BorderRadius.circular(SRadius.pill)),
                child: Text('$unread',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ),
          ],
        ),
      ),
    );
  }
}
