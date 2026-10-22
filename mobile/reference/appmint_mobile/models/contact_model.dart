class ContactModel {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? company;
  final String? title;
  final String? avatar;
  final ContactSource source; // appmint or device
  final DateTime? lastContactDate;
  final Map<String, dynamic>? metadata;

  ContactModel({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.company,
    this.title,
    this.avatar,
    this.source = ContactSource.appmint,
    this.lastContactDate,
    this.metadata,
  });

  String get initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    if (name.length >= 2) {
      return name.substring(0, 2).toUpperCase();
    }
    if (name.isNotEmpty) {
      return name[0].toUpperCase();
    }
    return 'C';
  }

  /// The phone as people read it: a US number stored as +15125550124 shows
  /// as (512) 555-0124. Other numbers show as stored. Dial with [phone].
  String? get displayPhone {
    final p = phone;
    if (p == null) return null;
    return formatPhone(p);
  }

  /// [displayPhone] for any stored number (customer records, pickers).
  static String formatPhone(String p) {
    final digits = p.replaceAll(RegExp(r'\D'), '');
    final us = digits.length == 11 && digits.startsWith('1') ? digits.substring(1) : digits.length == 10 ? digits : null;
    if (us == null) return p;
    return '(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}';
  }

  String get displayName {
    if (company != null && company!.isNotEmpty) {
      return '$name • $company';
    }
    return name;
  }

  factory ContactModel.fromJson(Map<String, dynamic> json, {ContactSource? source}) {
    return ContactModel(
      id: json['id']?.toString() ?? '',
      name: json['name'] ?? json['displayName'] ?? 'Unknown',
      email: json['email'],
      phone: json['phone'] ?? json['phoneNumber'],
      company: json['company'] ?? json['organization'],
      title: json['title'] ?? json['jobTitle'],
      avatar: json['avatar'] ?? json['photoUrl'],
      source: source ?? ContactSource.appmint,
      lastContactDate: json['lastContactDate'] != null
          ? DateTime.parse(json['lastContactDate'])
          : null,
      metadata: json['metadata'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'company': company,
      'title': title,
      'avatar': avatar,
      'source': source.name,
      'lastContactDate': lastContactDate?.toIso8601String(),
      'metadata': metadata,
    };
  }
}

enum ContactSource {
  appmint,
  device,
}
