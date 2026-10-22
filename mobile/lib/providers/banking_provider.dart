import 'package:flutter/foundation.dart';

import '../services/banking_api.dart';

/// The customer's bank: accounts, money movement, payees, cards, disputes.
///
/// One provider for the module because these are one relationship — a card
/// belongs to an account, a payment comes out of one, a dispute hangs off a
/// transaction on one. Splitting them would mean screens stitching state back
/// together.
class BankingProvider extends ChangeNotifier {
  final BankingApi _api = bankingApi;

  List<Map<String, dynamic>> _accounts = const [];
  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _payees = const [];
  List<Map<String, dynamic>> _disputes = const [];
  bool _loading = false;
  String? _error;

  // One account, opened.
  String? _openId;
  Map<String, dynamic> _open = const {};
  List<String> _gaps = const [];
  List<Map<String, dynamic>> _transactions = const [];
  List<Map<String, dynamic>> _statements = const [];
  List<Map<String, dynamic>> _cards = const [];
  bool _openLoading = false;
  String? _openError;

  bool _busy = false;

  List<Map<String, dynamic>> get accounts => _accounts;
  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get payees => _payees;
  List<Map<String, dynamic>> get disputes => _disputes;
  bool get loading => _loading;
  String? get error => _error;

  Map<String, dynamic> get open => _open;

  /// What a pending account still needs before it opens. The server's words,
  /// not ours — it is the only thing worth showing somebody who is waiting.
  List<String> get gaps => _gaps;
  List<Map<String, dynamic>> get transactions => _transactions;
  List<Map<String, dynamic>> get statements => _statements;
  List<Map<String, dynamic>> get cards => _cards;
  bool get openLoading => _openLoading;
  String? get openError => _openError;
  bool get busy => _busy;

  /// Payees that can actually be paid: verification done.
  List<Map<String, dynamic>> get verifiedPayees => [
        for (final p in _payees)
          if ('${p['status'] ?? ''}'.toLowerCase() == 'verified' ||
              p['verified'] == true)
            p,
      ];

  /// Everything spendable across open accounts, in cents. Null when no
  /// account reported a balance — which is not the same as zero, and must
  /// never be shown as "$0.00".
  int? get totalAvailable {
    var found = false;
    var sum = 0;
    for (final a in _accounts) {
      final b = a['balances'];
      if (b is! Map) continue;
      final available = b['available'];
      if (available is num) {
        found = true;
        sum += available.round();
      }
    }
    return found ? sum : null;
  }

  String get currency {
    for (final a in _accounts) {
      final b = a['balances'];
      if (b is Map && b['currency'] != null) return '${b['currency']}';
      if (a['currency'] != null) return '${a['currency']}';
    }
    return 'USD';
  }

  static String idOf(Map<String, dynamic> record) =>
      '${record['sk'] ?? record['id'] ?? ''}';

  // ── Identity ────────────────────────────────────────────────────────────

  Map<String, dynamic> _identity = const {};
  bool _identityLoading = false;
  String? _identityError;

  Map<String, dynamic> get identity => _identity;
  bool get identityLoading => _identityLoading;
  String? get identityError => _identityError;

  String get identityStatus => '${_identity['status'] ?? ''}';
  bool get identityVerified => identityStatus == 'verified';
  bool get identityCanEdit => _identity['canEdit'] != false;

  /// The bank's own words for what it still needs. Never re-phrased.
  List<String> get identityMissing {
    final raw = _identity['missing'];
    return raw is List ? [for (final m in raw) '$m'] : const [];
  }

  /// Accounts that cannot open until the check clears.
  List<Map<String, dynamic>> get accountsWaiting {
    final raw = _identity['accountsWaiting'];
    if (raw is! List) return const [];
    return [
      for (final a in raw)
        if (a is Map) Map<String, dynamic>.from(a),
    ];
  }

  /// Set when the bank has asked for something specific.
  Map<String, dynamic>? get identityRequest {
    final r = _identity['requestedInfo'];
    return r is Map ? Map<String, dynamic>.from(r) : null;
  }

  Map<String, dynamic> get identityDetails {
    final d = _identity['details'];
    return d is Map ? Map<String, dynamic>.from(d) : const {};
  }

