import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/environment.dart';
import '../../config/stowbo_theme.dart';
import '../../models/community_message.dart';
import '../../providers/auth_provider.dart';
import '../../services/community_chat_service.dart';
import '../../services/community_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/stowbo_widgets.dart';

/// 1:1 host↔guest conversation over the community API. [recipientId] is the
/// other party's email (falls back to their user id). Optional [bookingId]
/// tags messages for context.
class ChatScreen extends StatefulWidget {
  final String recipientId;
  final String recipientName;
  final String? subtitle;
  final String? bookingId;
  const ChatScreen({
    super.key,
    required this.recipientId,
    required this.recipientName,
    this.subtitle,
    this.bookingId,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _chat = communityChatService;
  final _api = communityService;
  final _input = TextEditingController();
  final _scroll = ScrollController();

  final List<CommunityMessage> _messages = [];
  StreamSubscription? _sub;
  StreamSubscription? _typingSub;
  bool _loading = true;
  bool _peerTyping = false;
  Timer? _typingClear;
  String _myEmail = '';

  @override
  void initState() {
    super.initState();
    _myEmail = context.read<AuthProvider>().user?.email ?? '';
    _boot();
  }

  Future<void> _boot() async {
    // History via REST.
    try {
      final history = await _api.getThreadMessages(widget.recipientId);
      _messages
        ..clear()
        ..addAll(history);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
    _scrollToEnd();

    // Realtime via socket.
    final token = await storageService.getAccessToken();
    if (token != null && token.isNotEmpty) {
      _chat.connect(token: token, orgId: EnvironmentConfig.orgId);
    }
    _sub = _chat.onMessage.listen(_onIncoming);
    _typingSub = _chat.onTyping.listen((e) {
      final from = (e['from'] ?? '').toString().toLowerCase();
      if (from == widget.recipientId.toLowerCase()) {
        setState(() => _peerTyping = e['isTyping'] == true);
        _typingClear?.cancel();
        if (e['isTyping'] == true) {
          _typingClear = Timer(const Duration(seconds: 3),
              () => mounted ? setState(() => _peerTyping = false) : null);
        }
      }
    });
    _api.markThreadRead(widget.recipientId).catchError((_) {});
  }

  void _onIncoming(CommunityMessage m) {
    final other = widget.recipientId.toLowerCase();
    final involves = m.sender.toLowerCase() == other ||
        m.recipient.toLowerCase() == other;
    if (!involves) return;
    if (_messages.any((x) => x.id.isNotEmpty && x.id == m.id)) return;
    setState(() => _messages.add(m));
    _scrollToEnd();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    _input.clear();

    // Optimistic echo.
    final optimistic = CommunityMessage(
      id: 'local-${DateTime.now().microsecondsSinceEpoch}',
      sender: _myEmail,
      recipient: widget.recipientId,
      content: text,
      sentAt: DateTime.now(),
    );
    setState(() => _messages.add(optimistic));
    _scrollToEnd();

    if (_chat.connected) {
      _chat.sendMessage(to: widget.recipientId, content: text);
    } else {
      // Fallback to REST (also carries booking context).
      try {
        await _api.sendMessage(
          recipientId: widget.recipientId,
          content: text,
          context: widget.bookingId == null
              ? null
              : {'bookingId': widget.bookingId},
        );
      } catch (_) {}
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _typingSub?.cancel();
    _typingClear?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.recipientName,
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w700)),
            Text(
              _peerTyping ? 'typing…' : (widget.subtitle ?? ''),
              style: TextStyle(
                  fontSize: 12,
                  color: _peerTyping ? SColors.green : SColors.muted),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: SColors.clay))
                : _messages.isEmpty
                    ? const EmptyState(
                        icon: Icons.chat_bubble_outline_rounded,
                        title: 'Say hello',
                        subtitle:
                            'Message about the drop-off, timing, or anything about the booking.',
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(SSpace.lg),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) =>
                            _Bubble(m: _messages[i], myEmail: _myEmail),
                      ),
          ),
          _Composer(
            controller: _input,
            onSend: _send,
            onTyping: (t) => _chat.connected
                ? _chat.sendTyping(to: widget.recipientId, isTyping: t)
                : null,
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final CommunityMessage m;
  final String myEmail;
  const _Bubble({required this.m, required this.myEmail});

  @override
  Widget build(BuildContext context) {
    final mine = m.mine(myEmail);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: mine ? SColors.clay : SColors.card,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(SRadius.lg),
            topRight: const Radius.circular(SRadius.lg),
            bottomLeft: Radius.circular(mine ? SRadius.lg : 4),
            bottomRight: Radius.circular(mine ? 4 : SRadius.lg),
          ),
          border: mine
              ? null
              : Border.all(color: SColors.line, width: 1.2),
        ),
        child: Text(
          m.content,
          style: TextStyle(
              color: mine ? Colors.white : SColors.ink, height: 1.35),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final ValueChanged<bool> onTyping;
  const _Composer(
      {required this.controller,
      required this.onSend,
      required this.onTyping});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
            SSpace.md, SSpace.sm, SSpace.md, SSpace.sm),
        decoration: const BoxDecoration(
          color: SColors.card,
          border: Border(top: BorderSide(color: SColors.line, width: 1.2)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                onChanged: (v) => onTyping(v.isNotEmpty),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: 'Message…',
                  filled: true,
                  fillColor: SColors.paper,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill),
                    borderSide:
                        const BorderSide(color: SColors.line, width: 1.4),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill),
                    borderSide:
                        const BorderSide(color: SColors.line, width: 1.4),
                  ),
                ),
              ),
            ),
            const SizedBox(width: SSpace.sm),
            Material(
              color: SColors.clay,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onSend,
                child: const SizedBox(
                  width: 46,
                  height: 46,
                  child: Icon(Icons.send_rounded, color: Colors.white, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
