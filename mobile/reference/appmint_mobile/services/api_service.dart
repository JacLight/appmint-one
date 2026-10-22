import 'package:email_validator/email_validator.dart';
import 'package:flutter/foundation.dart';
import '../models/auth_response.dart';
import '../config/environment.dart';
import '../models/user_model.dart';
import '../models/lead_model.dart';
import '../models/activity_model.dart';
import 'storage_service.dart';
import 'http_client.dart';

/// The server issued a verification challenge instead of a session.
///
/// Sign-in answers with `requiresTwoFactor` and no tokens when the account has
/// 2FA on, when the organization requires it, or when new-device verification
/// is on and this device is not recognised. The code has already been sent by
/// the time this is thrown; what is left is to collect it and post it back with
/// the challenge token.
/// One organization an email can sign into, as the directory reports it.
class OrgChoice {
  final String orgId;
  final String displayName;
  const OrgChoice({required this.orgId, required this.displayName});
}

/// The password was right in more than one organization.
///
/// Thrown for a sign-in sent without an org: the server tried the password
/// against every org the directory knows for that email and more than one
/// accepted it. Which one to open is a question only the person can answer,
/// so it comes back as a choice rather than a guess.
class OrgChoiceRequiredException implements Exception {
  final List<OrgChoice> orgs;
  const OrgChoiceRequiredException(this.orgs);
  @override
  String toString() => 'OrgChoiceRequiredException(${orgs.length} orgs)';
}

class TwoFactorRequiredException implements Exception {
  final String challengeToken;

  /// `email`, `sms` or `authenticator`. Decides the wording on the code screen —
  /// an authenticator code was never sent anywhere, so "resend" is meaningless.
  final String method;
  final String message;

  /// The org the challenge belongs to. Empty unless the sign-in was sent
  /// without an org, in which case the server names the one it resolved — and
  /// verifying the code needs it, so it must be carried out of here.
  final String orgId;

  TwoFactorRequiredException({
    required this.challengeToken,
    required this.method,
    required this.message,
    this.orgId = '',
  });

  @override
  String toString() => message;
}

class ApiService {
  final StorageService _storage = StorageService();
  final AppengineHttpClient _http = appengineHttpClient;

  // Initialize - Load token from storage and set in HTTP client
  Future<void> initialize() async {
    final accessToken = await _storage.getAccessToken();
    final orgId = await _storage.getSetting('orgId');
    if (accessToken != null && orgId != null) {
      _http.setAuth(accessToken, orgId);
    }
  }

  // Authentication APIs
  /// The org the current session is actually against. After an org-less
  /// sign-in this is the one the server chose, which is the only place the
  /// caller can learn it.
  String get currentOrgId => _http.orgId ?? '';

  /// Sign-in step one: which organizations this email belongs to, most
  /// recently used first. Public — no org, no token. The person picks (or is
  /// handed) the org from this list; nobody types an org id any more.
  Future<List<OrgChoice>> directoryLookup(String email) async {
    final response = await _http.post(
      '/profile/user/directory/lookup',
      body: {'email': email.trim().toLowerCase()},
      requireAuth: false,
      // No org — this runs before one is known, and the client may still hold
      // the last person's. The server 404s this route when the orgid names an
      // org it cannot resolve.
      sendOrg: false,
    );
    final raw = response is Map ? response['orgs'] : null;
    if (raw is! List) return const [];
    return [
      for (final o in raw)
        if (o is Map && (o['orgId'] ?? '').toString().isNotEmpty)
          OrgChoice(
            orgId: o['orgId'].toString(),
            displayName: (o['displayName'] ?? o['orgId']).toString(),
          ),
    ];
  }

