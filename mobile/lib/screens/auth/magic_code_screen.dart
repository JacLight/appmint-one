import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../providers/auth_provider.dart';

/// Passwordless login: enter email → receive a 6-digit code → verify.
///
/// [email] carries over whatever was already typed on the sign-in screen.
/// Asking for it a second time is the kind of thing that makes an app feel
/// careless, so when it arrives filled in the code is sent straight away and
/// this opens on the code step.
class MagicCodeScreen extends StatefulWidget {
  final String? email;
  const MagicCodeScreen({super.key, this.email});
  @override
  State<MagicCodeScreen> createState() => _MagicCodeScreenState();
}

class _MagicCodeScreenState extends State<MagicCodeScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  bool _sent = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    final carried = widget.email?.trim() ?? '';
    if (carried.isEmpty) return;
    _email.text = carried;
    if (!carried.contains('@')) return;
    // Already a usable address — send the code without making them ask twice.
    WidgetsBinding.instance.addPostFrameCallback((_) => _send());
  }

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final auth = context.read<AuthProvider>();
    if (!_email.text.contains('@')) {
      _toast('Enter a valid email');
      return;
    }
    if (_sending) return;
    setState(() => _sending = true);
    final ok = await auth.sendMagicCode(_email.text);
    if (!mounted) return;
    setState(() => _sending = false);
    if (ok) {
      setState(() => _sent = true);
      _toast('Code sent to ${_email.text.trim()}');
    } else {
      _toast(auth.error ?? 'Could not send code');
    }
  }

  Future<void> _verify() async {
    final auth = context.read<AuthProvider>();
    if (_code.text.trim().length < 4) {
      _toast('Enter the code');
      return;
    }
    final ok = await auth.verifyMagicCode(_email.text, _code.text);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context); // RootScreen shows the app once authenticated
    } else {
      _toast(auth.error ?? 'Invalid or expired code');
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(m), behavior: SnackBarBehavior.floating));

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in with a code')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(SSpace.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_sent ? 'Enter your code' : 'Passwordless sign-in',
                style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(
              _sent
                  ? 'We sent a 6-digit code to ${_email.text.trim()}.'
                  : "We'll email you a 6-digit code — no password needed.",
              style: const TextStyle(color: SColors.muted),
            ),
            const SizedBox(height: SSpace.xl),
            TextField(
              controller: _email,
              enabled: !_sent,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
            ),
            if (_sent) ...[
              const SizedBox(height: SSpace.md),
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                autofocus: true,
                style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 8),
                decoration: const InputDecoration(hintText: '000000'),
              ),
            ],
            const SizedBox(height: SSpace.xl),
            SizedBox(
              height: 54,
              child: ElevatedButton(
                onPressed: auth.busy ? null : (_sent ? _verify : _send),
                child: auth.busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.4))
                    : Text(_sent ? 'Verify & sign in' : 'Send code'),
              ),
            ),
            if (_sent) ...[
              const SizedBox(height: SSpace.sm),
              TextButton(
                onPressed: auth.busy ? null : _send,
                child: const Text('Resend code',
                    style: TextStyle(color: SColors.clay)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
