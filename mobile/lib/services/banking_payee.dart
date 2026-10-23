/// Payee lifecycle status (active/disabled) is separate from verification.
String payeeVerificationStatus(Map<String, dynamic> payee) {
  if (payee['status'] == 'disabled') return 'disabled';
  final verification = payee['verification'];
  if (verification is Map && verification['status'] != null) {
    return '${verification['status']}'.toLowerCase();
  }
  // Older cached records used a flat verified flag/status.
  if (payee['verified'] == true) return 'verified';
  return '${payee['status'] ?? 'unverified'}'.toLowerCase();
}

bool payeeIsVerified(Map<String, dynamic> payee) =>
    payeeVerificationStatus(payee) == 'verified';

/// Only the server's public last four digits belong in the picker/list.
String payeeAccountLabel(Map<String, dynamic> payee) {
  final last4 = '${payee['accountLast4'] ?? ''}';
  return RegExp(r'^[0-9]{4}$').hasMatch(last4) ? '•••• $last4' : '';
}
