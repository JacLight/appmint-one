import 'package:mek_stripe_terminal/mek_stripe_terminal.dart';

String terminalBatteryLabel(double? level) {
  if (level == null || !level.isFinite || level < 0 || level > 1) return '';
  return '  •  ${(level * 100).round()}% battery';
}

String terminalErrorMessage(Object error) {
  if (error is TerminalException) {
    if (error.code == TerminalExceptionCode.readerBatteryCriticallyLow) {
      return 'The reader battery is too low to connect. Plug it into a charger, '
          'leave it powered on, then try again.';
    }
    // toString() includes native stack traces, payment objects and API details.
    return error.message.trim().isEmpty
        ? 'The card reader could not connect. Try again.'
        : error.message.split('\n').first;
  }
  return error.toString().replaceFirst('Exception: ', '').split('\n').first;
}
