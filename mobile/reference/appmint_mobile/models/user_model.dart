class UserModel {
  final String id;
  final String email;
  final String? username;
  final String? firstName;
  final String? lastName;
  /// Primary personal phone (free text). Schema field: `phone`.
  final String? phone;
  /// Company phone numbers assigned to this user. Schema field: `phones` —
  /// an array of `phoneNumber` references to phone records. These are the
  /// Twilio numbers the user can call/text from.
  final List<String> phones;
  /// Company email accounts assigned to this user.
  final List<String> emails;
  final String? avatar;
  final List<String> roles;
  final List<String> permissions;
  final Map<String, dynamic>? metadata;

  UserModel({
    required this.id,
    required this.email,
    this.username,
    this.firstName,
    this.lastName,
    this.phone,
    this.phones = const [],
    this.emails = const [],
    this.avatar,
    this.roles = const [],
    this.permissions = const [],
    this.metadata,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // Server may nest user fields inside 'data' (Appengine BaseModel format)
    final data = json['data'] as Map<String, dynamic>? ?? {};

    List<String> strList(dynamic v) {
      if (v is List) {
        return v.map((e) => e?.toString() ?? '').where((s) => s.isNotEmpty).toList();
      }
      return const [];
    }

    return UserModel(
      id: json['_id'] ?? json['id'] ?? json['sk'] ?? '',
      email: data['email'] ?? json['email'] ?? '',
      username: data['username'] ?? json['username'],
      firstName: data['firstName'] ?? json['firstName'] ?? json['first_name'],
      lastName: data['lastName'] ?? json['lastName'] ?? json['last_name'],
      phone: (data['phone'] ?? json['phone'])?.toString(),
      phones: strList(data['phones'] ?? json['phones']),
      emails: strList(data['emails'] ?? json['emails']),
      avatar: data['portrait']?['url'] ?? json['avatar'] ?? json['avatarUrl'],
      roles: data['roles'] != null
          ? List<String>.from(data['roles'])
          : (json['roles'] != null ? List<String>.from(json['roles']) : []),
      permissions: json['permissions'] != null
          ? List<String>.from(json['permissions'])
          : [],
      metadata: data.isNotEmpty ? data : json['metadata'],
    );
  }

  /// First assigned company phone (the primary Twilio number for this user).
  /// Use this for outbound caller ID, not the personal `phone` field.
  String? get primaryAssignedPhone => phones.isNotEmpty ? phones.first : null;

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'email': email,
      'username': username,
      'firstName': firstName,
      'lastName': lastName,
      'phone': phone,
      'phones': phones,
      'emails': emails,
      'avatar': avatar,
      'roles': roles,
      'permissions': permissions,
      'metadata': metadata,
    };
  }

  String get displayName {
    if (firstName != null && lastName != null) {
      return '$firstName $lastName';
    }
    return username ?? email;
  }

  String get initials {
    if (firstName != null && firstName!.isNotEmpty && lastName != null && lastName!.isNotEmpty) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (username != null && username!.length >= 2) {
      return username!.substring(0, 2).toUpperCase();
    }
    if (email.length >= 2) {
      return email.substring(0, 2).toUpperCase();
    }
    if (email.isNotEmpty) {
      return email[0].toUpperCase();
    }
    return 'U';
  }
}
