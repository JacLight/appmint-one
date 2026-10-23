import 'package:provider/provider.dart';
import '../../../../providers/auth_provider.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../../services/banking_api.dart';

final bankingNavigatorKey = GlobalKey<NavigatorState>();

Future<String?> confirmBankingReview(Map<String, dynamic> review) async {
  final context = bankingNavigatorKey.currentContext;
  if (context == null) throw StateError('Banking confirmation is unavailable.');
  final generation = bankingApi.verificationGeneration;
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _BankCodeDialog(review: review, generation: generation),
  );
}

class _BankCodeDialog extends StatefulWidget {
  const _BankCodeDialog({required this.review, required this.generation});
  final Map<String, dynamic> review;
  final int generation;
  @override
  State<_BankCodeDialog> createState() => _BankCodeDialogState();
}

class _BankCodeDialogState extends State<_BankCodeDialog> {
  final code = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<AuthProvider?>();
    if (widget.generation != bankingApi.verificationGeneration)
      return AlertDialog(
        title: const Text('Your banking session changed'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      );
    final summary = widget.review['summary'];
    final amount = summary is Map ? summary['amount'] : null;
    return AlertDialog(
      title: const Text('Confirm your banking instruction'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (amount is int) Text('Amount: ${Money.format(amount)}'),
            if (summary is Map && summary['source'] != null)
              Text(summary['source'].toString()),
            if (summary is Map && summary['destination'] != null)
              Text(summary['destination'].toString()),
            if (summary is Map && summary['startsOn'] != null)
              Text('Starts ${summary['startsOn']}'),
            const Text(
              'Enter the current six-digit code from the authenticator approved by your bank. No code is sent by text or email.',
            ),
            TextField(
              controller: code,
              autofocus: true,
              keyboardType: TextInputType.number,
              maxLength: 6,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Authenticator code',
              ),
              onSubmitted: (_) => submit(),
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: busy ? null : submit,
          child: Text(busy ? 'Checking…' : 'Confirm'),
        ),
      ],
    );
  }

  Future<void> submit() async {
    if (busy) return;
    if (!RegExp(r'^\d{6}$').hasMatch(code.text.trim())) {
      setState(() => error = 'Enter all six digits.');
      return;
    }
    if (widget.generation != bankingApi.verificationGeneration) {
      if (mounted) Navigator.pop(context);
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final proof = await bankingApi.verifyBankReview(
        widget.review['challengeId'].toString(),
        code.text.trim(),
      );
      if (!mounted) return;
      if (widget.generation != bankingApi.verificationGeneration) {
        Navigator.pop(context);
        return;
      }
      Navigator.pop(context, proof);
    } catch (e) {
      if (mounted)
        setState(() {
          error = e.toString().replaceFirst('Exception: ', '');
          busy = false;
          code.clear();
        });
    }
  }
}

class BankSecurityScreen extends StatefulWidget {
  const BankSecurityScreen({super.key});
  @override
  State<BankSecurityScreen> createState() => _BankSecurityScreenState();
}

class _BankSecurityScreenState extends State<BankSecurityScreen> {
  Map<String, dynamic>? status, setup;
  final code = TextEditingController();
  bool busy = false;
  String? error;
  final generation = bankingApi.verificationGeneration;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  bool get sameSession => generation == bankingApi.verificationGeneration;
  Future<void> refresh() async {
    try {
      final result = await bankingApi.securityStatus();
      if (mounted && sameSession)
        setState(() {
          status = result;
          error = null;
        });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> act(Future<void> Function() fn) async {
    if (!sameSession) {
      setState(() => error = 'Your session changed. Reopen banking security.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await fn();
      if (sameSession) await refresh();
    } catch (e) {
      if (mounted)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<AuthProvider?>();
    if (!sameSession)
      return Scaffold(
        appBar: AppBar(title: const Text('Banking security')),
        body: const Padding(
          padding: EdgeInsets.all(20),
          child: Text('Your session changed. Reopen banking security.'),
        ),
      );
    return Scaffold(
      appBar: AppBar(title: const Text('Banking security')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          if (status == null)
            TextButton(
              onPressed: refresh,
              child: const Text('Load banking security'),
            ),
          if (status != null) ...[
            Text(status!['note']?.toString() ?? ''),
            const SizedBox(height: 16),
            Text(
              status!['approved'] == true
                  ? 'Bank-approved authenticator is ready.'
                  : status!['enrolled'] == true
                  ? 'Authenticator enrolled. Contact the bank for independent approval before using it for banking verification.'
                  : 'No authenticator is enrolled.',
            ),
            const Text(
              'Adding an authenticator also enrolls it for your account sign-in. Bank approval is a separate review. Keep your existing authenticator until any replacement is approved.',
            ),
            if (setup == null)
              FilledButton(
                onPressed: busy
                    ? null
                    : () => act(() async {
                        final result = await bankingApi.setupAuthenticator();
                        if (mounted && sameSession)
                          setState(() => setup = result);
                      }),
                child: const Text('Enroll an authenticator'),
              ),
            if (setup != null) ...[
              const Text(
                'Scan this code with your authenticator app, or enter the setup key. Keep the setup key private.',
              ),
              if (setup!['qrCode'] is String &&
                  setup!['qrCode'].toString().startsWith('data:image/'))
                Image.memory(
                  base64Decode(setup!['qrCode'].toString().split(',').last),
                  width: 220,
                  height: 220,
                ),
              SelectableText(setup!['secret']?.toString() ?? ''),
              TextField(
                controller: code,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(
                  labelText: 'Code from the new authenticator',
                ),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => act(() async {
                        await bankingApi.confirmAuthenticatorSetup(
                          code.text.trim(),
                        );
                        if (mounted && sameSession)
                          setState(() {
                            setup = null;
                            code.clear();
                          });
                      }),
                child: const Text('Confirm enrollment'),
              ),
            ],
            if (status!['approved'] == true) ...[
              const SizedBox(height: 16),
              const Text(
                'To replace the approved authenticator, enroll the new app first, then confirm the replacement with your currently approved app. If you lost it, contact the bank for recovery.',
              ),
              for (final factor
                  in (status!['factors'] as List? ?? []).whereType<Map>())
                if (factor['approved'] != true)
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => act(() async {
                            await bankingApi.rotateBankAuthenticator(
                              factor['id'].toString(),
                            );
                          }),
                    child: const Text('Use the newly enrolled authenticator'),
                  ),
            ],
          ],
        ],
      ),
    );
  }
}
