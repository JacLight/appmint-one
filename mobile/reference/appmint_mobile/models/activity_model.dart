class ActivityModel {
  final String id;
  final String type;
  final String? title;
  final String? description;
  final String? status;
  final String? relatedTo;
  final String? relatedType;
  final Map<String, dynamic>? metadata;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? createdBy;

  ActivityModel({
    required this.id,
    required this.type,
    this.title,
    this.description,
    this.status,
    this.relatedTo,
    this.relatedType,
    this.metadata,
    this.createdAt,
    this.updatedAt,
    this.createdBy,
  });

  factory ActivityModel.fromJson(Map<String, dynamic> json) {
    return ActivityModel(
      id: json['_id'] ?? json['id'] ?? '',
      type: json['type'] ?? 'general',
      title: json['title'],
      description: json['description'],
      status: json['status'],
      relatedTo: json['relatedTo'] ?? json['related_to'],
      relatedType: json['relatedType'] ?? json['related_type'],
      metadata: json['metadata'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : null,
      createdBy: json['createdBy'] ?? json['created_by'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'type': type,
      'title': title,
      'description': description,
      'status': status,
      'relatedTo': relatedTo,
      'relatedType': relatedType,
      'metadata': metadata,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'createdBy': createdBy,
    };
  }
}