  /// Request the supported user reset-link flow without creating a session.
  Future<void> requestPasswordReset(String orgId, String email) async {
    final address = email.trim();
    if (!EmailValidator.validate(address)) {
      throw Exception('Please enter a valid email');
    }
    if (orgId.trim().isEmpty) {
      throw Exception('Pick your organization first');
    }
    _http.setAuth('', orgId.trim());
    final response = await _http.get(
      '/profile/user/password/forgot/${Uri.encodeComponent(address)}',
      queryParams: {'strategy': 'link', 'redirectUrl': EnvironmentConfig.passwordResetUrl},
      requireAuth: false,
    );
    if (response is! Map || response['success'] != true) {
      throw Exception('Password reset was not confirmed. Please try again.');
    }
  }

  /// Sign in. [orgId] may be empty: the server then resolves the org from the
  /// email itself, and answers with a session when exactly one org takes the
  /// password, or an [OrgChoiceRequiredException] when several do. That path
  /// needs no directory lookup, so it still works when the lookup found
  /// nothing.
  Future<AuthResponse> login(String orgId, String email, String password) async {
    // Empty token for login. An empty org is deliberate and allowed — the
    // sign-in route is exempt from the orgid requirement precisely so the
    // email can decide.
    _http.setAuth('', orgId);

    final response = await _http.post(
      '/profile/user/signin',
      body: {
        'email': email,
        'password': password,
      },
      requireAuth: false,
    );

    if (kDebugMode) {
      print('📥 RAW LOGIN API RESPONSE:');
      print(response);
    }

    // Sent without an org and the password opened several: the person picks.
    // A fork in the road, not a step — and like the challenge below it arrives
    // as a 200 carrying no token.
    if (response is Map && response['requiresOrgChoice'] == true) {
      final raw = response['orgs'];
      throw OrgChoiceRequiredException([
        if (raw is List)
          for (final o in raw)
            if (o is Map && (o['orgId'] ?? '').toString().isNotEmpty)
              OrgChoice(
                orgId: o['orgId'].toString(),
                displayName: (o['displayName'] ?? o['orgId']).toString(),
              ),
      ]);
    }

    // A challenge is not a failure and not a session — it is a second step, and
    // it arrives as a 200 with no token in it. Checked before parsing because
    // AuthResponse defaults a missing token to '', which would otherwise sign
    // the app in holding nothing and strand it on the first real request.
    if (response is Map && response['requiresTwoFactor'] == true) {
      throw TwoFactorRequiredException(
        challengeToken: response['challengeToken']?.toString() ?? '',
        method: response['twoFactorMethod']?.toString() ?? 'email',
        message: response['message']?.toString() ?? 'Verification code required',
        orgId: (response['orgId'] ?? '').toString(),
      );
    }

    final authResponse = AuthResponse.fromJson(response);

    // Any other tokenless 200 is a response shape we do not understand. Failing
    // here keeps it a visible login error instead of a session that 401s later.
    if (authResponse.accessToken.isEmpty) {
      throw Exception('Sign-in did not return a session. Please try again.');
    }

    // Which org this actually opened. Sent without one, the server names it in
    // the response; storing the empty string we sent would leave the session
    // tenant-less and every later request would 400 on a missing orgid.
    final resolvedOrg = orgId.trim().isNotEmpty
        ? orgId.trim()
        : (response is Map ? (response['orgId'] ?? '').toString() : '');
    if (resolvedOrg.isEmpty) {
      throw Exception('Sign-in did not say which organization it opened.');
    }

    // Set proper auth in HTTP client after successful login
    _http.setAuth(authResponse.accessToken, resolvedOrg);

    await _storage.saveTokens(
      authResponse.accessToken,
      authResponse.refreshToken,
    );
    await _storage.saveUser(authResponse.user);
    await _storage.saveSetting('orgId', resolvedOrg);
    // Remember the org as permanent config — survives logout (clearAll keeps
    // 'remembered_org') so the login screen locks to it and never re-asks.
    await _storage.saveSetting('remembered_org', resolvedOrg);
    return authResponse;
  }