  Future<void> loadIdentity() async {
    _identityLoading = true;
    _identityError = null;
    notifyListeners();
    try {
      _identity = await _api.identity();
      _identityError = null;
    } catch (e) {
      _identityError = _say(e);
    } finally {
      _identityLoading = false;
      notifyListeners();
    }
  }

  Future<String?> submitIdentity(Map<String, dynamic> body) => _act(() async {
        _identity = await _api.submitIdentity(body);
        // An approved check opens the accounts that were waiting on it.
        await load();
      });

  Future<String?> attachIdentityDocument({
    required String kind,
    required String path,
    String? documentType,
  }) =>
      _act(() async {
        await _api.attachIdentityDocument(
            kind: kind, path: path, documentType: documentType);
        await loadIdentity();
      });

  // ── Loans ───────────────────────────────────────────────────────────────
  //
  // Lending is its own relationship with the bank, but not its own app: a loan
  // pays into a deposit account and is paid from one, so it belongs on the
  // provider that already holds those accounts.
  //
  // Nothing here decides what the borrower may do. The server sends an
  // `actions` map on every application and loan, and the screens read it —
  // re-deriving "can I withdraw this" from a status string would be a second
  // rulebook that drifts from the bank's.

  List<Map<String, dynamic>> _loans = const [];
  List<Map<String, dynamic>> _applications = const [];
  List<Map<String, dynamic>> _loanProducts = const [];
  bool _loansLoading = false;
  String? _loansError;

  String? _loanId;
  Map<String, dynamic> _loan = const {};
  Map<String, dynamic> _payoff = const {};
  bool _loanLoading = false;
  String? _loanError;

  List<Map<String, dynamic>> get loans => _loans;
  List<Map<String, dynamic>> get applications => _applications;
  List<Map<String, dynamic>> get loanProducts => _loanProducts;
  bool get loansLoading => _loansLoading;
  String? get loansError => _loansError;

  Map<String, dynamic> get loan => _loan;
  bool get loanLoading => _loanLoading;
  String? get loanError => _loanError;

  /// Today's payoff figure. Empty when the loan has no quote — a loan that is
  /// booked but not yet paid out has nothing to pay off, and the server
  /// refuses the quote rather than answering zero. That refusal is an answer,
  /// so it is not kept as an error.
  Map<String, dynamic> get payoff => _payoff;

  /// Products that can be applied for in the app. A secured loan is applied
  /// for at a branch so a loan officer can record what secures it; the server
  /// says which with `canApplyOnline`, and the reason in `note`.
  List<Map<String, dynamic>> get applyableLoanProducts => [
        for (final p in _loanProducts)
          if (p['canApplyOnline'] != false) p,
      ];

  /// An offer the bank has made that is waiting on an answer. Surfaced because
  /// it expires, and somebody should not have to open each application to find
  /// out that one of them needs them.
  List<Map<String, dynamic>> get counteroffersPending => [
        for (final a in _applications)
          if (a['counterofferPending'] == true) a,
      ];

  /// Loans behind on payment, by the server's own count of days.
  List<Map<String, dynamic>> get pastDueLoans => [
        for (final l in _loans)
          if ((l['daysPastDue'] is num ? l['daysPastDue'] as num : 0) > 0) l,
      ];

  /// Everything owed across loans, in cents. Null when no loan reported a
  /// figure — which is not zero, and must never be shown as "$0.00".
  int? get totalOwed {
    var found = false;
    var sum = 0;
    for (final l in _loans) {
      final owed = l['owed'];
      if (owed is num) {
        found = true;
        sum += owed.round();
      }
    }
    return found ? sum : null;
  }

  /// `{total, data[]}` as a list.
  static List<Map<String, dynamic>> _page(Map<String, dynamic> res) {
    final rows = res['data'];
    if (rows is! List) return const [];
    return [
      for (final r in rows)
        if (r is Map) Map<String, dynamic>.from(r),
    ];
  }

  Future<void> loadLoans() async {
    _loansLoading = true;
    _loansError = null;
    notifyListeners();
    try {
      _loans = _page(await _api.myLoans());
      _loansError = null;
    } catch (e) {
      _loansError = _say(e);
    } finally {
      _loansLoading = false;
      notifyListeners();
    }

    // Secondary, on the same rule as the accounts list: a loans list that
    // loaded should draw even when applications or products are unavailable.
    for (final read in [
      () async => _applications = _page(await _api.loanApplications()),
      () async => _loanProducts = await _api.loanProducts(),
    ]) {
      try {
        await read();
        notifyListeners();
      } catch (_) {}
    }
  }

