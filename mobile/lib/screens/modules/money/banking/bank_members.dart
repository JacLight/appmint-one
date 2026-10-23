import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/banking_provider.dart';
import '../../../../services/banking_api.dart';

/// Same-bank member payments and requests use the existing signed review and confirmation.
class BankMembersScreen extends StatefulWidget {
  const BankMembersScreen({super.key});
  @override
  State<BankMembersScreen> createState() => _BankMembersScreenState();
}

class _BankMembersScreenState extends State<BankMembersScreen> {
  final username = TextEditingController(),
      amount = TextEditingController(),
      memo = TextEditingController(),
      payer = TextEditingController();
  final generation = bankingApi.verificationGeneration;
  Map<String, dynamic>? receiving, details;
  List<Map<String, dynamic>> requests = [];
  String? from, receivingAccount, error, notice, shareUrl;
  String direction = 'incoming';
  int page = 0, total = 0, readEpoch = 0;
  bool busy = false, showNumber = false, moreLoading = false;
  bool get sameSession => generation == bankingApi.verificationGeneration;
  @override
  void initState() {
    super.initState();
    refresh();
  }

  @override
  void dispose() {
    for (final c in [username, amount, memo, payer]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> refresh() async {
    final epoch = ++readEpoch;
    try {
      final pref = await bankingApi.receivingPreference();
      final result = await bankingApi.moneyRequests(direction);
      if (!mounted || !sameSession || epoch != readEpoch) return;
      setState(() {
        receiving = pref;
        receivingAccount = pref['account']?.toString();
        requests = _rows(result);
        total = result['total'] is int ? result['total'] : requests.length;
        page = 1;
        error = null;
      });
    } catch (e) {
      if (mounted && sameSession && epoch == readEpoch)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  List<Map<String, dynamic>> _rows(Map<String, dynamic> result) => [
    for (final row in (result['data'] as List? ?? []).whereType<Map>())
      Map<String, dynamic>.from(row),
  ];
  Future<void> act(Future<void> Function() fn) async {
    if (!sameSession || busy) return;
    setState(() {
      busy = true;
      error = null;
      notice = null;
    });
    try {
      await fn();
      if (sameSession) await refresh();
    } catch (e) {
      if (mounted && sameSession)
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> more() async {
    if (moreLoading || busy || !sameSession) return;
    setState(() => moreLoading = true);
    final nextPage = page + 1;
    final epoch = readEpoch;
    try {
      final result = await bankingApi.moneyRequests(direction, page: nextPage);
      if (!mounted || !sameSession || epoch != readEpoch) return;
      setState(() {
        final known = requests.map((r) => r['id']).toSet();
        requests.addAll(_rows(result).where((r) => !known.contains(r['id'])));
        page = nextPage;
        total = result['total'] is int ? result['total'] : requests.length;
      });
    } catch (e) {
      if (mounted && sameSession) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => moreLoading = false);
    }
  }

  Future<bool> confirm(String title, String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(text),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm'),
            ),
          ],
        ),
      ) ==
      true;
  Future<void> payPreview(Map<String, dynamic> preview) async {
    final value = preview['total'] is Map
        ? (preview['total'] as Map)['amount']
        : null;
    if (value is! int ||
        value <= 0 ||
        (preview['total'] as Map?)?['currency'] != 'USD' ||
        preview['previewId'] is! String)
      throw StateError(
        'The bank did not return complete review terms. No payment was sent.',
      );
    final to = preview['to'] is Map ? (preview['to'] as Map)['name'] : 'member';
    if (!await confirm(
      'Review payment',
      '${Money.format(value)} to $to.\n${(preview['notices'] as List? ?? []).join('\n')}',
    ))
      return;
    if (!sameSession) return;
    final result = await bankingApi.confirmPortalPayment(
      preview['previewId'].toString(),
    );
    if (!mounted || !sameSession) return;
    setState(
      () => notice = ['completed', 'posted'].contains(result['status'])
          ? 'Payment posted. Reference: ${result['reference'] ?? ''}'
          : 'Payment is ${result['status'] ?? 'processing'}. It has not been confirmed as paid. Check activity before sending another payment.',
    );
  }

  Future<void> memberPayment() async {
    if (from == null) throw StateError('Choose your account.');
    final cents = Money.parse(amount.text);
    if (cents == null || cents < 1)
      throw StateError('Enter a positive USD amount.');
    final found = await bankingApi.resolveMember(username.text.trim());
    if (found['found'] != true || found['recipientToken'] == null)
      throw StateError('No opted-in member has that exact username.');
    final preview = await bankingApi.previewMemberPayment({
      'recipientToken': found['recipientToken'],
      'fromAccountId': from,
      'amount': {'amount': cents, 'currency': 'USD'},
      'memo': memo.text.trim(),
    });
    if (mounted && sameSession) await payPreview(preview);
  }

  Future<void> createRequest() async {
    if (receiving?['enabled'] != true || receiving?['account'] == null)
      throw StateError(
        'Explicitly enable member receiving and choose its account first.',
      );
    final cents = Money.parse(amount.text);
    if (cents == null || cents < 1)
      throw StateError('Enter a positive USD amount.');
    String? token;
    if (payer.text.trim().isNotEmpty) {
      final found = await bankingApi.resolveMember(payer.text.trim());
      if (found['found'] != true)
        throw StateError('No opted-in member has that exact payer username.');
      token = found['recipientToken']?.toString();
    }
    final result = await bankingApi.createMoneyRequest({
      'toAccountId': receiving!['account'],
      'amount': {'amount': cents, 'currency': 'USD'},
      'memo': memo.text.trim(),
      if (token != null) 'payerToken': token,
    });
    if (mounted && sameSession)
      setState(() {
        notice = 'Request created. No message was sent and no money moved.';
        shareUrl = result['payUrl']?.toString();
        direction = 'outgoing';
      });
  }

  Widget accountField(
    List<Map<String, dynamic>> accounts, {
    required bool receivingField,
  }) => DropdownButtonFormField<String>(
    key: ValueKey(
      '${receivingField ? 'receive' : 'from'}:$from:$receivingAccount',
    ),
    initialValue:
        accounts.any(
          (a) => a['sk'] == (receivingField ? receivingAccount : from),
        )
        ? receivingField
              ? receivingAccount
              : from
        : null,
    decoration: InputDecoration(
      labelText: receivingField
          ? 'Designated receiving account'
          : 'Pay from your account',
    ),
    items: [
      for (final a in accounts)
        DropdownMenuItem(
          value: a['sk'].toString(),
          child: Text(
            '${a['nickname'] ?? a['kind']} ••••${(a['accountNumber'] ?? '').toString().split('').reversed.take(4).toList().reversed.join()}',
          ),
        ),
    ],
    onChanged: busy
        ? null
        : (value) => setState(() {
            if (receivingField) {
              receivingAccount = value;
            } else {
              from = value;
            }
          }),
  );
  @override
  Widget build(BuildContext context) {
    context.watch<AuthProvider?>();
    if (!sameSession)
      return Scaffold(
        appBar: AppBar(title: const Text('Members and requests')),
        body: const Padding(
          padding: EdgeInsets.all(20),
          child: Text('Your session changed. Reopen banking.'),
        ),
      );
    final bank = context.watch<BankingProvider>();
    final accounts = bank.accounts
        .where(
          (a) =>
              a['status'] == 'open' &&
              ['checking', 'savings', 'money_market'].contains(a['kind']) &&
              (a['currency'] ?? 'USD') == 'USD',
        )
        .toList();
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Members and requests'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Pay member'),
              Tab(text: 'Requests'),
              Tab(text: 'Receiving'),
            ],
          ),
        ),
        body: Column(
          children: [
            if (error != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(error!, style: const TextStyle(color: Colors.red)),
              ),
            if (notice != null)
              Padding(padding: const EdgeInsets.all(12), child: Text(notice!)),
            if (busy) const LinearProgressIndicator(),
            Expanded(
              child: TabBarView(
                children: [
                  ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      const Text(
                        'Send USD to an opted-in member using their exact username. No global directory or phone/email search is available.',
                      ),
                      accountField(accounts, receivingField: false),
                      TextField(
                        controller: username,
                        decoration: const InputDecoration(
                          labelText: 'Exact member username',
                        ),
                      ),
                      TextField(
                        controller: amount,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Amount (USD)',
                        ),
                      ),
                      TextField(
                        controller: memo,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          labelText: 'Note (optional)',
                        ),
                      ),
                      FilledButton(
                        onPressed: busy ? null : () => act(memberPayment),
                        child: const Text('Review member payment'),
                      ),
                    ],
                  ),
                  ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final value in ['incoming', 'outgoing'])
                            ChoiceChip(
                              label: Text(
                                value == 'incoming' ? 'Incoming' : 'Outgoing',
                              ),
                              selected: direction == value,
                              onSelected: busy
                                  ? null
                                  : (_) {
                                      setState(() => direction = value);
                                      refresh();
                                    },
                            ),
                        ],
                      ),
                      TextButton(
                        onPressed: busy ? null : refresh,
                        child: const Text('Refresh requests'),
                      ),
                      for (final request in requests)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${request['amount'] is Map && (request['amount'] as Map)['amount'] is int ? Money.format((request['amount'] as Map)['amount']) : 'Amount unavailable'} · ${request['status']}',
                                ),
                                if (request['counterparty'] is Map)
                                  Text(
                                    (request['counterparty'] as Map)['name']
                                            ?.toString() ??
                                        '',
                                  ),
                                if (request['memo'] != null)
                                  Text(request['memo'].toString()),
                                if (request['status'] == 'processing')
                                  const Text(
                                    'Payment is processing or needs bank review. Do not send another payment.',
                                  ),
                                if (request['status'] == 'open' &&
                                    request['direction'] == 'incoming') ...[
                                  accountField(accounts, receivingField: false),
                                  FilledButton(
                                    onPressed: busy
                                        ? null
                                        : () => act(() async {
                                            if (from == null)
                                              throw StateError(
                                                'Choose your account.',
                                              );
                                            final preview = await bankingApi
                                                .previewRequestPayment({
                                                  'requestId': request['id'],
                                                  'fromAccountId': from,
                                                });
                                            if (mounted && sameSession)
                                              await payPreview(preview);
                                          }),
                                    child: const Text('Review full payment'),
                                  ),
                                  TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => act(() async {
                                            if (await confirm(
                                              'Decline request?',
                                              'No payment will be made.',
                                            ))
                                              await bankingApi
                                                  .closeMoneyRequest(
                                                    request['id'].toString(),
                                                    'decline',
                                                  );
                                          }),
                                    child: const Text('Decline request'),
                                  ),
                                ],
                                if (request['status'] == 'open' &&
                                    request['direction'] == 'outgoing') ...[
                                  TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => act(() async {
                                            if (await confirm(
                                              'Cancel request?',
                                              'This stops this unpaid request.',
                                            ))
                                              await bankingApi
                                                  .closeMoneyRequest(
                                                    request['id'].toString(),
                                                    'cancel',
                                                  );
                                          }),
                                    child: const Text('Cancel request'),
                                  ),
                                  TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => act(() async {
                                            final link = await bankingApi
                                                .shareMoneyRequest(
                                                  request['id'].toString(),
                                                );
                                            if (mounted && sameSession)
                                              setState(
                                                () => shareUrl = link['payUrl']
                                                    ?.toString(),
                                              );
                                          }),
                                    child: const Text(
                                      'Prepare authenticated share link',
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      if (requests.length < total)
                        TextButton(
                          onPressed: busy || moreLoading ? null : more,
                          child: const Text('Load more requests'),
                        ),
                      if (shareUrl != null) _ShareRequestLink(path: shareUrl!),
                      const Divider(),
                      const Text(
                        'Create a full-amount same-bank request. No message is sent.',
                      ),
                      TextField(
                        controller: amount,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Amount (USD)',
                        ),
                      ),
                      TextField(
                        controller: memo,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          labelText: 'Note (optional)',
                        ),
                      ),
                      TextField(
                        controller: payer,
                        decoration: const InputDecoration(
                          labelText:
                              'Exact payer username (optional, otherwise authenticated link)',
                        ),
                      ),
                      FilledButton(
                        onPressed: busy ? null : () => act(createRequest),
                        child: const Text('Create request'),
                      ),
                    ],
                  ),
                  ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      const Text(
                        'Member lookup is off unless you explicitly enable it. Enabling publishes your exact username and display name to other signed-in bank members and directs their payments to your selected account.',
                      ),
                      if (receiving != null)
                        Text(
                          receiving!['enabled'] == true
                              ? 'Member receiving is enabled for ${receiving!['username'] ?? 'your username'}.'
                              : 'Member receiving is off.',
                        ),
                      accountField(accounts, receivingField: true),
                      FilledButton(
                        onPressed: busy || receiving == null
                            ? null
                            : () => act(() async {
                                if (receivingAccount == null)
                                  throw StateError(
                                    'Choose your receiving account.',
                                  );
                                if (!await confirm(
                                  'Enable member receiving?',
                                  'Your exact username and display name become discoverable to signed-in bank members. Payments go to the selected account.',
                                ))
                                  return;
                                await bankingApi.updateReceiving({
                                  'enabled': true,
                                  'account': receivingAccount,
                                  'revision': receiving!['revision'],
                                });
                              }),
                        child: const Text('Enable or update receiving'),
                      ),
                      TextButton(
                        onPressed: busy || receiving?['enabled'] != true
                            ? null
                            : () => act(() async {
                                if (await confirm(
                                  'Turn off member receiving?',
                                  'New member payments and unpaid requests to this preference will be refused.',
                                ))
                                  await bankingApi.updateReceiving({
                                    'enabled': false,
                                    'revision': receiving!['revision'],
                                  });
                              }),
                        child: const Text('Turn off member receiving'),
                      ),
                      const Divider(),
                      const Text('Your account details'),
                      TextButton(
                        onPressed: busy
                            ? null
                            : () => act(() async {
                                final id =
                                    receivingAccount ??
                                    (accounts.isEmpty
                                        ? null
                                        : accounts.first['sk']?.toString());
                                if (id == null)
                                  throw StateError('Choose an open account.');
                                final result = await bankingApi.receiveDetails(
                                  id,
                                );
                                if (mounted && sameSession)
                                  setState(() {
                                    details = result;
                                    showNumber = false;
                                  });
                              }),
                        child: const Text('Load receiving instructions'),
                      ),
                      if (details != null) ...[
                        Text(details!['bankName']?.toString() ?? ''),
                        Text(
                          'Routing: ${details!['routingNumber'] ?? 'Unavailable'}',
                        ),
                        Text(
                          showNumber
                              ? 'Account: ${details!['accountNumber'] ?? 'Unavailable'}'
                              : 'Account: ••••${details!['accountMask'] ?? ''}',
                        ),
                        TextButton(
                          onPressed: () =>
                              setState(() => showNumber = !showNumber),
                          child: Text(
                            showNumber
                                ? 'Hide account number'
                                : 'Show account number',
                          ),
                        ),
                        if (showNumber && details!['accountNumber'] is String)
                          TextButton(
                            onPressed: () => Clipboard.setData(
                              ClipboardData(text: details!['accountNumber']),
                            ),
                            child: const Text('Copy account number'),
                          ),
                        for (final note in (details!['notes'] as List? ?? []))
                          Text(note.toString()),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShareRequestLink extends StatelessWidget {
  const _ShareRequestLink({required this.path});
  final String path;
  @override
  Widget build(BuildContext context) {
    const origin = String.fromEnvironment('BANK_PORTAL_URL');
    final uri = Uri.tryParse(origin);
    if (uri == null ||
        !uri.hasAuthority ||
        !['https', 'http'].contains(uri.scheme))
      return const Text(
        'Open this request in the banking website to copy its share link.',
      );
    final link = uri.resolve(path).toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'The recipient must sign in. Preparing this link sends no message.',
        ),
        SelectableText(link),
        TextButton(
          onPressed: () => Clipboard.setData(ClipboardData(text: link)),
          child: const Text('Copy authenticated request link'),
        ),
      ],
    );
  }
}
