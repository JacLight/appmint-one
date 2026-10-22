import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:appmint_one/services/http_client.dart';

void main() {
  test('a rejected pickup read resumes with the renewed customer token', () async {
    var renewals = 0;
    final seen = <String?>[];
    final client = AppengineHttpClient.forTesting(MockClient((r) async {
      if (r.url.path == '/profile/app/key') return http.Response('{"token":"app"}', 200);
      seen.add(r.headers['x-client-authorization']);
      return r.headers['x-client-authorization'] == 'Bearer fresh'
          ? http.Response('{"allowed":false,"reason":"Already collected"}', 200)
          : http.Response('{"message":"Sign in required"}', 401);
    }));
    client.setUserToken('expired');
    client.refreshUserToken = () async { renewals++; client.setUserToken('fresh'); return 'fresh'; };
    expect(await client.get('/client/stowbo/host/handover'), {'allowed': false, 'reason': 'Already collected'});
    expect(seen, ['Bearer expired', 'Bearer fresh']);
    expect(renewals, 1);
  });

  test('concurrent unauthorized reads share one customer renewal', () async {
    final bothRejected = Completer<void>();
    var rejected = 0;
    var renewals = 0;
    final client = AppengineHttpClient.forTesting(MockClient((r) async {
      if (r.url.path == '/profile/app/key') return http.Response('{"token":"app"}', 200);
      if (r.headers['x-client-authorization'] == 'Bearer fresh') return http.Response('{}', 200);
      if (++rejected == 2) bothRejected.complete();
      return http.Response('{}', 401);
    }));
    client.setUserToken('expired');
    client.refreshUserToken = () async {
      renewals++;
      await bothRejected.future;
      client.setUserToken('fresh');
      return 'fresh';
    };
    await Future.wait([client.get('/custody'), client.get('/payments')]);
    expect(renewals, 1);
    expect(rejected, 2);
  });

  test('a rejected refresh endpoint does not recursively renew the user', () async {
    var renewals = 0;
    var refreshRequests = 0;
    final client = AppengineHttpClient.forTesting(MockClient((r) async {
      if (r.url.path == '/profile/app/key') return http.Response('{"token":"app"}', 200);
      refreshRequests++;
      expect(r.headers.containsKey('x-client-authorization'), false);
      expect(jsonDecode(r.body), {'refresh_token': 'revoked'});
      return http.Response('{"message":"Expired session"}', 401);
    }));
    client.setUserToken('expired');
    client.refreshUserToken = () async { renewals++; return null; };
    await expectLater(client.post('/profile/customer/refresh',
        body: {'refresh_token': 'revoked'}, useUserToken: false), throwsException);
    expect(refreshRequests, 2);
    expect(renewals, 0);
  });

  test('a permanently unauthorized request stops after one auth retry', () async {
    var requests = 0;
    var renewals = 0;
    final client = AppengineHttpClient.forTesting(MockClient((r) async {
      if (r.url.path == '/profile/app/key') return http.Response('{"token":"app"}', 200);
      requests++;
      return http.Response('{"message":"Sign in required"}', 401);
    }));
    client.setUserToken('expired');
    client.refreshUserToken = () async { renewals++; return null; };
    await expectLater(client.get('/custody'), throwsException);
    expect(requests, 2);
    expect(renewals, 1);
  });

  test('signing out during renewal does not replay the request anonymously', () async {
    var requests = 0;
    final client = AppengineHttpClient.forTesting(MockClient((r) async {
      if (r.url.path == '/profile/app/key') return http.Response('{"token":"app"}', 200);
      requests++;
      return http.Response('{}', 401);
    }));
    client.setUserToken('expired');
    client.refreshUserToken = () async { client.clearUserToken(); return null; };
    await expectLater(client.get('/custody'), throwsException);
    expect(requests, 1);
  });
}
