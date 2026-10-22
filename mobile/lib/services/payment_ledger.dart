/// A completed charge remains part of gross collections after a refund; its
/// separate refund row subtracts the returned amount. Cancelled/failed requests
/// never represent money received.
bool isCollectedPayment(Map<String, dynamic> row) =>
    row['pending'] != true &&
    const ['paid', 'succeeded', 'refunded'].contains(row['status']);

double collectedPaymentTotal(Iterable<Map<String, dynamic>> rows) => rows
    .where(isCollectedPayment)
    .fold(0.0, (total, row) {
      final amount = double.tryParse('${row['amount']}') ?? 0;
      return total + (row['kind'] == 'refund' ? -amount : amount);
    });
