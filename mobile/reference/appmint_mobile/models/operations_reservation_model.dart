// Operations-side reservation model — queue lifecycle (waiting / notified /
// in_progress / completed / no_show) plus the booking lifecycle. Mirrors
// the 2026-04-29 SDK update at /Users/imzee/projects/sdk/src/models/crm/crm-reservation.ts.
//
// Separate from lib/models/reservation_model.dart (which is the customer-
// facing booking-only model) so the two surfaces evolve independently.

class OpsReservation {
  /// Server-side primary key. Empty for new (unsaved) reservations.
  final String sk;
  /// 8-char display number stamped at create.
  final String? number;
  /// One of:
  ///   booking lifecycle: 'new' | 'confirmed' | 'rescheduled' | 'cancelled'
  ///   queue lifecycle:   'waiting' | 'notified' | 'in_progress' | 'completed' | 'no_show'
  /// Both share the same enum (see crm-reservation.ts:21).
  final String status;
  final String? definition;
  final String? reservationDefinitionId;
  final String? businessLocationId;
  /// 'service_point' | 'pipeline' | 'event' | 'interval'
  final String? targetType;
  final String? servicePointId;
  /// For targetType='pipeline'.
  final String? workflowName;
  final String? currentStageId;
  /// 'walk-in' | 'phone' | 'online' | 'partner' | 'kiosk' | 'agent' | 'email'
  final String source;
  final String? joinedAt;
  final String? notifiedAt;
  final String? startedAt;
  final String? completedAt;
  final num? position;

  final OpsReservationCustomer? customer;
  final num? partySize;
  final String? service;
  final String? venue;
  final String? startTime;
  final String? endTime;
  final String? timezone;
  final String? notes;
  /// Stamped by the server once the booking was handed to the live check-in queue.
  final String? checkedInAt;
  final String? checkInTaskId;

  const OpsReservation({
    this.sk = '',
    this.number,
    this.status = 'new',
    this.definition,
    this.reservationDefinitionId,
    this.businessLocationId,
    this.targetType,
    this.servicePointId,
    this.workflowName,
    this.currentStageId,
    this.source = 'online',
    this.joinedAt,
    this.notifiedAt,
    this.startedAt,
    this.completedAt,
    this.position,
    this.customer,
    this.partySize,
    this.service,
    this.venue,
    this.startTime,
    this.endTime,
    this.timezone,
    this.notes,
    this.checkedInAt,
    this.checkInTaskId,
  });

  factory OpsReservation.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map ? json['data'] : json) as Map;
    return OpsReservation(
      sk: (json['sk'] ?? data['sk'] ?? '').toString(),
      number: data['name']?.toString(),
      status: (data['status'] ?? 'new').toString(),
      definition: data['definition']?.toString(),
      reservationDefinitionId: data['reservationDefinitionId']?.toString(),
      businessLocationId: data['businessLocationId']?.toString() ??
          data['businessLocation']?.toString(),
      targetType: data['targetType']?.toString(),
      servicePointId: data['servicePointId']?.toString(),
      workflowName: data['workflowName']?.toString(),
      currentStageId: data['currentStageId']?.toString(),
      source: (data['source'] ?? 'online').toString(),
      joinedAt: data['joinedAt']?.toString(),
      notifiedAt: data['notifiedAt']?.toString(),
      startedAt: data['startedAt']?.toString(),
      completedAt: data['completedAt']?.toString(),
      position: data['position'] is num ? data['position'] as num : null,
      customer: data['customer'] is Map
          ? OpsReservationCustomer.fromJson(Map<String, dynamic>.from(data['customer']))
          : null,
      partySize: data['partySize'] is num ? data['partySize'] as num : null,
      service: data['service']?.toString(),
      venue: data['venue']?.toString(),
      startTime: data['startTime']?.toString(),
      endTime: data['endTime']?.toString(),
      timezone: data['timezone']?.toString(),
      notes: data['notes']?.toString(),
      checkedInAt: data['checkedInAt']?.toString(),
      checkInTaskId: data['checkInTaskId']?.toString(),
    );
  }

  /// Wrapped body for /crm/reservations/create or /update.
  Map<String, dynamic> toCreateBody() {
    final inner = <String, dynamic>{
      'status': status,
      if (definition != null) 'definition': definition,
      if (reservationDefinitionId != null) 'reservationDefinitionId': reservationDefinitionId,
      if (businessLocationId != null) 'businessLocationId': businessLocationId,
      if (targetType != null) 'targetType': targetType,
      if (servicePointId != null) 'servicePointId': servicePointId,
      if (workflowName != null) 'workflowName': workflowName,
      'source': source,
      if (joinedAt != null) 'joinedAt': joinedAt,
      if (notifiedAt != null) 'notifiedAt': notifiedAt,
      if (startedAt != null) 'startedAt': startedAt,
      if (completedAt != null) 'completedAt': completedAt,
      if (customer != null) 'customer': customer!.toJson(),
      if (partySize != null) 'partySize': partySize,
      if (service != null) 'service': service,
      if (venue != null) 'venue': venue,
      if (startTime != null) 'startTime': startTime,
      if (endTime != null) 'endTime': endTime,
      if (timezone != null) 'timezone': timezone,
      if (notes != null) 'notes': notes,
      if (checkedInAt != null) 'checkedInAt': checkedInAt,
      if (checkInTaskId != null) 'checkInTaskId': checkInTaskId,
    };
    return {
      if (sk.isNotEmpty) 'sk': sk,
      'datatype': 'reservation',
      'data': inner,
    };
  }

  /// Flat fields for POST /crm/reservations/create. The server treats a body
  /// that carries `data` as an already-built record and rejects it as "not
  /// new"; a flat body goes through createNewData like the desktop's does.
  Map<String, dynamic> toCreatePayload() =>
      Map<String, dynamic>.from(toCreateBody()['data'] as Map);

  String get displayLabel {
    final n = customer?.name?.trim() ?? '';
    if (n.isNotEmpty) return n;
    if (number != null && number!.isNotEmpty) return 'Resv ${number!}';
    return 'Reservation';
  }

  bool get isQueueStage =>
      status == 'waiting' ||
      status == 'notified' ||
      status == 'in_progress';

  OpsReservation copyWith({
    String? status,
    String? servicePointId,
    String? workflowName,
    String? joinedAt,
    String? notifiedAt,
    String? startedAt,
    String? completedAt,
    OpsReservationCustomer? customer,
    num? partySize,
    String? notes,
    String? checkedInAt,
    String? checkInTaskId,
  }) {
    return OpsReservation(
      sk: sk,
      number: number,
      status: status ?? this.status,
      definition: definition,
      reservationDefinitionId: reservationDefinitionId,
      businessLocationId: businessLocationId,
      targetType: targetType,
      servicePointId: servicePointId ?? this.servicePointId,
      workflowName: workflowName ?? this.workflowName,
      currentStageId: currentStageId,
      source: source,
      joinedAt: joinedAt ?? this.joinedAt,
      notifiedAt: notifiedAt ?? this.notifiedAt,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
      position: position,
      customer: customer ?? this.customer,
      partySize: partySize ?? this.partySize,
      service: service,
      venue: venue,
      startTime: startTime,
      endTime: endTime,
      timezone: timezone,
      notes: notes ?? this.notes,
      checkedInAt: checkedInAt ?? this.checkedInAt,
      checkInTaskId: checkInTaskId ?? this.checkInTaskId,
    );
  }
}