  Future<void> openLoanView(String id, {Map<String, dynamic>? known}) async {
    _loanId = id;
    _loan = known ?? const {};
    _payoff = const {};
    _loanLoading = true;
    _loanError = null;
    notifyListeners();

    try {
      _loan = await _api.loan(id);
      _loanError = null;
    } catch (e) {
      if (_loan.isEmpty) _loanError = _say(e);
    }

    try {
      _payoff = await _api.payoffQuote(id);
    } catch (_) {
      _payoff = const {};
    }

    _loanLoading = false;
    notifyListeners();
  }

  Future<void> refreshLoan() async {
    final id = _loanId;
    if (id != null) await openLoanView(id, known: _loan);
  }

  /// One application, read fresh. Returned rather than stored: an application
  /// is opened, read and left, and holding the last one opened would have the
  /// screen draw the previous application for a frame.
  Future<Map<String, dynamic>> loanApplication(String id) =>
      _api.loanApplication(id);

  Future<String?> applyForLoan({
    required String product,
    required int amountCents,
    required int termMonths,
    required String purpose,
    required int grossMonthlyCents,
    required String linkedAccount,
    String? incomeSource,
    Map<String, dynamic>? employment,
    int? housingPaymentCents,
  }) =>
      _act(() async {
        await _api.applyForLoan(
          product: product,
          amountCents: amountCents,
          termMonths: termMonths,
          purpose: purpose,
          grossMonthlyCents: grossMonthlyCents,
          linkedAccount: linkedAccount,
          incomeSource: incomeSource,
          employment: employment,
          housingPaymentCents: housingPaymentCents,
        );
        await loadLoans();
      });

  Future<String?> withdrawApplication(String id, {String? reason}) =>
      _act(() async {
        await _api.withdrawLoanApplication(id, reason: reason);
        await loadLoans();
      });

  Future<String?> answerCounteroffer(String id, {required bool accept}) =>
      _act(() async {
        await _api.answerCounteroffer(id, accept: accept);
        await loadLoans();
      });

  /// Pay a loan from a deposit account. Both sides move, so both are reloaded:
  /// the loan's balance and the account the money left.
  Future<String?> payLoan({
    required String loanId,
    required int amountCents,
    required String fromAccount,
  }) =>
      _act(() async {
        await _api.payLoan(loanId,
            amountCents: amountCents, fromAccount: fromAccount);
        await load();
        await refreshLoan();
        await loadLoans();
      });

