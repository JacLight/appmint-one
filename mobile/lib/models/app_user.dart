/// Signed-in user. Kept deliberately small — Stowbo only needs identity +
/// contact for the custody handoff.
class AppUser {
  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;

  AppUser({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.phone,
  });

  String get displayName {
    final n = [firstName, lastName].where((s) => (s ?? '').isNotEmpty).join(' ');
    return n.isNotEmpty ? n : email;
  }

  factory AppUser.fromJson(Map<String, dynamic> json) {
    // Server nests the profile under `data` on some responses.
    final data = (json['data'] is Map)
        ? Map<String, dynamic>.from(json['data'])
        : json;
    // For appengine customer records, `sk` is the id and `name` is the email.
    final nameLooksLikeEmail =
        (json['name'] ?? '').toString().contains('@');
    return AppUser(
      id: (json['id'] ?? json['sk'] ?? data['id'] ?? data['sk'] ?? '')
          .toString(),
      email: (data['email'] ??
              json['email'] ??
              (nameLooksLikeEmail ? json['name'] : '') ??
              '')
          .toString(),
      firstName: (data['firstName'] ?? data['firstname'])?.toString(),
      lastName: (data['lastName'] ?? data['lastname'])?.toString(),
      phone: (data['phone'] ?? data['telephone'])?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
      };
}
