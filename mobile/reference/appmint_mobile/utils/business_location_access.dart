/// Mirrors the server's content.update requirement for location edits.
/// This controls UI availability; the repository still authorizes each write.
bool canManageBusinessLocation(Map<String, dynamic>? user) {
  final data = user?['data'];
  final permissions = data is Map ? data['permissions'] : null;
  final content = permissions is Map ? permissions['content'] : null;
  return content is List && content.contains('update');
}
