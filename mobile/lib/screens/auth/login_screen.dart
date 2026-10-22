import 'package:flutter/foundation.dart';
import '../setup_directory_screen.dart';
import 'package:flutter/material.dart';

import '../../config/environment.dart';
import '../../config/setup.dart';
import '../../widgets/brand_wordmark.dart';
import 'package:provider/provider.dart';
import '../../config/stowbo_theme.dart';
import '../../providers/auth_provider.dart';
import 'google_auth_webview.dart';
import 'magic_code_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _phone = TextEditingController();
  bool _register = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _firstName.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    final ok = _register
        ? await auth.signUp(
            email: _email.text,
            password: _password.text,
            firstName:
                _firstName.text.trim().isEmpty ? null : _firstName.text.trim(),
            phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          )
        : await auth.signIn(_email.text, _password.text);
    if (!mounted) return;
    await _afterAuthAttempt(auth, ok);
  }

  /// One landing place for every sign-in path: a challenge opens the code
  /// sheet, anything else that failed shows its error.
  Future<void> _afterAuthAttempt(AuthProvider auth, bool ok) async {
    if (ok) return;
    if (auth.needsTwoFactor) {
      await _handleTwoFactorChallenge();
      return;
    }
    if (!mounted || auth.error == null) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(auth.error!),
      backgroundColor: SColors.danger,
      behavior: SnackBarBehavior.floating,
    ));
  }

  /// Collect the verification code the server just sent.
  ///
  /// Stays open on a wrong code — the challenge is still alive. Cancelling
  /// drops it and returns to the form.
  Future<void> _handleTwoFactorChallenge() async {
    final auth = context.read<AuthProvider>();
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _VerificationDialog(auth: auth, sentTo: _email.text.trim()),
    );
  }

  Future<void> _handleGoogle() async {
    final code = await Navigator.push<String?>(
      context,
      MaterialPageRoute(builder: (_) => const GoogleAuthWebView()),
    );
    if (!mounted || code == null || code.isEmpty) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.googleExchange(code);
    if (!mounted) return;
    await _afterAuthAttempt(auth, ok);
  }

  Future<void> _handleSocial(Future<bool> Function() signIn) async {
    final auth = context.read<AuthProvider>();
    final ok = await signIn();
    if (!mounted) return;
    await _afterAuthAttempt(auth, ok);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      backgroundColor: SColors.paper,
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
              SSpace.xl, SSpace.xxl, SSpace.xl, SSpace.xl),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    // 36 * 1.15 renders at roughly the 42 the asset used.
                    const BrandWordmark(size: 36),
                    const Spacer(),
                    // Reachable before sign-in on purpose: on a demo build the
                    // switcher is the point of the install, and burying it
                    // behind the account screen puts it behind an auth wall.
                    if (CurrentSetup.switchable)
                      TextButton.icon(
                        onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const SetupDirectoryScreen())),
                        icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                        label: const Text('Switch'),
                      ),
                  ],
                ),
                const SizedBox(height: SSpace.xxl),
                Text(_register ? 'Create account' : 'Welcome back',
                    style: Theme.of(context).textTheme.displayLarge),
                const SizedBox(height: 6),
                Text(
                  _register
                      ? (CurrentSetup.brand.tagline ?? 'Create your account.')
                      : 'Sign in to continue.',
                  style: const TextStyle(color: SColors.muted, fontSize: 15),
                ),
                const SizedBox(height: SSpace.lg),
                // Without an app credential there is no app token, so every
                // sign-in fails with whatever the server says about an empty
                // bearer. Say the real reason instead of letting someone
                // retype their password at a wall.
                if (EnvironmentConfig.appSecret.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(SSpace.md),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9EEDA),
                      borderRadius: BorderRadius.circular(SRadius.md),
                      border: Border.all(color: SColors.amber, width: 0.8),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline_rounded,
                            size: 18, color: SColors.amber),
                        SizedBox(width: SSpace.sm),
                        Expanded(
                          child: Text(
                            'This build has no app credential, so sign-in '
                            'cannot reach the server. Add config/local.json '
                            'and rebuild.',
                            style: TextStyle(
                                color: SColors.ink2,
                                height: 1.35,
                                fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                // The way in for somebody who just wants to see the app.
                // A demo whose first screen is a password box has already
                // failed: nothing on it says what the product does.
                if (CurrentSetup.switchable && !_register) ...[
                  const SizedBox(height: SSpace.xl),
                  _QuickStart(
                    onExplore: () => context.read<AuthProvider>().explore(),
                    onDemoSignIn: EnvironmentConfig.hasDemoAccount
                        ? () {
                            _email.text = EnvironmentConfig.demoEmail;
                            _password.text = EnvironmentConfig.demoPassword;
                            _submit();
                          }
                        : null,
                  ),
                  const SizedBox(height: SSpace.xl),
                  Row(
                    children: const [
                      Expanded(child: Divider(color: SColors.line)),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: SSpace.md),
                        child: Text('or sign in',
                            style: TextStyle(
                                color: SColors.faint, fontSize: 12.5)),
                      ),
                      Expanded(child: Divider(color: SColors.line)),
                    ],
                  ),
                ],
                const SizedBox(height: SSpace.xxl),
                if (_register) ...[
                  _SoftField(
                    label: 'First name',
                    controller: _firstName,
                    icon: Icons.person_outline_rounded,
                  ),
                  const SizedBox(height: SSpace.md),
                ],
                _SoftField(
                  label: 'Email',
                  controller: _email,
                  icon: Icons.mail_outline_rounded,
                  keyboard: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Enter your email';
                    if (!v.contains('@')) return 'Enter a valid email';
                    return null;
                  },
                ),
                const SizedBox(height: SSpace.md),
                if (_register) ...[
                  _SoftField(
                    label: 'Phone (optional)',
                    controller: _phone,
                    icon: Icons.phone_outlined,
                    keyboard: TextInputType.phone,
                  ),
                  const SizedBox(height: SSpace.md),
                ],
                _SoftField(
                  label: 'Password',
                  controller: _password,
                  icon: Icons.lock_outline_rounded,
                  obscure: _obscure,
                  trailing: IconButton(
                    icon: Icon(
                        _obscure
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded,
                        color: SColors.muted,
                        size: 20),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter your password';
                    if (_register && v.length < 6) {
                      return 'At least 6 characters';
                    }
                    return null;
                  },
                ),
                if (!_register) ...[
                  const SizedBox(height: SSpace.sm),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 32),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                      child: const Text('Forgot password?',
                          style: TextStyle(
                              color: SColors.ink2,
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
                const SizedBox(height: SSpace.xl),
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: auth.busy ? null : _submit,
                    child: auth.busy
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2.4))
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(_register ? 'Create account' : 'Sign in'),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded, size: 20),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: SSpace.lg),
                // ── alternative sign-in methods ──────────────────────────
                Row(children: const [
                  Expanded(child: Divider(color: SColors.line)),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: SSpace.md),
                    child: Text('or', style: TextStyle(color: SColors.faint)),
                  ),
                  Expanded(child: Divider(color: SColors.line)),
                ]),
                const SizedBox(height: SSpace.lg),
                if (auth.appleAvailable) ...[
                  _SocialButton(
                    icon: Icons.apple_rounded,
                    label: 'Continue with Apple',
                    onTap: auth.busy
                        ? null
                        : () => _handleSocial(auth.signInWithApple),
                  ),
                  const SizedBox(height: SSpace.sm),
                ],
                _SocialButton(
                  icon: Icons.g_mobiledata_rounded,
                  label: 'Continue with Google',
                  onTap: auth.busy ? null : _handleGoogle,
                ),
                const SizedBox(height: SSpace.sm),
                _SocialButton(
                  icon: Icons.facebook_rounded,
                  label: 'Continue with Facebook',
                  iconColor: const Color(0xFF1877F2),
                  onTap: auth.busy
                      ? null
                      : () => _handleSocial(auth.signInWithFacebook),
                ),
                const SizedBox(height: SSpace.sm),
                _SocialButton(
                  icon: Icons.password_rounded,
                  label: 'Sign in with a code',
                  onTap: auth.busy
                      ? null
                      : () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => MagicCodeScreen(email: _email.text)),
                          ),
                ),
                const SizedBox(height: SSpace.lg),
                Center(
                  child: TextButton(
                    onPressed: auth.busy
                        ? null
                        : () => setState(() => _register = !_register),
                    child: Text.rich(TextSpan(children: [
                      TextSpan(
                        text: _register
                            ? 'Already have an account?  '
                            : 'New to ${CurrentSetup.brand.name}?  ',
                        style: const TextStyle(color: SColors.muted),
                      ),
                      TextSpan(
                        text: _register ? 'Sign in' : 'Create one',
                        style: const TextStyle(
                            color: SColors.clay, fontWeight: FontWeight.w700),
                      ),
                    ])),
                  ),
                ),
                if (!kReleaseMode) ...[
                  const SizedBox(height: SSpace.xs),
                  Center(
                    child: TextButton.icon(
                      onPressed: auth.busy
                          ? null
                          : () => context.read<AuthProvider>().devSignIn(),
                      icon: const Icon(Icons.bolt_rounded,
                          color: SColors.green, size: 18),
                      label: const Text('Fast sign in (dev)',
                          style: TextStyle(
                              color: SColors.green,
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// HaHo-style soft input: floating label above the value, filled card surface,
/// rounded, leading icon, optional trailing widget.
class _SoftField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboard;
  final Widget? trailing;
  final String? Function(String?)? validator;

  const _SoftField({
    required this.label,
    required this.controller,
    required this.icon,
    this.obscure = false,
    this.keyboard,
    this.trailing,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SColors.card,
        borderRadius: BorderRadius.circular(SRadius.lg),
        border: Border.all(color: SColors.line, width: 1.2),
        boxShadow: SShadow.soft,
      ),
      padding: const EdgeInsets.fromLTRB(SSpace.lg, 10, SSpace.sm, 6),
      child: Row(
        children: [
          Icon(icon, color: SColors.muted, size: 22),
          const SizedBox(width: SSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        color: SColors.faint,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
                TextFormField(
                  controller: controller,
                  obscureText: obscure,
                  keyboardType: keyboard,
                  style: const TextStyle(
                      color: SColors.ink,
                      fontSize: 16,
                      fontWeight: FontWeight.w600),
                  cursorColor: SColors.clay,
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                    filled: false,
                    hintText: '',
                  ),
                  validator: validator,
                ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

class _SocialButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? iconColor;
  final VoidCallback? onTap;
  const _SocialButton(
      {required this.icon, required this.label, this.iconColor, this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: SColors.line, width: 1.6),
          backgroundColor: SColors.card,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: iconColor ?? SColors.ink, size: 24),
            const SizedBox(width: 10),
            Text(label,
                style: const TextStyle(
                    color: SColors.ink,
                    fontWeight: FontWeight.w600,
                    fontSize: 15)),
          ],
        ),
      ),
    );
  }
}


/// The code step of a challenged sign-in.
///
/// A widget rather than a closure because the controller has to live exactly as
/// long as the dialog: the provider notifies again while the dialog is playing
/// its exit animation, and a controller disposed the moment `showDialog`
/// returned would be read after disposal.
class _VerificationDialog extends StatefulWidget {
  final AuthProvider auth;
  final String sentTo;
  const _VerificationDialog({required this.auth, required this.sentTo});

  @override
  State<_VerificationDialog> createState() => _VerificationDialogState();
}

class _VerificationDialogState extends State<_VerificationDialog> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _send(BuildContext context, String? method, String ok) async {
    final messenger = ScaffoldMessenger.of(context);
    final sent = await widget.auth.resendTwoFactorCode(method: method);
    messenger.showSnackBar(
      SnackBar(content: Text(sent ? ok : 'Could not send the code')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final busy = auth.busy;
    final method = widget.auth.twoFactorMethod ?? 'email';
    final isApp = method == 'authenticator';
    final where = switch (method) {
      'sms' => 'sent by text',
      'authenticator' => 'in your authenticator app',
      _ => 'sent to ${widget.sentTo}',
    };

    return AlertDialog(
      title: const Text('Verification required'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('Enter the 6-digit code $where.'),
        const SizedBox(height: 16),
        TextField(
          controller: _code,
          autofocus: true,
          enabled: !busy,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          decoration: const InputDecoration(
            hintText: '000000',
            counterText: '',
            border: OutlineInputBorder(),
          ),
        ),
        if (auth.error != null) ...[
          const SizedBox(height: 12),
          Text(auth.error!, style: const TextStyle(color: SColors.danger)),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: Wrap(children: [
            // An authenticator code is generated on the device — nothing to resend.
            if (!isApp)
              TextButton(
                onPressed: busy ? null : () => _send(context, null, 'Code sent again'),
                child: const Text('Send it again'),
              ),
            // The way out when the default factor is an app on a phone that is
            // lost, dead or elsewhere. Any enrolled factor can answer the
            // challenge, so this only changes how the code arrives.
            if (method != 'email')
              TextButton(
                onPressed: busy
                    ? null
                    : () => _send(context, 'email', 'Code sent to your email'),
                child: const Text('Email me a code instead'),
              ),
          ]),
        ),
      ]),
      actions: [
        TextButton(
          onPressed: busy
              ? null
              : () {
                  widget.auth.cancelTwoFactor();
                  Navigator.pop(context);
                },
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: busy
              ? null
              : () async {
                  final code = _code.text.trim();
                  if (code.length != 6) return;
                  final navigator = Navigator.of(context);
                  final ok = await widget.auth.verifyTwoFactor(code);
                  if (ok) navigator.pop();
                },
          child: busy
              ? const SizedBox(
                  width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Verify'),
        ),
      ],
    );
  }
}

/// Two ways past the sign-in form on a demo build.
///
/// "Look around" mints no token and stores nothing — it unlocks this app's own
/// screens and nothing else, so every server read still goes out as the app
/// alone and anything needing a person says so where it needs it. The second
/// button only exists when the build was given a demo account to use.
class _QuickStart extends StatelessWidget {
  final VoidCallback onExplore;
  final VoidCallback? onDemoSignIn;
  const _QuickStart({required this.onExplore, this.onDemoSignIn});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;

    return Container(
      padding: const EdgeInsets.all(SSpace.lg),
      decoration: BoxDecoration(
        color: brand.accent.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(SRadius.xl),
        border: Border.all(color: brand.accent.withValues(alpha: 0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, size: 18, color: brand.accent),
              const SizedBox(width: SSpace.sm),
              Text('Just want to see it?',
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    color: SColors.ink,
                    fontFamily: brand.displayFont,
                  )),
            ],
          ),
          const SizedBox(height: SSpace.xs + 2),
          Text(
            'Go straight in and look around ${CurrentSetup.brand.name}. '
            'Anything that saves something will ask you to sign in first.',
            style: const TextStyle(
                color: SColors.ink2, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: SSpace.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: brand.primary,
                padding: const EdgeInsets.symmetric(vertical: SSpace.md + 3),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              onPressed: onExplore,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: const Text('Try it now',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          if (onDemoSignIn != null) ...[
            const SizedBox(height: SSpace.sm),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: brand.primary,
                  side: BorderSide(color: brand.primary.withValues(alpha: 0.5)),
                  padding: const EdgeInsets.symmetric(vertical: SSpace.md),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(SRadius.pill)),
                ),
                onPressed: onDemoSignIn,
                icon: const Icon(Icons.person_rounded, size: 17),
                label: const Text('Sign in as the demo account',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
