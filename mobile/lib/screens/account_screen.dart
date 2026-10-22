import 'package:flutter/material.dart';
import 'setup_directory_screen.dart';
import 'package:provider/provider.dart';
import '../config/setup.dart';
import '../config/stowbo_theme.dart';
import '../providers/auth_provider.dart';
import '../providers/role_provider.dart';
import '../widgets/stowbo_widgets.dart';
import '../services/support_chat.dart';

/// Brand line at the foot of the account screen. A setup without a tagline
/// shows only its name rather than borrowing another setup's words.
String get _brandFooter {
  final b = CurrentSetup.brand;
  final name = b.name.isEmpty ? 'Appmint One' : b.name;
  return b.tagline == null ? name : '$name \u00b7 ${b.tagline}';
}

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final role = context.watch<RoleProvider>();
    final isHost = role.role == AppRole.host;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SSpace.xl),
          children: [
            Text('Account', style: Theme.of(context).textTheme.displayLarge),
            const SizedBox(height: SSpace.lg),
            SCard(
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: SColors.claySoft,
                    child: Text(
                      (user?.displayName.isNotEmpty ?? false)
                          ? user!.displayName[0].toUpperCase()
                          : '?',
                      style: const TextStyle(
                          color: SColors.clay2,
                          fontWeight: FontWeight.w700,
                          fontSize: 20),
                    ),
                  ),
                  const SizedBox(width: SSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?.displayName ?? 'Guest',
                            style: Theme.of(context).textTheme.titleLarge),
                        if ((user?.email ?? '').isNotEmpty)
                          Text(user!.email,
                              style: const TextStyle(color: SColors.muted)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SSpace.lg),
            const SectionLabel('Mode'),
            SCard(
              padding: EdgeInsets.zero,
              child: SwitchListTile(
                value: isHost,
                activeThumbColor: SColors.green,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: SSpace.lg, vertical: 4),
                title: Text(isHost ? 'Host mode' : 'Guest mode',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(isHost
                    ? 'Accepting drop-offs and managing listings.'
                    : 'Booking spots and stowing your stuff.'),
                onChanged: (v) =>
                    role.setRole(v ? AppRole.host : AppRole.guest),
              ),
            ),
            const SizedBox(height: SSpace.lg),
            const SectionLabel('Support'),
            _tile(context, Icons.support_agent_rounded, 'Chat with ${CurrentSetup.brand.name}',
                onTap: () => openSupportChat(context)),
            _tile(context, Icons.help_outline_rounded, 'How ${CurrentSetup.brand.name} works'),
            // Demo builds only: a customer's app is locked to its own setup.
            if (CurrentSetup.switchable)
              _tile(context, Icons.swap_horiz_rounded, 'Switch setup',
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const SetupDirectoryScreen()))),
            _tile(context, Icons.shield_outlined, 'Trust & safety'),
            _tile(context, Icons.description_outlined, 'Terms & privacy'),
            const SizedBox(height: SSpace.xl),
            OutlinedButton.icon(
              onPressed: () async {
                await context.read<AuthProvider>().signOut();
                if (context.mounted) context.read<RoleProvider>().clear();
              },
              icon: const Icon(Icons.logout_rounded, color: SColors.danger),
              label: const Text('Sign out',
                  style: TextStyle(color: SColors.danger)),
              style: OutlinedButton.styleFrom(
                  side: BorderSide(
                      color: SColors.danger.withValues(alpha: 0.4))),
            ),
            const SizedBox(height: SSpace.sm),
            TextButton.icon(
              onPressed: () => _confirmDelete(context),
              icon: const Icon(Icons.delete_outline_rounded,
                  color: SColors.danger, size: 20),
              label: const Text('Delete account',
                  style: TextStyle(color: SColors.danger)),
            ),
            const SizedBox(height: SSpace.xl),
            Center(
              child: Text(_brandFooter,
                  style: const TextStyle(color: SColors.faint, fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: SColors.card,
        title: const Text('Delete your account?'),
        content: Text(
            'This permanently deletes your ${CurrentSetup.brand.name} account and profile. Active '
            'bookings should be settled first. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep account')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: SColors.danger),
            child: const Text('Delete forever'),
          ),
        ],
      ),
    );
    if (yes != true || !context.mounted) return;
    final ok = await context.read<AuthProvider>().deleteAccount();
    if (!context.mounted) return;
    if (ok) {
      context.read<RoleProvider>().clear();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Could not delete the account — try again.'),
          backgroundColor: SColors.danger));
    }
  }

  Widget _tile(BuildContext context, IconData icon, String label,
          {VoidCallback? onTap}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: SSpace.sm),
        child: SCard(
          padding: const EdgeInsets.symmetric(
              horizontal: SSpace.lg, vertical: SSpace.md),
          onTap: onTap ?? () {},
          child: Row(children: [
            Icon(icon, color: SColors.ink2, size: 20),
            const SizedBox(width: SSpace.md),
            Expanded(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600))),
            const Icon(Icons.chevron_right_rounded, color: SColors.faint),
          ]),
        ),
      );
}
