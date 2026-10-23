import 'bank_members.dart';
import 'bank_verification.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';
import '../../shared/module_states.dart';
import '../../property/property_widgets.dart' show SectionHead;
import 'account_detail_screen.dart';
import 'banking_widgets.dart';
import 'identity_screen.dart';
import 'disputes_screen.dart';
import 'move_money_screen.dart';

/// The front page of the bank: what I have, and the three things I do most.
class AccountsScreen extends StatefulWidget {
  const AccountsScreen({super.key});

  @override
  State<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends State<AccountsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final b = context.read<BankingProvider>();
      if (b.accounts.isEmpty && !b.loading) b.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = context.watch<BankingProvider>();
    final brand = CurrentSetup.brand;
    final total = b.totalAvailable;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: b.load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SSpace.lg,
                SSpace.xxl + SSpace.sm,
                SSpace.lg,
                SSpace.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    brand.name.toUpperCase(),
                    style: const TextStyle(
                      color: SColors.faint,
                      fontSize: 10.5,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SSpace.sm),
                  // Not "$0.00" when nothing was reported: a balance the app
                  // does not have is not a balance of zero.
                  Text(
                    total == null
                        ? 'Balance unavailable'
                        : Money.format(total, currency: b.currency),
                    style: TextStyle(
                      fontSize: total == null ? 22 : 38,
                      height: 1.05,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink,
                      fontFamily: brand.displayFont,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    total == null
                        ? 'Pull to try again'
                        : 'Available across ${b.accounts.length} '
                              '${b.accounts.length == 1 ? 'account' : 'accounts'}',
                    style: const TextStyle(color: SColors.muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  icon: const Icon(Icons.gavel_outlined),
                  label: const Text('My disputes'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const DisputesScreen()),
                  ),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: const Text('Banking security'),
              subtitle: const Text(
                'Authenticator enrollment and bank approval',
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BankSecurityScreen()),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.people_outline),
              title: const Text('Members and money requests'),
              subtitle: const Text(
                'Opt-in receiving and reviewed same-bank payments',
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BankMembersScreen()),
              ),
            ),
            for (final section in ['identity', 'products', 'disputes'])
              if (b.sectionError(section) != null)
                Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(
                    message: '$section: ${b.sectionError(section)}',
                    onRetry: b.load,
                  ),
                ),
            // Nothing works until the bank knows who you are, so when it
            // does not, that is the first thing on the screen — not a
            // surprise at the end of opening an account.
            if (b.identity.isNotEmpty && !b.identityVerified)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  SSpace.lg,
                  0,
                  SSpace.lg,
                  SSpace.lg,
                ),
                child: _IdentityBanner(
                  status: b.identityStatus,
                  missing: b.identityMissing.length,
                  waiting: b.accountsWaiting.length,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const IdentityScreen()),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: Row(
                children: [
                  _Action(
                    icon: Icons.north_east_rounded,
                    label: 'Send',
                    onTap: () => _move(context, MoveMode.pay),
                  ),
                  const SizedBox(width: SSpace.sm),
                  _Action(
                    icon: Icons.swap_horiz_rounded,
                    label: 'Transfer',
                    onTap: () => _move(context, MoveMode.transfer),
                  ),
                  const SizedBox(width: SSpace.sm),
                  _Action(
                    icon: Icons.south_west_rounded,
                    label: 'Add money',
                    onTap: () => _move(context, MoveMode.pull),
                  ),
                ],
              ),
            ),
            if (b.loading && b.accounts.isEmpty)
              const ModuleLoading()
            else if (b.error != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(message: b.error!, onRetry: b.load),
              )
            else if (b.accounts.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: Column(
                  children: [
                    const ModuleEmpty(
                      icon: Icons.account_balance_rounded,
                      title: 'No accounts yet',
                      body:
                          'Open one and it shows here with its balance, its '
                          'card and everything that moves through it.',
                    ),
                    if (b.products.isNotEmpty) ...[
                      const SizedBox(height: SSpace.lg),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: brand.primary,
                          padding: const EdgeInsets.symmetric(
                            horizontal: SSpace.xl,
                            vertical: SSpace.md,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(SRadius.pill),
                          ),
                        ),
                        onPressed: () => _openAccount(context),
                        child: const Text(
                          'Open an account',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
              )
            else ...[
              SectionHead(
                title: 'Accounts',
                action: b.products.isEmpty ? null : 'Open another',
                onAction: () => _openAccount(context),
              ),
              for (final a in b.accounts)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    SSpace.lg,
                    0,
                    SSpace.lg,
                    SSpace.md,
                  ),
                  child: AccountCard(
                    account: a,
                    onTap: () {
                      final id = BankingProvider.idOf(a);
                      context.read<BankingProvider>().openAccountView(
                        id,
                        known: a,
                      );
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AccountDetailScreen(),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  void _move(BuildContext context, MoveMode mode) {
    final b = context.read<BankingProvider>();
    if (b.accounts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: SColors.ink,
          content: Text('Open an account first — money has to come from one.'),
        ),
      );
      return;
    }
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => MoveMoneyScreen(mode: mode)));
  }

  /// Opening an account is the bank's own flow: pick a product, name it. The
  /// server decides whether it opens now or stays pending with gaps.
  void _openAccount(BuildContext context) {
    final b = context.read<BankingProvider>();
    final nickname = TextEditingController();
    final legalName = TextEditingController();
    final ein = TextEditingController();
    final entityType = TextEditingController();
    var business =
        b.products.isNotEmpty && b.products.first['holderType'] == 'business';
    var sending = false;
    String? formError;
    String? product = b.products.isEmpty
        ? null
        : BankingProvider.idOf(b.products.first);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SRadius.xl)),
      ),
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: EdgeInsets.only(
            left: SSpace.lg,
            right: SSpace.lg,
            top: SSpace.lg,
            bottom: MediaQuery.of(sheet).viewInsets.bottom + SSpace.lg,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Open an account',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: CurrentSetup.brand.displayFont,
                  ),
                ),
                const SizedBox(height: SSpace.lg),
                for (final p in b.products)
                  PickRow(
                    title: '${p['title'] ?? p['name'] ?? 'Account'}',
                    subtitle: '${p['summary'] ?? p['description'] ?? ''}'
                        .trim(),
                    selected: product == BankingProvider.idOf(p),
                    onTap: sending
                        ? () {}
                        : () => setSheet(() {
                            product = BankingProvider.idOf(p);
                            if (p['holderType'] == 'business') business = true;
                            if (p['holderType'] == 'individual')
                              business = false;
                          }),
                  ),
                const SizedBox(height: SSpace.md),
                TextField(
                  controller: nickname,
                  decoration: const InputDecoration(
                    labelText: 'Call it something (optional)',
                  ),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Business account'),
                  value: business,
                  onChanged: sending
                      ? null
                      : (value) => setSheet(() {
                          business = value;
                        }),
                ),
                if (business) ...[
                  TextField(
                    controller: legalName,
                    decoration: const InputDecoration(
                      labelText: 'Business legal name',
                    ),
                  ),
                  TextField(
                    controller: ein,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'EIN (optional)',
                      helperText: '9 digits',
                    ),
                  ),
                  TextField(
                    controller: entityType,
                    decoration: const InputDecoration(
                      labelText: 'Entity type (optional)',
                      helperText: 'For example LLC or corporation',
                    ),
                  ),
                  const Text(
                    'The bank verifies the business before the account opens.',
                  ),
                ],
                if (formError != null) ModuleError(message: formError!),
                const SizedBox(height: SSpace.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: CurrentSetup.brand.primary,
                      padding: const EdgeInsets.symmetric(
                        vertical: SSpace.md + 3,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                    ),
                    onPressed: product == null || sending
                        ? null
                        : () async {
                            final tax = ein.text.replaceAll('-', '').trim();
                            if (business &&
                                (legalName.text.trim().isEmpty ||
                                    (tax.isNotEmpty &&
                                        !RegExp(r'^\d{9}$').hasMatch(tax)))) {
                              setSheet(
                                () => formError =
                                    'Enter the legal business name and, if supplied, a 9-digit EIN.',
                              );
                              return;
                            }
                            setSheet(() {
                              sending = true;
                              formError = null;
                            });
                            final err = await b.openNewAccount(
                              product!,
                              nickname: nickname.text.trim(),
                              business: business
                                  ? {
                                      'legalName': legalName.text.trim(),
                                      if (tax.isNotEmpty) 'ein': tax,
                                      if (entityType.text.trim().isNotEmpty)
                                        'entityType': entityType.text.trim(),
                                    }
                                  : null,
                            );
                            if (err != null && sheet.mounted) {
                              setSheet(() {
                                sending = false;
                                formError = err;
                              });
                              return;
                            }
                            if (!sheet.mounted) return;
                            Navigator.of(sheet).pop();
                            if (err != null && context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: SColors.danger,
                                  content: Text(err),
                                ),
                              );
                            }
                          },
                    child: const Text(
                      'Open it',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Action({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: CurrentSetup.brand.primary),
            const SizedBox(height: SSpace.sm),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: SColors.ink2,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// The identity check, as a thing to tap. It says where it stands and what it
/// is holding up — a banner that only said "verify your identity" would make
/// somebody guess which of those matters today.
class _IdentityBanner extends StatelessWidget {
  final String status;
  final int missing, waiting;
  final VoidCallback onTap;
  const _IdentityBanner({
    required this.status,
    required this.missing,
    required this.waiting,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final waitingOnBank = status == 'in_review' || status == 'submitted';
    final colour = waitingOnBank ? SColors.amber : brand.primary;

    final line = waitingOnBank
        ? 'The bank is checking your details.'
        : missing > 0
        ? '$missing thing${missing == 1 ? '' : 's'} still needed'
        : 'A few details and a photo of your ID.';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(SSpace.lg),
        decoration: BoxDecoration(
          color: colour.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(SRadius.xl),
          border: Border.all(color: colour.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(
              waitingOnBank ? Icons.hourglass_top_rounded : Icons.badge_rounded,
              color: colour,
              size: 22,
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    waitingOnBank
                        ? 'Identity check underway'
                        : 'Finish your identity check',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: colour,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    waiting > 0
                        ? '$line · $waiting account${waiting == 1 ? '' : 's'} waiting'
                        : line,
                    style: const TextStyle(
                      color: SColors.ink2,
                      fontSize: 12.5,
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
            if (!waitingOnBank)
              const Icon(Icons.chevron_right_rounded, color: SColors.faint),
          ],
        ),
      ),
    );
  }
}