  /// Finish a challenged sign-in.
  ///
  /// Public route: the challenge token is the credential, so no session is
  /// needed to call it. `trustDevice` stops this device being challenged again
  /// for the next 30 days, which is what keeps new-device verification from
  /// asking on every launch.
  Future<AuthResponse> verifyTwoFactor({
    required String orgId,
    required String challengeToken,
    required String code,
    bool trustDevice = true,
  }) async {
    _http.setAuth('', orgId);

    final response = await _http.post(
      '/profile/security/challenge/verify',
      body: {
        'challengeToken': challengeToken,
        'code': code,
        'trustDevice': trustDevice,
      },
      requireAuth: false,
    );

    final authResponse = AuthResponse.fromJson(response);
    if (authResponse.accessToken.isEmpty) {
      throw Exception('Verification did not return a session. Please sign in again.');
    }

    _http.setAuth(authResponse.accessToken, orgId);

    await _storage.saveTokens(
      authResponse.accessToken,
      authResponse.refreshToken,
    );
    await _storage.saveUser(authResponse.user);
    await _storage.saveSetting('orgId', orgId);
    await _storage.saveSetting('remembered_org', orgId);
    return authResponse;
  }

  /// Send the code again on the same challenge. Pointless for `authenticator`,
  /// which generates codes on the device rather than receiving them.
  Future<void> resendTwoFactorCode({
    required String orgId,
    required String challengeToken,
    String? method,
  }) async {
    _http.setAuth('', orgId);
    await _http.post(
      '/profile/security/challenge/send',
      body: {
        'challengeToken': challengeToken,
        if (method != null) 'method': method,
      },
      requireAuth: false,
    );
  }

  // ─── Passcode / NFC quick login ──────────────────────────────────────────
  // The server (userAuthPasscode) is the source of truth: it reads
  // passcodeLoginSettings {enable, mode} and enforces it. employeeId is always
  // sent; `pin` is required in 'passcode' mode; `cardUid` is sent when the
  // employeeId came from an NFC tap so the backend can run its anti-clone
  // check against the active access_card registry.
  Future<AuthResponse> signinPasscode(
    String orgId, {
    required String employeeId,
    String? pin,
    String? cardUid,
  }) async {
    _http.setAuth('', orgId); // no token yet — public route
    final response = await _http.post(
      '/profile/user/signin/passcode',
      body: {
        'employeeId': employeeId,
        if (pin != null && pin.isNotEmpty) 'pin': pin,
        if (cardUid != null && cardUid.isNotEmpty) 'cardUid': cardUid,
      },
      requireAuth: false,
    );
    final authResponse = AuthResponse.fromJson(response);
    _http.setAuth(authResponse.accessToken, orgId);
    await _storage.saveTokens(
      authResponse.accessToken,
      authResponse.refreshToken,
    );
    await _storage.saveUser(authResponse.user);
    await _storage.saveSetting('orgId', orgId);
    // Remember the org as permanent config — survives logout (clearAll keeps
    // 'remembered_org') so the login screen locks to it and never re-asks.
    await _storage.saveSetting('remembered_org', orgId);
    return authResponse;
  }