  // ── Loading ─────────────────────────────────────────────────────────────

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _accounts = await _api.accounts();
      _error = null;
    } catch (e) {
      _error = _say(e);
    } finally {
      _loading = false;
      notifyListeners();
    }

    // Everything else is secondary: an account list that loaded should draw
    // even if payees or products are unavailable.
    for (final read in [
      () async => _identity = await _api.identity(),
      () async => _payees = await _api.payees(),
      () async => _products = await _api.products(),
      () async => _disputes = await _api.disputes(),
    ]) {
      try {
        await read();
        notifyListeners();
      } catch (_) {}
    }
  }

  Future<void> openAccountView(String id, {Map<String, dynamic>? known}) async {
    _openId = id;
    _open = known ?? const {};
    _gaps = const [];
    _transactions = const [];
    _statements = const [];
    _cards = const [];
    _openLoading = true;
    _openError = null;
    notifyListeners();

    try {
      final res = await _api.account(id);
      // A pending account answers {account, gaps}; an open one answers the
      // account view itself.
      final account = res['account'];
      if (account is Map) {
        _open = _flat(Map<String, dynamic>.from(account));
        final gaps = res['gaps'];
        _gaps = gaps is List ? [for (final g in gaps) '$g'] : const [];
      } else {
        _open = _flat(res);
      }
      _openError = null;
    } catch (e) {
      if (_open.isEmpty) _openError = _say(e);
    }

    try {
      final page = await _api.transactions(id);
      final rows = page['data'];
      _transactions = rows is List
          ? [
              for (final r in rows)
                if (r is Map) _flat(Map<String, dynamic>.from(r)),
            ]
          : const [];
    } catch (_) {}
    try {
      _cards = await _api.cards(id);
    } catch (_) {}
    try {
      _statements = await _api.statements(id);
    } catch (_) {}

    _openLoading = false;
    notifyListeners();
  }

  Future<void> refreshOpen() async {
    final id = _openId;
    if (id != null) await openAccountView(id, known: _open);
  }

  static Map<String, dynamic> _flat(Map<String, dynamic> row) {
    final data = row['data'];
    if (data is! Map) return row;
    final flat = <String, dynamic>{...row}..remove('data');
    flat.addAll(Map<String, dynamic>.from(data));
    for (final k in ['sk', 'createdate']) {
      if (row[k] != null) flat[k] = row[k];
    }
    return flat;
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  //
  // Each returns null when it worked, or the server's message when it did
  // not. Screens show that message; none of them invent one.

  Future<String?> _act(Future<void> Function() run) async {
    _busy = true;
    notifyListeners();
    try {
      await run();
      return null;
    } catch (e) {
      return _say(e);
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<String?> openNewAccount(String product, {String? nickname}) =>
      _act(() async {
        await _api.openAccount(product: product, nickname: nickname);
        await load();
      });

  Future<String?> rename(String id, String nickname) => _act(() async {
        await _api.rename(id, nickname);
        await load();
        await refreshOpen();
      });

  Future<String?> setOverdraft(String id, bool optedIn) => _act(() async {
        await _api.setOverdraft(id, optedIn);
        await refreshOpen();
      });

  Future<String?> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
  }) =>
      _act(() async {
        await _api.transfer(
          from: from,
          toAccountNumber: toAccountNumber,
          amountCents: amountCents,
          memo: memo,
        );
        await load();
        await refreshOpen();
      });

  Future<String?> pay({
    required String account,
    required String counterparty,
    required String rail,
    required int amountCents,
    bool sameDay = false,
    String? memo,
  }) =>
      _act(() async {
        await _api.pay(
          account: account,
          counterparty: counterparty,
          rail: rail,
          amountCents: amountCents,
          sameDay: sameDay,
          memo: memo,
        );
        await load();
        await refreshOpen();
      });

  Future<String?> pull({
    required String account,
    required String counterparty,
    required int amountCents,
  }) =>
      _act(() async {
        await _api.pull(
            account: account,
            counterparty: counterparty,
            amountCents: amountCents);
        await load();
        await refreshOpen();
      });

  Future<String?> cancelTransaction(String id) => _act(() async {
        await _api.cancel(id);
        await refreshOpen();
      });

  Future<String?> addPayee(Map<String, dynamic> payee) => _act(() async {
        await _api.addPayee(payee);
        _payees = await _api.payees();
      });

  Future<String?> removePayee(String id) => _act(() async {
        await _api.removePayee(id);
        _payees = await _api.payees();
      });

  Future<String?> startMicroDeposits(String id) => _act(() async {
        await _api.startMicroDeposits(id);
        _payees = await _api.payees();
      });

  Future<String?> confirmMicroDeposits(String id, List<int> amounts) =>
      _act(() async {
        await _api.confirmMicroDeposits(id, amounts);
        _payees = await _api.payees();
      });

  Future<String?> orderCard(String accountId,
          {required String form, Map<String, dynamic>? shipping}) =>
      _act(() async {
        await _api.orderCard(accountId, form: form, shipping: shipping);
        await refreshOpen();
      });

  Future<String?> activateCard(String cardId, String last4) => _act(() async {
        await _api.activateCard(cardId, last4);
        await refreshOpen();
      });

  Future<String?> setCardLocked(String cardId, bool locked) => _act(() async {
        if (locked) {
          await _api.lockCard(cardId);
        } else {
          await _api.unlockCard(cardId);
        }
        await refreshOpen();
      });

  Future<String?> setCardControls(
          String cardId, Map<String, dynamic> controls) =>
      _act(() async {
        await _api.setControls(cardId, controls);
        await refreshOpen();
      });

  Future<String?> replaceCard(String cardId, String why) => _act(() async {
        await _api.replaceCard(cardId, why: why);
        await refreshOpen();
      });

  Future<String?> fileDispute({
    required String transaction,
    required String reason,
    required String description,
    int? amountCents,
  }) =>
      _act(() async {
        await _api.fileDispute(
          transaction: transaction,
          reason: reason,
          description: description,
          amountCents: amountCents,
        );
        _disputes = await _api.disputes();
      });

  String _say(Object e) => e.toString().replaceAll('Exception: ', '');
}
