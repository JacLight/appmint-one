import 'package:flutter/foundation.dart';
import '../models/contact_model.dart';
import '../services/repository_service.dart';

class ContactsProvider extends ChangeNotifier {
  final RepositoryService _repository = repositoryService;

  List<ContactModel> _appmintContacts = [];
  List<ContactModel> _deviceContacts = [];
  bool _isLoading = false;
  String? _errorMessage;
  String _searchQuery = '';

  List<ContactModel> get appmintContacts => _appmintContacts;
  List<ContactModel> get deviceContacts => _deviceContacts;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // Get all contacts (merged)
  List<ContactModel> get allContacts {
    final combined = [..._appmintContacts, ..._deviceContacts];

    if (_searchQuery.isEmpty) {
      // Sort by name
      combined.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      return combined;
    }

    // Filter by search query
    final query = _searchQuery.toLowerCase();
    return combined.where((contact) {
      return contact.name.toLowerCase().contains(query) ||
          (contact.email?.toLowerCase().contains(query) ?? false) ||
          (contact.phone?.contains(query) ?? false) ||
          (contact.company?.toLowerCase().contains(query) ?? false);
    }).toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  }

  // Set search query
  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  // Fetch Appmint contacts (from CRM)
  Future<void> fetchAppmintContacts() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Use centralized RepositoryService
      final response = await _repository.findData('customer', options: {'pageSize': 1000});

      // Parse contacts from response
      final List<dynamic> data = response['data'] ?? [];

      _appmintContacts = data.map((item) {
        final contactData = item['data'] ?? {};
        final String firstName = contactData['firstName'] ?? '';
        final String lastName = contactData['lastName'] ?? '';
        // The person's name first: a record's top-level `name` is often its
        // username (an email), so leads saved as customers read as addresses.
        final String fullName = '$firstName $lastName'.trim();
        final String name = (contactData['name'] ?? '').toString().trim().isNotEmpty
            ? contactData['name'].toString().trim()
            : fullName.isNotEmpty ? fullName : (item['name'] ?? '').toString();

        return ContactModel(
          id: item['sk'] ?? item['id'] ?? '',
          name: name.isNotEmpty ? name : 'Unnamed Contact',
          email: contactData['email'],
          phone: contactData['phone'],
          company: contactData['company'] ?? contactData['companyName'],
          title: contactData['jobTitle'] ?? contactData['title'],
          source: ContactSource.appmint,
          avatar: contactData['avatar'],
          lastContactDate: item['modifydate'] != null
              ? DateTime.tryParse(item['modifydate'].toString())
              : null,
        );
      }).toList();

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        print('Failed to load Appmint contacts: $e');
      }
      _errorMessage = 'Failed to load Appmint contacts: $e';
      _isLoading = false;
      notifyListeners();
    }
  }

  // Fetch device contacts
  Future<void> fetchDeviceContacts() async {
    try {
      // TODO: Implement actual device contacts fetching
      // This requires platform-specific permissions
      // For web, this won't work - we'll show a message

      if (kIsWeb) {
        // Web doesn't support device contacts
        _deviceContacts = [];
        return;
      }

      // For now, device contacts are empty
      // Will need to implement platform-specific contact access
      _deviceContacts = [];
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        print('Failed to load device contacts: $e');
      }
      // Don't show error for device contacts - it's optional
      _deviceContacts = [];
    }
  }

  // Refresh all contacts
  Future<void> refreshContacts() async {
    await Future.wait([
      fetchAppmintContacts(),
      fetchDeviceContacts(),
    ]);
  }

  // Get contact by ID
  ContactModel? getContactById(String id) {
    try {
      return allContacts.firstWhere((c) => c.id == id);
    } catch (e) {
      return null;
    }
  }

  // Get contact by phone number
  ContactModel? getContactByPhone(String phone) {
    try {
      final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
      return allContacts.firstWhere(
        (c) => c.phone?.replaceAll(RegExp(r'[^\d+]'), '') == cleanPhone,
      );
    } catch (e) {
      return null;
    }
  }
}