  // Set/change the quick-login passcode. userId null = current user;
  // passing userId requires an admin role (enforced server-side).
  Future<Map<String, dynamic>> setPasscode({
    String? userId,
    required String employeeId,
    required String pin,
  }) async {
    final res = await _http.post('/profile/passcode/set', body: {
      if (userId != null) 'userId': userId,
      'employeeId': employeeId,
      'pin': pin,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  Future<Map<String, dynamic>> removePasscode({String? userId}) async {
    final res = await _http.post('/profile/passcode/remove',
        body: {if (userId != null) 'userId': userId});
    return Map<String, dynamic>.from(res as Map);
  }

  // ─── Access-card registry (admin only — server enforces the role) ────────
  Future<Map<String, dynamic>> registerCard({
    required String cardUid,
    required String employeeId,
    String? label,
  }) async {
    final res = await _http.post('/profile/passcode/card/register', body: {
      'cardUid': cardUid,
      'employeeId': employeeId,
      if (label != null && label.isNotEmpty) 'label': label,
    });
    return Map<String, dynamic>.from(res as Map);
  }

  /// status: 'active' | 'revoked' | 'lost'. revoked/lost disable the card now.
  Future<Map<String, dynamic>> setCardStatus({
    required String cardId,
    required String status,
  }) async {
    final res = await _http.post('/profile/passcode/card/status',
        body: {'cardId': cardId, 'status': status});
    return Map<String, dynamic>.from(res as Map);
  }

  Future<List<Map<String, dynamic>>> listCards({String? employeeId}) async {
    final path = (employeeId == null || employeeId.isEmpty)
        ? '/profile/passcode/cards'
        : '/profile/passcode/cards/$employeeId';
    final res = await _http.get(path);
    final list = (res is List)
        ? res
        : (res is Map ? (res['data'] ?? res['items'] ?? []) : []);
    return List<Map<String, dynamic>>.from(
        (list as List).map((e) => Map<String, dynamic>.from(e as Map)));
  }

  Future<Map<String, dynamic>> getCardInfo(String identifier) async {
    final res = await _http.get('/profile/passcode/card/$identifier');
    return Map<String, dynamic>.from(res as Map);
  }

  // Base settings document (post-auth; used by the admin UI).
  // passcodeLoginSettings lives at result['data']['passcodeLoginSettings'].
  Future<Map<String, dynamic>?> getBaseSetting() async {
    final res = await _http
        .get('/repository/find-by-attribute/setting/name/base-setting');
    final list = (res is List)
        ? res
        : (res is Map ? (res['data'] ?? res['items'] ?? []) : []);
    if (list is List && list.isNotEmpty) {
      return Map<String, dynamic>.from(list.first as Map);
    }
    return null;
  }

  // BusinessMade employee roster — for issuing/linking cards.
  Future<List<Map<String, dynamic>>> listEmployees({String? keyword}) async {
    final res = await _http.get('/business-made/employees', queryParams: {
      if (keyword != null && keyword.isNotEmpty) 'keyword': keyword,
    });
    final list = (res is List)
        ? res
        : (res is Map ? (res['data'] ?? res['items'] ?? []) : []);
    return List<Map<String, dynamic>>.from(
        (list as List).map((e) => Map<String, dynamic>.from(e as Map)));
  }

  Future<AuthResponse> register({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
    String? username,
  }) async {
    final response = await _http.post(
      '/profile/user/signup',
      body: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'username': username,
      },
      requireAuth: false,
    );

    final authResponse = AuthResponse.fromJson(response);

    // Get orgId from storage
    final orgId = await _storage.getSetting('orgId');
    if (orgId != null) {
      _http.setAuth(authResponse.accessToken, orgId);
    }

    await _storage.saveTokens(
      authResponse.accessToken,
      authResponse.refreshToken,
    );
    await _storage.saveUser(authResponse.user);
    return authResponse;
  }

  /// Send magic code to email
  Future<void> sendMagicCode(String email) async {
    final orgId = await _storage.getSetting('orgId');
    await _http.get(
      '/profile/user/magic-link',
      queryParams: {'email': email, 'type': 'code'},
      requireAuth: false,
    );
  }

  /// Verify magic code and login
  Future<AuthResponse> verifyMagicCode(String email, String code) async {
    final orgId = await _storage.getSetting('orgId');
    final response = await _http.post(
      '/profile/user/magic-link/redirect',
      body: {'email': email, 'code': code},
      requireAuth: false,
    );

    final authResponse = AuthResponse.fromJson(response);

    if (orgId != null) {
      _http.setAuth(authResponse.accessToken, orgId);
    }

    await _storage.saveTokens(authResponse.accessToken, authResponse.refreshToken);
    await _storage.saveUser(authResponse.user);
    return authResponse;
  }

  Future<AuthResponse> refreshToken() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      throw Exception('No refresh token available');
    }

    final response = await _http.post(
      '/profile/user/refresh',
      body: {'refresh_token': refreshToken},
      requireAuth: false,
    );

    final authResponse = AuthResponse.fromJson(response);

    // Get orgId from storage
    final orgId = await _storage.getSetting('orgId');
    if (orgId != null) {
      _http.setAuth(authResponse.accessToken, orgId);
    }

    await _storage.saveTokens(
      authResponse.accessToken,
      authResponse.refreshToken,
    );
    return authResponse;
  }