class OpsReservationCustomer {
  final String? name;
  final String? email;
  final String? phone;
  const OpsReservationCustomer({this.name, this.email, this.phone});

  factory OpsReservationCustomer.fromJson(Map<String, dynamic> json) =>
      OpsReservationCustomer(
        name: json['name']?.toString(),
        email: json['email']?.toString(),
        phone: json['phone']?.toString(),
      );

  Map<String, dynamic> toJson() => {
        if (name != null) 'name': name,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      };
}

/// Recursive spatial node (floor / section / table / seat / room / bay / chair).
/// Hierarchy via parentName.
class ServicePoint {
  final String sk;
  final String name;
  final String? displayName;
  final String? description;
  final String? kind;
  final String? businessLocationId;
  final String? parentName;
  final num? level;
  final num? sortOrder;
  final num? capacity;
  final String? shape;
  final num? x;
  final num? y;
  final num? width;
  final num? height;
  final num? rotation;
  final String? color;
  final bool bookable;
  final bool isActive;
  /// 'available' | 'occupied' | 'reserved' | 'dirty' | 'blocked' | 'closed'
  final String status;
  final String? currentReservationId;
  final String? currentServerId;
  final num? currentPartySize;
  final String? seatedAt;
  final String? estimatedEndTime;
  final List<String> features;
  /// Server-managed occupancy + audit fields. Carried through so a full-record
  /// edit (rename/capacity) never erases the table↔tab link or audit trail.
  final String? currentTabId;
  final String? lastStatusChangeAt;
  final String? lastStatusReason;
  /// A table held for a booking (status 'reserved'): when the hold ends, the
  /// booking's start plus its check-in grace period. Server-managed.
  final String? heldUntil;
  /// Record version — sent back on update so the backend's stale-write guard
  /// works and version doesn't compute to NaN.
  final num? version;

  const ServicePoint({
    required this.sk,
    required this.name,
    this.displayName,
    this.description,
    this.kind,
    this.businessLocationId,
    this.parentName,
    this.level,
    this.sortOrder,
    this.capacity,
    this.shape,
    this.x,
    this.y,
    this.width,
    this.height,
    this.rotation,
    this.color,
    this.bookable = true,
    this.isActive = true,
    this.status = 'available',
    this.currentReservationId,
    this.currentServerId,
    this.currentPartySize,
    this.seatedAt,
    this.estimatedEndTime,
    this.features = const [],
    this.currentTabId,
    this.lastStatusChangeAt,
    this.lastStatusReason,
    this.heldUntil,
    this.version,
  });

