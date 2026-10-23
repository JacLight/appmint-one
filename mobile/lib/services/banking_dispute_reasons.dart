/// Reason values accepted by BankingDisputesService.file on client/banking.
const bankingDisputeReasons = <String, String>{
  'unauthorized': 'I do not recognise it',
  'duplicate': 'Charged twice',
  'wrong_amount': 'Wrong amount',
  'not_received': 'Paid for something I never got',
  'cancelled_recurring': 'A recurring payment I cancelled',
  'not_as_described': 'Not as described',
  'atm_cash_not_received': 'ATM cash not received',
  'other': 'Something else',
};