  Future<UserModel> getCurrentUser() async {
    final response = await _http.get('/profile');
    return UserModel.fromJson(response);
  }

  Future<void> logout() async {
    _http.clearAuth();
    await _storage.clearAll();
  }

  /// Permanently delete the signed-in user's own account.
  ///
  /// Calls DELETE /profile/user/self on appengine, which identifies the
  /// caller from the JWT and deletes only their own record. The backend
  /// protects the org primary contact (`f_admin`) from self-deletion.
  /// Required by Apple guideline 5.1.1(v).
  Future<void> deleteAccount() async {
    await _http.delete('/profile/user/self');
    _http.clearAuth();
    await _storage.clearAll();
  }

  // Lead APIs (CRM endpoints)
  Future<List<LeadModel>> getLeads({
    int page = 1,
    int limit = 20,
    Map<String, dynamic>? filters,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (filters != null) ...filters.map((k, v) => MapEntry(k, v.toString())),
    };

    final response = await _http.get('/crm/leads/detail', queryParams: queryParams);

    final List<dynamic> data = response['data'] ?? response['results'] ?? [];
    return data.map((json) => LeadModel.fromJson(json)).toList();
  }

  Future<LeadModel> getLeadById(String id) async {
    final response = await _http.get('/crm/leads/detail/$id');
    return LeadModel.fromJson(response);
  }

  Future<LeadModel> createLead(Map<String, dynamic> leadData) async {
    final response = await _http.post('/crm/leads/detail', body: leadData);
    return LeadModel.fromJson(response);
  }

  Future<LeadModel> updateLead(String id, Map<String, dynamic> leadData) async {
    final response = await _http.put('/crm/leads/detail/$id', body: leadData);
    return LeadModel.fromJson(response);
  }

  Future<void> deleteLead(String id) async {
    await _http.delete('/crm/leads/detail/$id');
  }

  /// Qualify a lead (POST /crm/leads/qualify/:id): sets it qualified, logs the
  /// activity on the lead and tells its owner.
  Future<void> qualifyLead(String id, {String? notes}) async {
    await _http.post('/crm/leads/qualify/$id', body: {if (notes != null && notes.isNotEmpty) 'notes': notes});
  }

  // The sales pipeline a lead moves through (CRM lead pipelines: stages, the
  // stage gate, won/lost) and the lead's own timeline. Raw records, as the
  // leads list reads them.

