import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../services/banking_api.dart';
import '../services/banking_payee.dart';
import '../services/storage_service.dart';

class _MoneyDeclined implements Exception {
  final String message;
  _MoneyDeclined(this.message);
  @override
  String toString() => message;
}

/// The customer's bank: accounts, money movement, payees, cards, disputes.
///
/// One provider for the module because these are one relationship — a card
/// belongs to an account, a payment comes out of one, a dispute hangs off a
/// transaction on one. Splitting them would mean screens stitching state back
/// together.
class BankingProvider extends ChangeNotifier {
  BankingProvider({BankingApi? api, StorageService? storage})
    : _api = api ?? bankingApi,
      _storage = storage ?? storageService;

  final BankingApi _api;
  final StorageService _storage;
  int _accountRequest = 0;
  int _loanRequest = 0;
  int _listRequest = 0;
  int _loansListRequest = 0;
  int _identityRequest = 0;
  int _activeActions = 0;
  int _transactionsPage = 0;
  int _transactionsTotal = 0;
  bool _transactionsLoading = false;
  final Map<String, String> _sectionErrors = {};
  String? sectionError(String section) => _sectionErrors[section];
  bool get transactionsLoading => _transactionsLoading;
  bool get hasMoreTransactions => _transactions.length < _transactionsTotal;

  // An unresolved write keeps its key even if its screen is closed/reopened.
  // The durable copy uses the existing secure storage service.
  final _moneyKeys = <String, String>{};
  final _moneyInFlight = <String, Future<String?>>{};
  String? _lastMoneyStatus;
  String? get lastMoneyStatus => _lastMoneyStatus;
  String _moneyScope = 'unbound';
  int _moneyScopeGeneration = 0;
  int get sessionGeneration => _moneyScopeGeneration;
  final _moneyReceiptListeners = <String, List<void Function(String)>>{};

  /// Called by the auth proxy, never by a route. Do not carry unresolved
  /// intent keys between different people/orgs on a joint account.
  void bindMoneyScope(String orgId, String? customerId) {
    final scope = jsonEncode([orgId, customerId]);
    if (scope == _moneyScope) return;
    _moneyScope = scope;
    _api.bindVerificationScope(scope);
    _moneyScopeGeneration++;
    _moneyKeys.clear();
    _lastMoneyStatus = null;
    _accountRequest++;
    _loanRequest++;
    _listRequest++;
    _loansListRequest++;
    _identityRequest++;
    _accounts = const [];
    _products = const [];
    _payees = const [];
    _disputes = const [];
    _openId = null;
    _open = const {};
    _gaps = const [];
    _transactions = const [];
    _statements = const [];
    _cards = const [];
    _identity = const {};
    _loans = const [];
    _applications = const [];
    _loanProducts = const [];
    _loanId = null;
    _loan = const {};
    _payoff = const {};
    _loading = false;
    _openLoading = false;
    _identityLoading = false;
    _loansLoading = false;
    _loanLoading = false;
    _error = null;
    _openError = null;
    _identityError = null;
    _loansError = null;
    _loanError = null;
    _activeActions = 0;
    _busy = false;
    _transactionsPage = 0;
    _transactionsTotal = 0;
    _transactionsLoading = false;
    _sectionErrors.clear();
    // ProxyProvider is updating: consumers read the cleared state on their
    // auth rebuild; notifying here would mutate listeners during build.
  }