  factory ServicePoint.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map ? json['data'] : json) as Map;
    final feats = <String>[];
    if (data['features'] is List) {
      for (final f in data['features'] as List) {
        feats.add(f.toString());
      }
    }
    return ServicePoint(
      sk: (json['sk'] ?? data['sk'] ?? '').toString(),
      name: (data['name'] ?? '').toString(),
      displayName: data['displayName']?.toString(),
      description: data['description']?.toString(),
      kind: data['kind']?.toString(),
      businessLocationId: data['businessLocationId']?.toString() ??
          data['businessLocation']?.toString(),
      parentName: data['parentName']?.toString(),
      level: data['level'] is num ? data['level'] as num : null,
      sortOrder: data['sortOrder'] is num ? data['sortOrder'] as num : null,
      capacity: data['capacity'] is num ? data['capacity'] as num : null,
      shape: data['shape']?.toString(),
      x: data['x'] is num ? data['x'] as num : null,
      y: data['y'] is num ? data['y'] as num : null,
      width: data['width'] is num ? data['width'] as num : null,
      height: data['height'] is num ? data['height'] as num : null,
      rotation: data['rotation'] is num ? data['rotation'] as num : null,
      color: data['color']?.toString(),
      bookable: data['bookable'] != false,
      isActive: data['isActive'] != false,
      status: (data['status'] ?? 'available').toString(),
      currentReservationId: data['currentReservationId']?.toString(),
      currentServerId: data['currentServerId']?.toString(),
      currentPartySize:
          data['currentPartySize'] is num ? data['currentPartySize'] as num : null,
      seatedAt: data['seatedAt']?.toString(),
      estimatedEndTime: data['estimatedEndTime']?.toString(),
      features: feats,
      currentTabId: data['currentTabId']?.toString(),
      lastStatusChangeAt: data['lastStatusChangeAt']?.toString(),
      lastStatusReason: data['lastStatusReason']?.toString(),
      heldUntil: data['heldUntil']?.toString(),
      version: json['version'] is num ? json['version'] as num : (data['version'] is num ? data['version'] as num : null),
    );
  }

  String get displayLabel {
    final n = (displayName ?? '').trim();
    if (n.isNotEmpty) return n;
    return name;
  }

  Map<String, dynamic> toCreateBody() => {
        if (sk.isNotEmpty) 'sk': sk,
        if (version != null) 'version': version,
        'datatype': 'service_point',
        'data': {
          'name': name,
          if (displayName != null) 'displayName': displayName,
          if (description != null) 'description': description,
          if (kind != null) 'kind': kind,
          if (businessLocationId != null) 'businessLocationId': businessLocationId,
          if (parentName != null) 'parentName': parentName,
          if (level != null) 'level': level,
          if (sortOrder != null) 'sortOrder': sortOrder,
          if (capacity != null) 'capacity': capacity,
          if (shape != null) 'shape': shape,
          if (x != null) 'x': x,
          if (y != null) 'y': y,
          if (width != null) 'width': width,
          if (height != null) 'height': height,
          if (rotation != null) 'rotation': rotation,
          if (color != null) 'color': color,
          'bookable': bookable,
          'isActive': isActive,
          'status': status,
          if (currentReservationId != null) 'currentReservationId': currentReservationId,
          if (currentServerId != null) 'currentServerId': currentServerId,
          if (currentPartySize != null) 'currentPartySize': currentPartySize,
          if (seatedAt != null) 'seatedAt': seatedAt,
          if (estimatedEndTime != null) 'estimatedEndTime': estimatedEndTime,
          if (features.isNotEmpty) 'features': features,
          // Preserve server-managed occupancy/audit fields on full-record edits.
          if (currentTabId != null) 'currentTabId': currentTabId,
          if (lastStatusChangeAt != null) 'lastStatusChangeAt': lastStatusChangeAt,
          if (lastStatusReason != null) 'lastStatusReason': lastStatusReason,
          if (heldUntil != null) 'heldUntil': heldUntil,
        },
      };

  bool get isAvailable => status == 'available';
  bool get isOccupied => status == 'occupied' || status == 'reserved';

  ServicePoint copyWith({
    String? status,
    String? currentReservationId,
    String? currentServerId,
    num? currentPartySize,
    String? seatedAt,
  }) {
    return ServicePoint(
      sk: sk, name: name, displayName: displayName, description: description,
      kind: kind, businessLocationId: businessLocationId, parentName: parentName,
      level: level, sortOrder: sortOrder, capacity: capacity, shape: shape,
      x: x, y: y, width: width, height: height, rotation: rotation, color: color,
      bookable: bookable, isActive: isActive,
      status: status ?? this.status,
      currentReservationId: currentReservationId ?? this.currentReservationId,
      currentServerId: currentServerId ?? this.currentServerId,
      currentPartySize: currentPartySize ?? this.currentPartySize,
      seatedAt: seatedAt ?? this.seatedAt,
      estimatedEndTime: estimatedEndTime,
      features: features,
      currentTabId: currentTabId,
      lastStatusChangeAt: lastStatusChangeAt,
      lastStatusReason: lastStatusReason,
      heldUntil: heldUntil,
      version: version,
    );
  }
}
