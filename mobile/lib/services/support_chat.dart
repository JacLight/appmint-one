import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:appmint_chat/appmint_chat.dart';
import '../config/environment.dart';
import '../config/stowbo_theme.dart';
import 'auth_service.dart';
import 'http_client.dart';
import 'storage_service.dart';
import '../config/setup.dart';

/// Customer ↔ Stowbo admin chat. The chat settings come from the server
/// (`GET client/stowbo/chat-config` = the chat config and app id the Stowbo site
/// points at), so the admin changes them on the site and this picks them up. The admin
/// answers from the appmint dashboard or appmint_mobile.
AppmintSiteChat? _site;
const _sessionKey = 'stowbo_support_chat_session';

Future<AppmintSiteChat> _siteChat() async {
  if (_site != null) return _site!;
  try {
    final res = await appengineHttpClient.get('/client/stowbo/chat-config', useUserToken: false);
    _site = AppmintSiteChat.fromSite(res is Map ? Map<String, dynamic>.from(res) : null);
  } catch (_) {
    _site = const AppmintSiteChat(); // no site / no config → every online admin is alerted
  }
  return _site!;
}

Future<AppmintChatConfig> supportChatConfig() async {
  final me = storageService.getUser();
  final site = await _siteChat();
  return AppmintChatConfig(
    endpoint: EnvironmentConfig.appengineEndpoint,
    orgId: EnvironmentConfig.orgId,
    user: AppmintChatUser(email: me?.email ?? '', name: me?.displayName),
    token: storageService.getAccessToken,
    configId: site.configId,
    appId: site.appId,
    language: 'en',
    supportName: '${CurrentSetup.brand.name} support',
    welcome: 'Questions about a ${CurrentSetup.term(LexiconKeys.booking).toLowerCase()}, a payment or the app? Write here and the ${CurrentSetup.brand.name} team replies in this thread.',
    // Customer tokens last an hour; the gateway refuses a stale one. Refresh and retry.
    onTokenExpired: () async {
      await authService.refresh();
    },
    // Resume the same chat session next time (no fresh greeting on every open).
    loadSessionId: () async => storageService.prefs.getString(_sessionKey),
    saveSessionId: (id) async {
      await storageService.prefs.setString(_sessionKey, id);
    },
  );
}

const supportChatTheme = AppmintChatTheme(
  accent: SColors.clay,
  onAccent: Colors.white,
  background: SColors.paper,
  surface: SColors.card,
  text: SColors.ink,
  muted: SColors.muted,
  line: SColors.line,
  success: SColors.green,
  danger: SColors.danger,
  radius: SRadius.lg,
);

Future<void> openSupportChat(BuildContext context) async {
  final me = storageService.getUser();
  if (me == null || me.email.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sign in to chat with ${CurrentSetup.brand.name}.')));
    return;
  }
  final config = await supportChatConfig();
  if (!context.mounted) return;
  await Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => AppmintSupportChatScreen(
        config: config,
        theme: supportChatTheme,
        title: '${CurrentSetup.brand.name} support',
        onPickAttachments: pickChatPhoto,
      ),
    ),
  );
}

/// Camera or gallery → one photo for the chat. Returns null when cancelled.
Future<List<AppmintChatAttachment>?> pickChatPhoto(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: SColors.card,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl))),
    builder: (ctx) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: SSpace.sm),
        ListTile(
          leading: const Icon(Icons.photo_camera_outlined, color: SColors.ink2),
          title: const Text('Take a photo'),
          onTap: () => Navigator.pop(ctx, ImageSource.camera),
        ),
        ListTile(
          leading: const Icon(Icons.photo_library_outlined, color: SColors.ink2),
          title: const Text('Choose from library'),
          onTap: () => Navigator.pop(ctx, ImageSource.gallery),
        ),
        const SizedBox(height: SSpace.sm),
      ]),
    ),
  );
  if (source == null) return null;
  final shot = await ImagePicker().pickImage(
      source: source, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
  if (shot == null) return null;
  final bytes = await shot.readAsBytes();
  final name = shot.name.isNotEmpty ? shot.name : 'photo.jpg';
  final ext = name.toLowerCase().split('.').last;
  final mime = shot.mimeType ??
      (ext == 'png' ? 'image/png' : ext == 'webp' ? 'image/webp' : ext == 'gif' ? 'image/gif' : 'image/jpeg');
  return [AppmintChatAttachment(bytes: bytes, name: name, mimeType: mime)];
}