  Future<T> _scopeRead<T>(Future<T> read) async {
    final generation = _moneyScopeGeneration;
    final result = await read;
    if (generation != _moneyScopeGeneration)
      throw StateError('Sign-in changed.');
    return result;
  }

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
      if (payeeIsVerified(p)) p,
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
    final request = ++_identityRequest;
    _identityLoading = true;
    _identityError = null;
    notifyListeners();
    try {
      final identity = await _scopeRead(_api.identity());
      if (request != _identityRequest) return;
      _identity = identity;
      _identityError = null;
    } catch (e) {
      if (request != _identityRequest) return;
      _identityError = _say(e);
    } finally {
      if (request == _identityRequest) {
        _identityLoading = false;
        notifyListeners();
      }
    }
  }

  Future<String?> submitIdentity(Map<String, dynamic> body) => _act(() async {
    _identity = await _scopeRead(_api.submitIdentity(body));
    // An approved check opens the accounts that were waiting on it.
    await load();
  });

  Future<String?> attachIdentityDocument({
    required String kind,
    required String path,
    String? documentType,
  }) => _act(() async {
    await _scopeRead(
      _api.attachIdentityDocument(
        kind: kind,
        path: path,
        documentType: documentType,
      ),
    );
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

  // Use the server's existing page contract; never compute portfolio totals
  // from only its first page. Abort between pages when the auth/read changes.
  Future<List<Map<String, dynamic>>> _allPages(
    Future<Map<String, dynamic>> Function(int) read,
    bool Function() current,
  ) async {
    final rows = <Map<String, dynamic>>[];
    for (var page = 1; ; page++) {
      if (!current()) throw StateError('Read changed.');
      final result = await _scopeRead(read(page));
      if (!current()) throw StateError('Read changed.');
      final next = _page(result);
      final total = result['total'];
      if (next.isEmpty) {
        if (total is num && rows.length < total)
          throw StateError(
            'The remaining records could not be loaded. Try again.',
          );
        return rows;
      }
      rows.addAll(next);
      if (total is num ? rows.length >= total : next.length < 50) return rows;
    }
  }

  Future<void> loadLoans() async {
    final request = ++_loansListRequest;
    bool current() => request == _loansListRequest;
    _loansLoading = true;
    _loansError = null;
    _sectionErrors.remove('applications');
    _sectionErrors.remove('loanProducts');
    notifyListeners();
    try {
      final loans = await _allPages(
        (page) => _api.myLoans(page: page, pageSize: 50),
        current,
      );
      if (!current()) return;
      _loans = loans;
      _loansError = null;
    } catch (e) {
      if (!current()) return;
      _loansError = _say(e);
    } finally {
      if (current()) {
        _loansLoading = false;
        notifyListeners();
      }
    }
    if (!current()) return;
    try {
      final data = await _allPages(
        (page) => _api.loanApplications(page: page, pageSize: 50),
        current,
      );
      if (!current()) return;
      _applications = data;
    } catch (e) {
      if (!current()) return;
      _sectionErrors['applications'] = _say(e);
    }
    try {
      final data = await _scopeRead(_api.loanProducts());
      if (!current()) return;
      _loanProducts = data;
    } catch (e) {
      if (!current()) return;
      _sectionErrors['loanProducts'] = _say(e);
    }
    if (current()) notifyListeners();
  }

  Future<void> openLoanView(String id, {Map<String, dynamic>? known}) async {
    final request = ++_loanRequest;
    _loanId = id;
    _loan = known ?? const {};
    _payoff = const {};
    _loanLoading = true;
    _loanError = null;
    notifyListeners();

    try {
      final loan = await _scopeRead(_api.loan(id));
      if (request != _loanRequest) return;
      _loan = loan;
      _loanError = null;
    } catch (e) {
      if (request != _loanRequest) return;
      if (_loan.isEmpty) _loanError = _say(e);
    }

    try {
      final payoff = await _scopeRead(_api.payoffQuote(id));
      if (request != _loanRequest) return;
      _payoff = payoff;
    } catch (_) {
      if (request != _loanRequest) return;
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
      _scopeRead(_api.loanApplication(id));

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
  }) => _act(() async {
    await _scopeRead(
      _api.applyForLoan(
        product: product,
        amountCents: amountCents,
        termMonths: termMonths,
        purpose: purpose,
        grossMonthlyCents: grossMonthlyCents,
        linkedAccount: linkedAccount,
        incomeSource: incomeSource,
        employment: employment,
        housingPaymentCents: housingPaymentCents,
      ),
    );
    await loadLoans();
  });

  Future<String?> withdrawApplication(String id, {String? reason}) =>
      _act(() async {
        await _scopeRead(_api.withdrawLoanApplication(id, reason: reason));
        await loadLoans();
      });

  Future<String?> answerCounteroffer(String id, {required bool accept}) =>
      _act(() async {
        await _scopeRead(_api.answerCounteroffer(id, accept: accept));
        await loadLoans();
      });

  Future<String?> updateLoanApplication(
    String id,
    Map<String, dynamic> changes,
  ) => _act(() async {
    await _scopeRead(_api.updateLoanApplication(id, changes));
    await loadLoans();
  });
  Future<String?> attachLoanDocument(
    String id,
    String path, {
    String? kind,
    String? note,
  }) => _act(() async {
    await _scopeRead(_api.attachLoanDocument(id, path, kind: kind, note: note));
  });
  Future<String?> respondToLoanCondition(
    String id,
    int index, {
    String? text,
    List<Map<String, dynamic>>? documents,
  }) => _act(() async {
    await _scopeRead(
      _api.respondToLoanCondition(id, index, text: text, documents: documents),
    );
  });

  /// Pay a loan from a deposit account. Both sides move, so both are reloaded:
  /// the loan's balance and the account the money left.
  Future<String?> payLoan({
    required String loanId,
    required int amountCents,
    required String fromAccount,
    void Function(String)? onReceipt,
  }) => _moneyAct(
    jsonEncode(['loan_payment', loanId, fromAccount, amountCents]),
    (key) async {
      return _checkMoneyResult(
        await _scopeRead(
          _api.payLoan(
            loanId,
            amountCents: amountCents,
            fromAccount: fromAccount,
            idempotencyKey: key,
          ),
        ),
      );
    },
    () async {
      await load();
      await refreshLoan();
      await loadLoans();
    },
    onReceipt: onReceipt,
  );

  // ── Loading ─────────────────────────────────────────────────────────────

  Future<void> load() async {
    final request = ++_listRequest;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final accounts = await _scopeRead(_api.accounts());
      if (request != _listRequest) return;
      _accounts = accounts;
      _error = null;
    } catch (e) {
      if (request != _listRequest) return;
      _error = _say(e);
    } finally {
      if (request == _listRequest) {
        _loading = false;
        notifyListeners();
      }
    }
    if (request != _listRequest) return;
    for (final section in ['identity', 'payees', 'products', 'disputes']) {
      if (request != _listRequest) return;
      _sectionErrors.remove(section);
      try {
        switch (section) {
          case 'identity':
            final value = await _scopeRead(_api.identity());
            if (request != _listRequest) return;
            _identity = value;
          case 'payees':
            final value = await _scopeRead(_api.payees());
            if (request != _listRequest) return;
            _payees = value;
          case 'products':
            final value = await _scopeRead(_api.products());
            if (request != _listRequest) return;
            _products = value;
          case 'disputes':
            final value = await _scopeRead(_api.disputes());
            if (request != _listRequest) return;
            _disputes = value;
        }
      } catch (e) {
        if (request != _listRequest) return;
        _sectionErrors[section] = _say(e);
      }
      if (request == _listRequest) notifyListeners();
    }
  }

  Future<void> openAccountView(String id, {Map<String, dynamic>? known}) async {
    final request = ++_accountRequest;
    _openId = id;
    _open = known ?? const {};
    _gaps = const [];
    _transactions = const [];
    _statements = const [];
    _cards = const [];
    _transactionsPage = 0;
    _transactionsTotal = 0;
    _transactionsLoading = false;
    for (final section in ['transactions', 'cards', 'statements']) {
      _sectionErrors.remove(section);
    }
    _openLoading = true;
    _openError = null;
    notifyListeners();

    try {
      final res = await _scopeRead(_api.account(id));
      if (request != _accountRequest) return;
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
      if (request != _accountRequest) return;
      if (_open.isEmpty) _openError = _say(e);
    }

    try {
      final page = await _scopeRead(_api.transactions(id));
      if (request != _accountRequest) return;
      _transactionsPage = 1;
      _transactionsTotal = page['total'] is num
          ? (page['total'] as num).toInt()
          : _page(page).length;
      final rows = page['data'];
      _transactions = rows is List
          ? [
              for (final r in rows)
                if (r is Map) _flat(Map<String, dynamic>.from(r)),
            ]
          : const [];
    } catch (e) {
      if (request != _accountRequest) return;
      _sectionErrors['transactions'] = _say(e);
    }
    try {
      final cards = await _scopeRead(_api.cards(id));
      if (request != _accountRequest) return;
      _cards = cards;
    } catch (e) {
      if (request != _accountRequest) return;
      _sectionErrors['cards'] = _say(e);
    }
    try {
      final statements = await _scopeRead(_api.statements(id));
      if (request != _accountRequest) return;
      _statements = statements;
    } catch (e) {
      if (request != _accountRequest) return;
      _sectionErrors['statements'] = _say(e);
    }

    _openLoading = false;
    notifyListeners();
  }

  Future<Uint8List> statementPdf(String accountId, String statementId) =>
      _scopeRead(_api.statementPdf(accountId, statementId));
  Future<Uint8List> payoffPdf(String loanId) =>
      _scopeRead(_api.payoffPdf(loanId));
  Future<Uint8List> adverseActionPdf(String applicationId) =>
      _scopeRead(_api.adverseActionPdf(applicationId));

  Future<void> loadMoreTransactions() async {
    final id = _openId;
    if (id == null || _transactionsLoading || !hasMoreTransactions) return;
    final request = _accountRequest;
    final page = _transactionsPage + 1;
    _transactionsLoading = true;
    _sectionErrors.remove('transactions');
    notifyListeners();
    try {
      final result = await _scopeRead(_api.transactions(id, page: page));
      if (request != _accountRequest) return;
      final next = _page(result).map(_flat).toList();
      if (next.isEmpty && hasMoreTransactions)
        throw StateError(
          'The remaining activity could not be loaded. Try again.',
        );
      final ids = _transactions.map(idOf).toSet();
      _transactions = [
        ..._transactions,
        ...next.where((row) => !ids.contains(idOf(row))),
      ];
      _transactionsPage = page;
      if (result['total'] is num)
        _transactionsTotal = (result['total'] as num).toInt();
    } catch (e) {
      if (request != _accountRequest) return;
      _sectionErrors['transactions'] = _say(e);
    } finally {
      if (request == _accountRequest) {
        _transactionsLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadDisputes() async {
    final generation = _moneyScopeGeneration;
    _sectionErrors.remove('disputes');
    notifyListeners();
    try {
      final rows = await _scopeRead(_api.disputes());
      if (generation != _moneyScopeGeneration) return;
      _disputes = rows;
    } catch (e) {
      if (generation != _moneyScopeGeneration) return;
      _sectionErrors['disputes'] = _say(e);
    }
    if (generation == _moneyScopeGeneration) notifyListeners();
  }

  Future<String?> withdrawDispute(String id) => _act(() async {
    await _scopeRead(_api.withdrawDispute(id));
    await loadDisputes();
    await refreshOpen();
  });

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
    final generation = _moneyScopeGeneration;
    _activeActions++;
    _busy = true;
    notifyListeners();
    try {
      await run();
      return null;
    } catch (e) {
      return _say(e);
    } finally {
      if (generation == _moneyScopeGeneration) {
        _activeActions--;
        _busy = _activeActions > 0;
        notifyListeners();
      }
    }
  }

  /// A retry of an unresolved intent must ask about the same server write.
  /// Confirmed writes retire their key; a later deliberate repeat is new.
  Future<String?> _moneyAct(
    String payload,
    Future<String> Function(String) write,
    Future<void> Function() refresh, {
    void Function(String)? onReceipt,
  }) {
    final intent = jsonEncode([_moneyScope, payload]);
    final scopeGeneration = _moneyScopeGeneration;
    if (onReceipt != null)
      _moneyReceiptListeners.putIfAbsent(intent, () => []).add(onReceipt);
    final running = _moneyInFlight[intent];
    if (running != null) return running;
    final completion = Completer<String?>();
    _moneyInFlight[intent] = completion.future;
    () async {
      final result = await _act(() async {
        String status;
        _lastMoneyStatus = null;
        String key;
        try {
          key = await _storage.getOrCreateBankingIntent(
            intent,
            BankingApi.newKey,
          );
        } catch (_) {
          throw StateError(
            'Payment not sent: secure recovery storage is unavailable. Try again when it is available.',
          );
        }
        if (scopeGeneration != _moneyScopeGeneration)
          throw StateError('Sign-in changed. No payment was sent.');
        _moneyKeys[intent] = key;
        try {
          status = await write(key);
        } catch (e) {
          if (e is _MoneyDeclined) {
            try {
              await _storage.removeBankingIntent(intent);
              _moneyKeys.remove(intent);
            } catch (_) {}
            rethrow;
          }
          throw Exception(
            '${_say(e)} Retrying with unchanged details reuses this payment request. Check activity before changing the details.',
          );
        }
        if (scopeGeneration != _moneyScopeGeneration)
          throw StateError(
            'Sign-in changed. Check the original account activity before starting another payment.',
          );
        _lastMoneyStatus = status;
        // A pending receipt is accepted but has not confirmed money movement.
        // Retain its key so another identical submit checks that request.
        if (status == 'posted') {
          try {
            await _storage.removeBankingIntent(intent);
            _moneyKeys.remove(intent);
          } catch (_) {}
        }
        if (scopeGeneration != _moneyScopeGeneration)
          throw StateError(
            'Sign-in changed. Check the original account activity before starting another payment.',
          );
        // A stale/unavailable balance is not a failed money movement. Never
        // invite a replacement payment after its write was confirmed.
        try {
          await refresh();
        } catch (_) {}
        if (scopeGeneration != _moneyScopeGeneration)
          throw StateError(
            'Sign-in changed. Check the original account activity before starting another payment.',
          );
        for (final listener
            in _moneyReceiptListeners[intent] ?? <void Function(String)>[]) {
          listener(status);
        }
      });
      _moneyReceiptListeners.remove(intent);
      _moneyInFlight.remove(intent);
      completion.complete(result);
    }();
    return completion.future;
  }

  String _checkMoneyResult(Map<String, dynamic> result) {
    final transaction = result['transaction'] is Map
        ? result['transaction'] as Map
        : result;
    final data = transaction['data'] is Map
        ? transaction['data'] as Map
        : transaction;
    final status = '${data['status'] ?? ''}';
    if (['failed', 'cancelled', 'returned', 'reversed'].contains(status)) {
      throw _MoneyDeclined(
        '${data['failureReason'] ?? 'This payment is $status. No replacement payment has been sent.'}',
      );
    }
    if (transaction['sk'] == null ||
        !['posted', 'pending', 'in_review'].contains(status)) {
      throw StateError('No payment confirmation was received.');
    }
    return status == 'in_review' ? 'pending' : status;
  }

  Future<String?> openNewAccount(
    String product, {
    String? nickname,
    Map<String, dynamic>? business,
  }) => _act(() async {
    await _scopeRead(
      _api.openAccount(
        product: product,
        nickname: nickname,
        business: business,
      ),
    );
    await load();
  });

  Future<String?> rename(String id, String nickname) => _act(() async {
    await _scopeRead(_api.rename(id, nickname));
    await load();
    await refreshOpen();
  });

  Future<String?> setOverdraft(String id, bool optedIn) => _act(() async {
    await _scopeRead(_api.setOverdraft(id, optedIn));
    await refreshOpen();
  });

  Future<String?> transfer({
    required String from,
    required String toAccountNumber,
    required int amountCents,
    String? memo,
    void Function(String)? onReceipt,
  }) => _moneyAct(
    jsonEncode(['transfer', from, toAccountNumber, amountCents, memo ?? '']),
    (key) async {
      return _checkMoneyResult(
        await _scopeRead(
          _api.transfer(
            from: from,
            toAccountNumber: toAccountNumber,
            amountCents: amountCents,
            memo: memo,
            idempotencyKey: key,
          ),
        ),
      );
    },
    () async {
      await load();
      await refreshOpen();
    },
    onReceipt: onReceipt,
  );

  Future<String?> pay({
    required String account,
    required String counterparty,
    required String rail,
    required int amountCents,
    bool sameDay = false,
    String? memo,
    void Function(String)? onReceipt,
  }) => _moneyAct(
    jsonEncode([
      'pay',
      account,
      counterparty,
      rail,
      amountCents,
      sameDay,
      memo ?? '',
    ]),
    (key) async {
      return _checkMoneyResult(
        await _scopeRead(
          _api.pay(
            account: account,
            counterparty: counterparty,
            rail: rail,
            amountCents: amountCents,
            sameDay: sameDay,
            memo: memo,
            idempotencyKey: key,
          ),
        ),
      );
    },
    () async {
      await load();
      await refreshOpen();
    },
    onReceipt: onReceipt,
  );

  Future<String?> pull({
    required String account,
    required String counterparty,
    required int amountCents,
    void Function(String)? onReceipt,
  }) => _moneyAct(
    jsonEncode(['pull', account, counterparty, amountCents]),
    (key) async {
      return _checkMoneyResult(
        await _scopeRead(
          _api.pull(
            account: account,
            counterparty: counterparty,
            amountCents: amountCents,
            idempotencyKey: key,
          ),
        ),
      );
    },
    () async {
      await load();
      await refreshOpen();
    },
    onReceipt: onReceipt,
  );

  Future<String?> cancelTransaction(String id) => _act(() async {
    await _scopeRead(_api.cancel(id));
    await refreshOpen();
  });

  Future<String?> addPayee(Map<String, dynamic> payee) => _act(() async {
    await _scopeRead(_api.addPayee(payee));
    _payees = await _scopeRead(_api.payees());
  });

  Future<String?> removePayee(String id) => _act(() async {
    await _scopeRead(_api.removePayee(id));
    _payees = await _scopeRead(_api.payees());
  });

  Future<String?> startMicroDeposits(String id) => _act(() async {
    await _scopeRead(_api.startMicroDeposits(id));
    _payees = await _scopeRead(_api.payees());
  });

  Future<String?> confirmMicroDeposits(String id, List<int> amounts) =>
      _act(() async {
        await _scopeRead(_api.confirmMicroDeposits(id, amounts));
        _payees = await _scopeRead(_api.payees());
      });

  Future<String?> orderCard(
    String accountId, {
    required String form,
    Map<String, dynamic>? shipping,
  }) => _act(() async {
    await _scopeRead(_api.orderCard(accountId, form: form, shipping: shipping));
    await refreshOpen();
  });

  Future<String?> activateCard(String cardId, String last4) => _act(() async {
    await _scopeRead(_api.activateCard(cardId, last4));
    await refreshOpen();
  });

  Future<String?> setCardLocked(String cardId, bool locked) => _act(() async {
    if (locked) {
      await _scopeRead(_api.lockCard(cardId));
    } else {
      await _scopeRead(_api.unlockCard(cardId));
    }
    await refreshOpen();
  });

  Future<String?> setCardControls(
    String cardId,
    Map<String, dynamic> controls,
  ) => _act(() async {
    await _scopeRead(_api.setControls(cardId, controls));
    await refreshOpen();
  });

  Future<String?> replaceCard(
    String cardId,
    String why, {
    Map<String, dynamic>? shipping,
  }) => _act(() async {
    await _scopeRead(_api.replaceCard(cardId, why: why, shipping: shipping));
    await refreshOpen();
  });

  Future<String?> fileDispute({
    required String transaction,
    required String reason,
    required String description,
    int? amountCents,
  }) => _act(() async {
    await _scopeRead(
      _api.fileDispute(
        transaction: transaction,
        reason: reason,
        description: description,
        amountCents: amountCents,
      ),
    );
    _disputes = await _scopeRead(_api.disputes());
  });

  String _say(Object e) => e.toString().replaceAll('Exception: ', '');
}
