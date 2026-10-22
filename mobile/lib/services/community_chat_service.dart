import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/environment.dart';
import '../models/community_message.dart';
import 'storage_service.dart';

/// Realtime 1:1 chat over the community API's Socket.IO namespace
/// (`/community-chat`). Ported from event_app's CommunityChatService. The
/// socket authenticates with the USER token only; you receive DMs by being in
/// your own email room (no join needed). Send to the other party by email/sk.
class CommunityChatService {
  static final CommunityChatService _instance =
      CommunityChatService._internal();
  factory CommunityChatService() => _instance;
  CommunityChatService._internal();

  io.Socket? _socket;
  bool _connected = false;
  bool get connected => _connected;

  final _messages = StreamController<CommunityMessage>.broadcast();
  final _typing = StreamController<Map<String, dynamic>>.broadcast();
  final _online = StreamController<Map<String, dynamic>>.broadcast();
  final _stowbo = StreamController<Map<String, dynamic>>.broadcast();

  Stream<CommunityMessage> get onMessage => _messages.stream;
  Stream<Map<String, dynamic>> get onTyping => _typing.stream;
  Stream<Map<String, dynamic>> get onOnlineStatus => _online.stream;

  /// Real-time Stowbo booking events (request status changes, movements) pushed
  /// to this user's room — powers the instant request monitor + in-app alerts.
  Stream<Map<String, dynamic>> get onStowbo => _stowbo.stream;

  /// Connect using the stored user token if not already connected. Safe to call
  /// from anywhere that wants live events (e.g. the booking detail).
  Future<void> ensureConnected() async {
    if (_connected) return;
    final token = await storageService.getAccessToken();
    if (token != null && token.isNotEmpty) {
      connect(token: token, orgId: EnvironmentConfig.orgId);
    }
  }

  void connect({required String token, String? orgId}) {
    if (_socket != null && _connected) return;
    final endpoint = EnvironmentConfig.appengineEndpoint;
    _socket = io.io(
      '$endpoint/community-chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token, 'orgId': orgId ?? EnvironmentConfig.orgId})
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(2000)
          .setReconnectionAttempts(10)
          .build(),
    );

    _socket!
      ..onConnect((_) {
        _connected = true;
        if (kDebugMode) print('💬 community-chat connected');
      })
      ..onDisconnect((_) => _connected = false)
      ..on('message', (d) {
        if (d is Map) {
          _messages.add(
              CommunityMessage.fromJson(Map<String, dynamic>.from(d)));
        }
      })
      ..on('typing', (d) {
        if (d is Map) _typing.add(Map<String, dynamic>.from(d));
      })
      ..on('onlineStatus', (d) {
        if (d is Map) _online.add(Map<String, dynamic>.from(d));
      })
      ..on('stowbo', (d) {
        if (d is Map) {
          if (kDebugMode) print('🔔 stowbo event: $d');
          _stowbo.add(Map<String, dynamic>.from(d));
        }
      })
      ..on('error', (d) {
        if (kDebugMode) print('💬 chat error: $d');
      });

    _socket!.connect();
  }

  /// Emit a message to [to] (recipient email or sk).
  void sendMessage({
    required String to,
    required String content,
    String contentType = 'text',
  }) {
    _socket?.emit('sendMessage', {
      'to': to,
      'content': content,
      'contentType': contentType,
    });
  }

  void sendTyping({required String to, required bool isTyping}) {
    _socket?.emit('typing', {'to': to, 'isTyping': isTyping});
  }

  void markRead(List<String> ids) {
    if (ids.isEmpty) return;
    _socket?.emit('markRead', {'messageIds': ids});
  }

  void disconnect() {
    _socket?.disconnect();
    _connected = false;
  }

  void dispose() {
    disconnect();
    _socket?.dispose();
    _socket = null;
  }
}

final communityChatService = CommunityChatService();