  /// GET /crm/leads/pipelines: the org's pipelines with their stages.
  Future<List<Map<String, dynamic>>> getLeadPipelines() async {
    final response = await _http.get('/crm/leads/pipelines');
    final list = response is List ? response : (response is Map ? (response['data'] ?? const []) : const []);
    return (list as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// GET /crm/leads/detail/:id as the stored record (sk + data).
  Future<Map<String, dynamic>> getLeadRecord(String id) async {
    final response = await _http.get('/crm/leads/detail/$id');
    return response is Map ? Map<String, dynamic>.from(response) : <String, dynamic>{};
  }

  /// Saves lead fields through the leads service (PUT /crm/leads/detail/:id):
  /// a `stageId` is a stage move, checked against the stage's requirements and
  /// written to the lead's history; won/lost outcomes close the lead.
  Future<Map<String, dynamic>> saveLeadFields(String id, Map<String, dynamic> fields) async {
    final response = await _http.put('/crm/leads/detail/$id', body: fields);
    return response is Map ? Map<String, dynamic>.from(response) : <String, dynamic>{};
  }

  /// Creates a lead through the leads service (POST /crm/leads/detail): it lands
  /// on the default pipeline's first stage, gets its contact, and its history
  /// starts with "Lead created".
  Future<Map<String, dynamic>> createLeadRecord(Map<String, dynamic> data) async {
    final response = await _http.post('/crm/leads/detail', body: data);
    return response is Map ? Map<String, dynamic>.from(response) : <String, dynamic>{};
  }

  /// GET /crm/leads/activities/:id: the lead's timeline, newest first.
  Future<List<Map<String, dynamic>>> getLeadActivities(String id) async {
    final response = await _http.get('/crm/leads/activities/$id');
    final list = response is List ? response : (response is Map ? (response['data'] ?? const []) : const []);
    return (list as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// POST /crm/leads/activities/:id: one entry on the lead's timeline.
  Future<void> addLeadActivity(String id, String type, String description) async {
    await _http.post('/crm/leads/activities/$id', body: {'type': type, 'description': description});
  }

  /// POST /crm/leads/convert/:id: the deal is won. Links or creates the
  /// customer, records the value and moves the lead to the Won stage.
  Future<void> convertLead(String id, {num? value}) async {
    await _http.post('/crm/leads/convert/$id', body: {if (value != null) 'conversionValue': value});
  }

  /// POST /crm/leads/follow-up/:id: the next agreed contact date, on the lead
  /// and in its history.
  Future<void> setLeadFollowUp(String id, DateTime at, {String? notes}) async {
    await _http.post('/crm/leads/follow-up/$id', body: {
      'followUpDate': at.toUtc().toIso8601String(),
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  // Activity APIs (CRM endpoints)
  Future<List<ActivityModel>> getActivities({
    int page = 1,
    int limit = 20,
    String? relatedTo,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (relatedTo != null) 'relatedTo': relatedTo,
    };

    final response = await _http.get('/crm/activity/by-resource', queryParams: queryParams);

    final List<dynamic> data = response['data'] ?? response['results'] ?? [];
    return data.map((json) => ActivityModel.fromJson(json)).toList();
  }

  Future<ActivityModel> createActivity(Map<String, dynamic> activityData) async {
    final response = await _http.post('/crm/activity/manage', body: activityData);
    return ActivityModel.fromJson(response);
  }

  // Search API
  Future<List<dynamic>> search(String query, {String? type}) async {
    final response = await _http.post(
      '/repository/search',
      body: {
        'query': query,
        if (type != null) 'type': type,
      },
    );

    return response['results'] ?? [];
  }

  // NOTE: The following methods are DEPRECATED and should not be used.
  // Use RepositoryService instead for all repository operations.
  // These are kept only for backward compatibility.

  @deprecated
  Future<Map<String, dynamic>> getContacts({
    int page = 1,
    int pageSize = 1000,
    Map<String, dynamic>? query,
  }) async {
    final response = await _http.post(
      '/repository/find/customer',
      body: {
        'query': query ?? {},
        'options': {
          'page': page,
          'pageSize': pageSize,
        },
      },
    );

    return response;
  }

  @deprecated
  Future<dynamic> getContactById(String id) async {
    final response = await _http.get('/repository/get/customer/$id');
    return response;
  }

  @deprecated
  Future<dynamic> createContact(Map<String, dynamic> contactData) async {
    final sk = contactData['sk'] ?? 'customer-${DateTime.now().millisecondsSinceEpoch}';
    final response = await _http.post(
      '/repository/update/$sk',
      body: {
        'sk': sk,
        'datatype': 'customer',
        'data': contactData,
      },
    );
    return response;
  }

  @deprecated
  Future<dynamic> updateContact(String id, Map<String, dynamic> contactData) async {
    final response = await _http.post(
      '/repository/update/$id',
      body: {
        'sk': id,
        'datatype': 'customer',
        'data': contactData,
      },
    );
    return response;
  }

  @deprecated
  Future<void> deleteContact(String id) async {
    await _http.delete('/repository/delete/customer/$id');
  }

  // Reservation endpoints have moved to OperationsService
  // (lib/services/operations_service.dart). Use that for all reservation,
  // service-point, and queue-lifecycle operations. The legacy methods
  // that lived here were removed when the customer-facing booking flow
  // was retired in favor of the unified operations module.

  // Inbox/Messages API — server does the threading now.
  // Thread == (contact, channel). Source of truth: crm/inbox/conversations.

  /// Server-threaded conversations. Each row is (contact, channel) with the
  /// last-message summary already computed server-side.
  Future<List<dynamic>> getInboxConversations() async {
    final response = await _http.get('/crm/inbox/conversations');
    if (response is List) return response;
    if (response is Map) {
      return (response['data'] ?? response['items'] ?? response['conversations'] ?? []) as List;
    }
    return [];
  }

  /// Messages for one thread, scoped to a channel so an SMS thread never pulls
  /// in the contact's emails. Mirrors web `getConversationMessages(parties, _, channel)`
  /// → GET crm/inbox/conversations/{parties}?channel=.
  Future<Map<String, dynamic>> getConversationMessages(String parties, {String? channel}) async {
    final encoded = Uri.encodeComponent(parties);
    final response = await _http.get(
      '/crm/inbox/conversations/$encoded',
      queryParams: {
        if (channel != null && channel.isNotEmpty) 'channel': channel,
      },
    );
    if (response is Map<String, dynamic>) return response;
    if (response is List) return {'data': response};
    return {'data': []};
  }

  Future<List<dynamic>> getInboxMessages() async {
    // Real inbox channels only. Social (facebook/instagram/twitter/linkedin)
    // is NO LONGER in the inbox — it moved to the dedicated `social_activity`
    // datatype (see SocialActivityService). Also exclude ai-assistant / chat.
    const inboxChannels = [
      'email', 'sms', 'whatsapp', 'internal', 'website',
    ];
    const excludedTypes = ['ai-assistant', 'TrainGPT', 'chat', 'chatmessage', 'ai'];
    final response = await _http.post('/repository/find/message', body: {
      'query': {
        'data.deliveryType': {'\$in': inboxChannels},
        'data.type': {'\$nin': excludedTypes},
      },
      'options': {
        'page': 1,
        'pageSize': 30,
        'select': 'sk data.from data.to data.subject data.text data.deliveryType data.status data.type createdate modifydate',
      },
    });
    final list = (response['data'] ?? []) as List;
    // Client-side defense in depth: filter out any AI-like messages that
    // slip through the server query (older records may not have deliveryType set)
    return list.where((m) {
      if (m is! Map) return false;
      final data = m['data'] as Map?;
      if (data == null) return false;
      final type = (data['type'] ?? '').toString().toLowerCase();
      final deliveryType = (data['deliveryType'] ?? '').toString().toLowerCase();
      if (excludedTypes.map((e) => e.toLowerCase()).contains(type)) return false;
      if (!inboxChannels.contains(deliveryType)) return false;
      return true;
    }).toList();
  }

  // ─── Support Ticket Replies/Comments ───

  /// Get all customer-facing messages for a ticket
  Future<List<Map<String, dynamic>>> getTicketMessages(String ticketId) async {
    final response = await _http.get('/crm/tickets/messages/$ticketId');
    final data = response is Map ? (response['data'] ?? response['messages'] ?? response) : response;
    if (data is List) return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    return [];
  }

  /// Reply to a ticket (customer-facing)
  Future<Map<String, dynamic>> replyToTicket(String ticketId, {
    required String to,
    String? subject,
    String? text,
    String? html,
    String deliveryType = 'email',
    bool isStaffReply = true,
  }) async {
    final response = await _http.post('/crm/tickets/reply/$ticketId', body: {
      'to': to,
      if (subject != null) 'subject': subject,
      if (text != null) 'text': text,
      if (html != null) 'html': html,
      'deliveryType': deliveryType,
      'isStaffReply': isStaffReply,
    });
    return response is Map<String, dynamic> ? response : {};
  }

  /// Get internal staff comments for a ticket
  Future<List<Map<String, dynamic>>> getTicketComments(String ticketId) async {
    final response = await _http.get('/crm/tickets/comments/$ticketId');
    final data = response is Map ? (response['data'] ?? response['comments'] ?? response) : response;
    if (data is List) return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    return [];
  }

  /// Create or update a ticket through the support service (POST
  /// /crm/tickets/update), so a status change moves the ticket's support
  /// workflow and tells the customer, and a staff-made ticket gets its number
  /// and workflow. Pass the whole `data` (existing fields plus edits).
  Future<Map<String, dynamic>> saveTicket(Map<String, dynamic> data, {String? sk}) async {
    final response = await _http.post('/crm/tickets/update', body: {
      'datatype': 'ticket',
      if (sk != null && sk.isNotEmpty) 'sk': sk,
      'data': data,
    });
    return response is Map<String, dynamic> ? response : {};
  }

  /// Add internal staff comment to a ticket
  Future<Map<String, dynamic>> addTicketComment(String ticketId, String message) async {
    final response = await _http.post('/crm/tickets/comments/$ticketId', body: {'message': message});
    return response is Map<String, dynamic> ? response : {};
  }

  /// Send a message (email, sms, whatsapp, internal, etc.)
  /// Accepts flexible input: `to`, `subject`, `body`/`text`/`html`, `messageType`/`deliveryType`.
  /// Normalizes into the `/crm/inbox/update?send=true` format which wraps the message
  /// in a BaseModel and triggers the SendNotificationCommand on the server.
  Future<dynamic> sendMessage(Map<String, dynamic> messageData) async {
    final deliveryType = (messageData['deliveryType'] ?? messageData['messageType'] ?? 'email').toString();
    final rawTo = messageData['to'];
    final toList = rawTo is List
        ? rawTo.map((e) => e.toString()).toList()
        : [(rawTo ?? '').toString()].where((s) => s.isNotEmpty).toList();

    final body = (messageData['body'] ?? messageData['text'] ?? messageData['html'] ?? '').toString();
    final bodyType = (messageData['bodyType'] ?? 'text').toString();

    final data = <String, dynamic>{
      'to': toList,
      'deliveryType': deliveryType,
      'type': 'message',
      'status': 'draft',
      if (messageData['from'] != null) 'from': messageData['from'],
      if (messageData['subject'] != null) 'subject': messageData['subject'],
      if (messageData['context'] != null) 'context': messageData['context'],
    };
    if (bodyType == 'html') {
      data['html'] = body;
      // The plain-text part: tags out and HTML entities back to characters
      // (it read "I&#39;ll" in the customer's mail).
      data['text'] = body
          .replaceAll(RegExp(r'<[^>]*>'), ' ')
          .replaceAll('&#39;', "'")
          .replaceAll('&quot;', '"')
          .replaceAll('&lt;', '<')
          .replaceAll('&gt;', '>')
          .replaceAll('&nbsp;', ' ')
          .replaceAll('&amp;', '&')
          .replaceAll(RegExp(r'\s+'), ' ')
          .trim();
    } else {
      data['text'] = body;
    }

    final payload = {
      'datatype': 'message',
      'data': data,
    };
    final response = await _http.post('/crm/inbox/update?send=true', body: payload);
    return response;
  }
}
