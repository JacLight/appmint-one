import 'dart:math';
import '../services/storage_service.dart';

/// Creates BaseModel data matching the React genericService.createBaseData()
/// Used for all server mutations (create/update via repository or CRM endpoints)
class BaseDataService {
  static final BaseDataService _instance = BaseDataService._internal();
  factory BaseDataService() => _instance;
  BaseDataService._internal();

  final StorageService _storage = StorageService();

  /// Create a new BaseModel structure matching the server's expected format
  /// Equivalent to React: genericService.createBaseData(datatype, subType, data)
  Future<Map<String, dynamic>> createBaseData(
    String datatype,
    Map<String, dynamic> data, {
    String? subType,
    String? author,
  }) async {
    if (author == null) {
      final user = await _storage.getUser();
      author = user?.email ?? user?.username ?? '';
    }

    final baseModel = <String, dynamic>{
      'pk': '',
      'sk': '',
      'name': '',
      'datatype': datatype,
      'data': data,
      'isNew': true,
      'version': 0,
      'author': author,
      'create_hash': _uuid(),
    };

    if (subType != null && subType.isNotEmpty) {
      baseModel['subschema'] = subType;
    }

    return baseModel;
  }

  String _uuid() {
    final rng = Random();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}

final baseDataService = BaseDataService();
