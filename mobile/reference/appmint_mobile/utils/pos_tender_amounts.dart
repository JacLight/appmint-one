/// Allocate the bill and tip proportionally across split tenders. Integer cents prevent
/// rounding drift when a check is split across several tenders.
({num principal, num tip}) posTenderAmounts({
  required num gross,
  required num principalDue,
  required num tipDue,
}) {
  if (!gross.isFinite ||
      !principalDue.isFinite ||
      !tipDue.isFinite ||
      gross <= 0 ||
      principalDue < 0 ||
      tipDue < 0) {
    throw StateError('Enter a valid payment amount and tip before charging.');
  }
  final cents = (gross * 100).round();
  final baseCents = (principalDue * 100).round();
  final tipCents = (tipDue * 100).round();
  if (cents > baseCents + tipCents) {
    throw StateError(
      'Payment exceeds the remaining bill and tip. Correct the amount before charging.',
    );
  }
  final principal = (cents * baseCents / (baseCents + tipCents)).round().clamp(
    0,
    baseCents,
  );
  return (principal: principal / 100, tip: (cents - principal) / 100);
}
