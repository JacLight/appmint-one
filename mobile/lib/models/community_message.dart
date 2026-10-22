/// A 1:1 direct message from the community API (`community_message` records).
/// Threads are keyed by the sorted pair of participant emails; a message
/// identifies its parties by email.
class CommunityMessage {
  final String id;
  final String sender; // email
  final String recipient; // email
  final String content;
  final String contentType; // text | image | file | link | ...
  final String status; // sent | read
  final DateTime? sentAt;
  final Map<String, dynamic>? context; // e.g. { bookingId }

  CommunityMessage({
    required this.id,
    required this.sender,
    required this.recipient,
    required this.content,
    this.contentType = 'text',
    this.status = 'sent',
    this.sentAt,
    this.context,
  });

  bool mine(String myEmail) =>
      sender.toLowerCase() == myEmail.toLowerCase();

  static DateTime? _dt(dynamic v) =>
      v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

  factory CommunityMessage.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map)
        ? Map<String, dynamic>.from(json['data'])
        : json;
    return CommunityMessage(
      id: (json['sk'] ?? json['id'] ?? data['id'] ?? data['sk'] ?? '')
          .toString(),
      sender: (data['sender'] ?? data['from'] ?? '').toString(),
      recipient: (data['recipient'] ?? data['to'] ?? '').toString(),
      content: (data['content'] ?? data['text'] ?? '').toString(),
      contentType: (data['contentType'] ?? 'text').toString(),
      status: (data['status'] ?? 'sent').toString(),
      sentAt: _dt(data['sentAt'] ?? json['createdate']),
      context: data['context'] is Map
          ? Map<String, dynamic>.from(data['context'])
          : null,
    );
  }
}
