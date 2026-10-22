// POS order + line item models. Match the SF order schema at
// /Users/imzee/projects/sdk/src/models/storefront/sf-order.ts but trimmed
// to the fields the mobile POS UI actually uses (a tab in v1 = an order
// with status 'new' filtered by businessLocationId).
//
// Server payload shape — order lives at the document root inside `data`,
// e.g. { sk, datatype: 'sf_order', data: { status, productItems, ... } }.
// We unwrap on the client so callers see a flat PosOrder.

/// Numbers come back from the server as num OR string ("5368" was seen on a
/// live order). A hard `as num` cast on one bad record used to throw and empty
/// the whole open-tabs list, so every money/qty field goes through this.
num _num(dynamic v, [num fallback = 0]) {
  if (v is num) return v;
  if (v is String) return num.tryParse(v.trim()) ?? fallback;
  return fallback;
}

String? _nonEmpty(dynamic v) {
  final s = v?.toString().trim() ?? '';
  return s.isEmpty ? null : s;
}

/// The first non-empty string of a list (catalog categories), else null.
String? _firstString(dynamic v) {
  if (v is! List) return null;
  for (final e in v) {
    final s = e?.toString().trim() ?? '';
    if (s.isNotEmpty) return s;
  }
  return null;
}

/// One row in firedTaskIds[]. Bookkeeping for fire/refire across multiple
/// pipelines per line item (sf-order.ts:189-207).

class PosLineFire {
  final String taskId;
  final String workflowId;
  final String? firedAt;
  final String? firedBy;
  /// 'active' | 'cancelled' | 'superseded'
  final String status;

  const PosLineFire({
    required this.taskId,
    required this.workflowId,
    this.firedAt,
    this.firedBy,
    this.status = 'active',
  });

  factory PosLineFire.fromJson(Map<String, dynamic> json) => PosLineFire(
        taskId: (json['taskId'] ?? '').toString(),
        workflowId: (json['workflowId'] ?? '').toString(),
        firedAt: json['firedAt']?.toString(),
        firedBy: json['firedBy']?.toString(),
        status: (json['status'] ?? 'active').toString(),
      );

  Map<String, dynamic> toJson() => {
        'taskId': taskId,
        'workflowId': workflowId,
        if (firedAt != null) 'firedAt': firedAt,
        if (firedBy != null) 'firedBy': firedBy,
        'status': status,
      };
}

class PosLineItem {
  /// Stable per-line id used for fire bookkeeping (sf-order.ts:11-14).
  /// Generated client-side for new lines; preserved across edits.
  final String id;
  final String sku;
  final String name;
  final String? image;
  final num quantity;
  final num unitPrice;
  final num amount;
  final num discount;
  final String? categoryId;
  /// One of: product | rental | fee | addon
  final String itemType;
  final String? parentSku;
  /// Selected option values, e.g. [{name:'Size', value:'L'}]
  final List<Map<String, String>> options;
  /// Free text the operator typed for this line
  final String? specialInstructions;
  /// The guest's seat at the table ("1", "2"…); null = shared by the table.
  /// sf_order productItems[].seat — used for per-guest tickets and split by seat.
  final String? seat;
  /// Course for the kitchen (appetizer, main, dessert, drinks, side);
  /// defaults to the product's workflow.defaultCourse. sf_order productItems[].course.
  final String? course;
  /// Pre-suggested workflow inherited from sf_product.workflow.workflowId.
  /// Operator can override at fire time.
  final String? suggestedWorkflowId;
  /// Tasks this line has been fired into. Newest = current.
  final List<PosLineFire> firedTaskIds;
  /// Server stamps this flat field directly on the line item when the
  /// line fires through `/storefront/order/:id/fire`. Presence of a
  /// taskId IS the "sent" indicator — drives the cart's "FIRED" pill +
  /// blocks re-fire of the same line.
  final String? taskId;
  /// Server-enriched live task state — present on `/storefront/pos/tabs`
  /// responses. Shape: `{ stageName, status, dueDate, ... }`. Used by the
  /// Tabs view to surface "Ready" / "Overdue" badges per tab.
  final Map<String, dynamic>? task;

  const PosLineItem({
    this.id = '',
    required this.sku,
    required this.name,
    this.image,
    this.quantity = 1,
    this.unitPrice = 0,
    this.amount = 0,
    this.discount = 0,
    this.categoryId,
    this.itemType = 'product',
    this.parentSku,
    this.options = const [],
    this.specialInstructions,
    this.seat,
    this.course,
    this.suggestedWorkflowId,
    this.firedTaskIds = const [],
    this.taskId,
    this.task,
  });

  factory PosLineItem.fromJson(Map<String, dynamic> json) {
    final qty = _num(json['quantity'], 1);
    final unit = _num(json['unitPrice']);
    final List<Map<String, String>> opts = [];
    final rawOpts = json['options'];
    if (rawOpts is List) {
      for (final o in rawOpts) {
        if (o is Map) {
          opts.add({
            'name': (o['name'] ?? '').toString(),
            'value': (o['value'] ?? '').toString(),
          });
        }
      }
    }
    final fires = <PosLineFire>[];
    final rawFires = json['firedTaskIds'];
    if (rawFires is List) {
      for (final f in rawFires) {
        if (f is Map) fires.add(PosLineFire.fromJson(Map<String, dynamic>.from(f)));
      }
    }
    return PosLineItem(
      id: (json['id'] ?? '').toString(),
      sku: (json['sku'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      image: json['image']?.toString(),
      quantity: qty,
      unitPrice: unit,
      amount: json['amount'] == null ? qty * unit : _num(json['amount'], qty * unit),
      discount: _num(json['discount']),
      categoryId: json['categoryId']?.toString(),
      itemType: (json['itemType'] ?? 'product').toString(),
      parentSku: json['parentSku']?.toString(),
      options: opts,
      specialInstructions: json['specialInstructions']?.toString(),
      seat: (json['seat']?.toString().isNotEmpty ?? false) ? json['seat'].toString() : null,
      course: (json['course']?.toString().isNotEmpty ?? false) ? json['course'].toString() : null,
      suggestedWorkflowId: json['suggestedWorkflowId']?.toString(),
      firedTaskIds: fires,
      taskId: json['taskId']?.toString(),
      task: json['task'] is Map ? Map<String, dynamic>.from(json['task'] as Map) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        if (id.isNotEmpty) 'id': id,
        'sku': sku,
        'name': name,
        if (image != null) 'image': image,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'amount': amount,
        if (discount > 0) 'discount': discount,
        if (categoryId != null) 'categoryId': categoryId,
        'itemType': itemType,
        if (parentSku != null) 'parentSku': parentSku,
        if (options.isNotEmpty) 'options': options,
        if (specialInstructions != null) 'specialInstructions': specialInstructions,
        if (seat != null) 'seat': seat,
        if (course != null) 'course': course,
        if (suggestedWorkflowId != null) 'suggestedWorkflowId': suggestedWorkflowId,
        if (taskId != null) 'taskId': taskId,
        if (task != null) 'task': task,
        if (firedTaskIds.isNotEmpty) 'firedTaskIds': firedTaskIds.map((f) => f.toJson()).toList(),
      };

  /// True when this line has been sent to a workflow. Backend stamps the
  /// flat `taskId` field as soon as fire succeeds; that's the canonical
  /// "sent" indicator and what blocks duplicate fires. `firedTaskIds`
  /// stays for multi-pipeline bookkeeping but is no longer authoritative
  /// for the simple sent / not-sent question.
  bool get isFired =>
      (taskId != null && taskId!.isNotEmpty) ||
      firedTaskIds.any((f) => f.status == 'active');
  bool get isUnfired => !isFired;

  /// "Seat 2" and "Main" as the till and the ticket show them (empty parts left out).
  List<String> get seatAndCourse => [
        if ((seat ?? '').isNotEmpty) 'Seat $seat',
        if ((course ?? '').isNotEmpty) course![0].toUpperCase() + course!.substring(1),
      ];

  PosLineItem copyWith({
    String? id,
    num? quantity,
    num? unitPrice,
    num? discount,
    String? specialInstructions,
    String? seat,
    String? course,
    List<PosLineFire>? firedTaskIds,
  }) {
    final newQty = quantity ?? this.quantity;
    final newUnit = unitPrice ?? this.unitPrice;
    return PosLineItem(
      id: id ?? this.id,
      sku: sku,
      name: name,
      image: image,
      quantity: newQty,
      unitPrice: newUnit,
      amount: newQty * newUnit,
      discount: discount ?? this.discount,
      categoryId: categoryId,
      itemType: itemType,
      parentSku: parentSku,
      options: options,
      specialInstructions: specialInstructions ?? this.specialInstructions,
      seat: seat ?? this.seat,
      course: course ?? this.course,
      suggestedWorkflowId: suggestedWorkflowId,
      firedTaskIds: firedTaskIds ?? this.firedTaskIds,
      // A sent line stays sent through an edit (the stamped taskId is what "sent" means).
      taskId: taskId,
      task: task,
    );
  }
}

/// One option group on a product. Maps to sf_product.attributes[].
/// Each group has a name (e.g. "Size", "Spice Level") and a list of options
/// the user picks from.
class PosProductAttribute {
  final String name;
  /// What the product form calls the group ("Milk"); falls back to [name].
  final String? title;
  final List<PosProductAttributeOption> options;

  const PosProductAttribute({
    required this.name,
    this.title,
    this.options = const [],
  });

  String get label {
    final t = (title ?? '').trim();
    if (t.isNotEmpty) return t;
    if (name == 'prepStation') return 'Prep station';
    return name.isEmpty ? name : name[0].toUpperCase() + name.substring(1);
  }

  factory PosProductAttribute.fromJson(Map<String, dynamic> json) {
    final raw = json['options'];
    final opts = <PosProductAttributeOption>[];
    if (raw is List) {
      for (final o in raw) {
        if (o is Map) opts.add(PosProductAttributeOption.fromJson(Map<String, dynamic>.from(o)));
      }
    }
    return PosProductAttribute(
      name: (json['name'] ?? '').toString(),
      title: json['title']?.toString(),
      options: opts,
    );
  }
}

class PosProductAttributeOption {
  final String label;
  final String value;
  final String? param;

  const PosProductAttributeOption({required this.label, required this.value, this.param});

  factory PosProductAttributeOption.fromJson(Map<String, dynamic> json) {
    final value = (json['value'] ?? '').toString();
    return PosProductAttributeOption(
      label: (json['label'] ?? value).toString(),
      value: value,
      param: json['param']?.toString(),
    );
  }
}

/// A specific priced SKU resulting from a particular combo of attribute
/// option values. Maps to sf_product.variations[].
/// Match: variation.options[].name == attribute.name AND
///        variation.options[].value == picked option.value, for every group.
class PosProductVariation {
  final String sku;
  final num price;
  final num? stock;
  final String? image;
  /// List of {name, label, value} entries — the option-set this variation
  /// represents. Empty for products without variations.
  final List<Map<String, String>> options;

  const PosProductVariation({
    required this.sku,
    required this.price,
    this.stock,
    this.image,
    this.options = const [],
  });

  factory PosProductVariation.fromJson(Map<String, dynamic> json) {
    final raw = json['options'];
    final opts = <Map<String, String>>[];
    if (raw is List) {
      for (final o in raw) {
        if (o is Map) {
          opts.add({
            'name': (o['name'] ?? '').toString(),
            'label': (o['label'] ?? '').toString(),
            'value': (o['value'] ?? '').toString(),
          });
        }
      }
    }
    return PosProductVariation(
      sku: (json['sku'] ?? '').toString(),
      price: _num(json['price']),
      stock: json['stock'] == null ? null : _num(json['stock']),
      image: json['image']?.toString(),
      options: opts,
    );
  }
}

/// Product as returned by GET /storefront/products. Mirrors sf-product.ts
/// fields the POS picker actually uses — name, price, images, category,
/// option groups, variations, default workflow.
class PosProduct {
  final String sk;
  final String sku;
  final String name;
  final num price;
  final String? imageUrl;
  final String? category;
  final String? status;
  /// Option groups the operator picks from before adding to cart.
  final List<PosProductAttribute> attributes;
  /// Concrete priced SKUs. Empty if the product has no variations.
  final List<PosProductVariation> variations;
  /// Default workflow this product fires into when included in a fire batch.
  /// Inherited by line items as suggestedWorkflowId.
  final String? defaultWorkflowId;
  /// Default course (appetizer / main / dessert / drinks) — used as the
  /// default course value on the fire sheet.
  final String? defaultCourse;
  /// Product-level on-hand stock (null = not stock-tracked). Shown on the card.
  final num? stock;
  /// Prep station this product routes to (KITCHEN / BAR / BARISTA …). Drives
  /// the station chip and — carried on the line — the Pipelines/KDS routing.
  final String? prepStation;
  /// Per-location overlay (bm_location_product) merged in at fetch time.
  final bool eightySixed;
  final String? eightySixReason;
  /// Per-location price override (happy-hour / day-part). null = use [price].
  final num? priceOverride;
  /// Day-part menus this product belongs to (dinner / brunch / late_night /
  /// happy_hour) from the location overlay.
  final List<String> menuIds;

  const PosProduct({
    required this.sk,
    required this.sku,
    required this.name,
    required this.price,
    this.imageUrl,
    this.category,
    this.status,
    this.attributes = const [],
    this.variations = const [],
    this.defaultWorkflowId,
    this.defaultCourse,
    this.stock,
    this.prepStation,
    this.eightySixed = false,
    this.eightySixReason,
    this.priceOverride,
    this.menuIds = const [],
  });

  bool get hasOptions => attributes.isNotEmpty;

  /// Day-part menu chips ([id, label]) for a catalog: "All day" plus the
  /// menus the location's items actually carry. Empty when no item belongs to
  /// a day-part menu, so a business without day-parts sees no menu switcher
  /// (they used to be a fixed restaurant list: Dinner, Brunch, Late night…).
  static List<List<String>> dayParts(Iterable<PosProduct> products) {
    final ids = <String>{};
    for (final p in products) {
      ids.addAll(p.menuIds.where((m) => m.trim().isNotEmpty));
    }
    if (ids.isEmpty) return const [];
    String label(String id) {
      final s = id.replaceAll(RegExp(r'[-_]+'), ' ').trim();
      return s.isEmpty ? id : s[0].toUpperCase() + s.substring(1);
    }
    return [
      ['all', 'All day'],
      for (final id in ids.toList()..sort()) [id, label(id)],
    ];
  }
  bool get hasVariations => variations.isNotEmpty;

  /// The price actually charged — the location override wins over the base.
  num get effectivePrice => priceOverride ?? price;

  /// Out of stock when tracked and depleted.
  bool get isOutOfStock => stock != null && stock! <= 0;

  /// Whether the operator can add this to a cart right now.
  bool get isAvailable => !eightySixed && !isOutOfStock;

  /// Merge a per-location bm_location_product overlay onto this product.
  PosProduct withOverlay({
    bool? eightySixed,
    String? eightySixReason,
    num? priceOverride,
    List<String>? menuIds,
  }) {
    return PosProduct(
      sk: sk,
      sku: sku,
      name: name,
      price: price,
      imageUrl: imageUrl,
      category: category,
      status: status,
      attributes: attributes,
      variations: variations,
      defaultWorkflowId: defaultWorkflowId,
      defaultCourse: defaultCourse,
      stock: stock,
      prepStation: prepStation,
      eightySixed: eightySixed ?? this.eightySixed,
      eightySixReason: eightySixReason ?? this.eightySixReason,
      priceOverride: priceOverride ?? this.priceOverride,
      menuIds: menuIds ?? this.menuIds,
    );
  }

  factory PosProduct.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map ? json['data'] : json) as Map;
    // images can be array of objects { url } or strings — pick first
    String? img;
    final images = data['images'];
    if (images is List && images.isNotEmpty) {
      final first = images.first;
      if (first is Map) {
        img = (first['url'] ?? first['path'] ?? first['src'])?.toString();
      } else if (first is String) {
        img = first;
      }
    }

    // `posCategory` and a one-station `prepStation` classify the product (the
    // till bucket, where it is made). They are not choices for the cashier, so
    // they never open the options sheet: the BusinessMade web POS's rule.
    final attrs = <PosProductAttribute>[];
    String? attrCategory;
    String? attrStation;
    String? optionValue(dynamic o) => o is Map
        ? (o['value'] ?? o['name'] ?? o['label'])?.toString()
        : o?.toString();
    final rawAttrs = data['attributes'];
    if (rawAttrs is List) {
      for (final a in rawAttrs) {
        if (a is! Map) continue;
        final opts = a['options'] is List ? a['options'] as List : const [];
        if (a['name'] == 'posCategory') {
          if (opts.isNotEmpty) attrCategory = optionValue(opts.first);
          continue;
        }
        if (a['name'] == 'prepStation' && opts.length <= 1) {
          if (opts.isNotEmpty) attrStation = optionValue(opts.first);
          continue;
        }
        attrs.add(PosProductAttribute.fromJson(Map<String, dynamic>.from(a)));
      }
    }

    final vars = <PosProductVariation>[];
    final rawVars = data['variations'];
    if (rawVars is List) {
      for (final v in rawVars) {
        if (v is Map) vars.add(PosProductVariation.fromJson(Map<String, dynamic>.from(v)));
      }
    }

    final wf = data['workflow'] is Map ? data['workflow'] as Map : null;

    // Prep station: explicit field, else the first variation's `prepStation`
    // option (desktop derives station the same way).
    String? station = data['prepStation']?.toString();
    if (station == null || station.isEmpty) station = attrStation;
    if (station == null || station.isEmpty) {
      for (final v in vars) {
        final s = v.options.firstWhere(
          (o) => o['name'] == 'prepStation',
          orElse: () => const {},
        )['value'];
        if (s != null && s.toString().isNotEmpty) {
          station = s.toString();
          break;
        }
      }
    }

    return PosProduct(
      sk: (json['sk'] ?? data['sk'] ?? '').toString(),
      sku: (data['sku'] ?? '').toString(),
      name: (data['name'] ?? '').toString(),
      price: _num(data['price']),
      imageUrl: img,
      // POS category: the posCategory attribute, else the catalog category.
      category: attrCategory ??
          _firstString(json['post'] is Map ? (json['post'] as Map)['categories'] : null) ??
          _firstString(data['categories']) ??
          data['category']?.toString() ??
          data['categoryId']?.toString(),
      status: data['status']?.toString(),
      attributes: attrs,
      variations: vars,
      defaultWorkflowId: wf?['workflowId']?.toString(),
      defaultCourse: wf?['defaultCourse']?.toString(),
      stock: data['stock'] == null ? null : _num(data['stock']),
      prepStation: (station != null && station.isNotEmpty) ? station : null,
    );
  }

  /// Find the variation that matches a chosen option-set.
  /// `selected` is { attributeName: optionValue, ... }. Returns null if no
  /// variation matches (operator should treat as "use base price/sku").
  PosProductVariation? findVariation(Map<String, String> selected) {
    if (variations.isEmpty || selected.isEmpty) return null;
    for (final v in variations) {
      bool allMatch = true;
      for (final attr in attributes) {
        final pickedValue = selected[attr.name];
        if (pickedValue == null) {
          allMatch = false;
          break;
        }
        final hasMatch = v.options.any(
          (o) => o['name'] == attr.name && o['value'] == pickedValue,
        );
        if (!hasMatch) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return v;
    }
    return null;
  }

  /// Build a line item from this product + a chosen option-set + qty.
  /// Pulls price/sku from the matching variation when available.
  PosLineItem toLineItem({
    num quantity = 1,
    Map<String, String> selectedOptions = const {},
    String? specialInstructions,
    String? seat,
  }) {
    final variation = findVariation(selectedOptions);
    // Variation price wins; otherwise the location-overridden base price.
    final unit = variation?.price ?? effectivePrice;
    // Always send the MASTER product sku — never the variation's own sku.
    // Variation sku values (e.g. "ESP-GCL") don't exist as standalone
    // sf_product records, so the /items endpoint's product lookup would
    // 404. The variation is identified by the `options[]` array below.
    final pickedSku = [sku, sk]
        .firstWhere((s) => s.isNotEmpty, orElse: () => '');
    final lineImage = variation?.image ?? imageUrl;

    // Flatten selected options into the line-item options shape.
    // Each entry: { name: <attribute group>, value: <picked value> }.
    final List<Map<String, String>> opts = [];
    for (final attr in attributes) {
      final val = selectedOptions[attr.name];
      if (val == null) continue;
      opts.add({'name': attr.name, 'value': val});
    }
    // Carry the prep station as an option so the server routes this line to
    // the right Pipelines/KDS station (unless the operator already picked one).
    if (prepStation != null &&
        prepStation!.isNotEmpty &&
        !opts.any((o) => o['name'] == 'prepStation')) {
      opts.add({'name': 'prepStation', 'value': prepStation!});
    }

    return PosLineItem(
      sku: pickedSku,
      name: name,
      image: lineImage,
      quantity: quantity,
      unitPrice: unit,
      amount: unit * quantity,
      categoryId: category,
      itemType: 'product',
      options: opts,
      specialInstructions: specialInstructions,
      seat: seat,
      // The kitchen's course comes from the product (workflow.defaultCourse).
      course: (defaultCourse?.isNotEmpty ?? false) ? defaultCourse : null,
      suggestedWorkflowId: defaultWorkflowId,
    );
  }
}

class PosOrder {
  /// Server-side primary key. Empty for unsaved local carts.
  final String sk;
  final String? number;
  /// 'new' | 'awaiting-payment' | 'paid-partial' | 'paid' | etc.
  final String status;
  final String businessLocationId;
  final String? servicePointId;
  /// Free-form label the operator types ("Smith party", "Table 7", "Walk-up #3").
  final String? alias;
  final String? tabLabel;
  // Customer identity — present once the operator binds a customer to the tab
  final String? name;
  final String? email;
  final String? phone;
  /// Server-stored customer record nested under `data.customer` — fields like
  /// `name`, `email`, `phone` flow through here when present.
  final Map<String, dynamic>? customer;
  final String currency;
  final List<PosLineItem> productItems;
  /// Settled payment records (data.payments[]). Each entry has at least
  /// `{amount, method, ref?, last4?}`. Used by the Tabs view to derive
  /// partial vs full-paid state and pull the card last4.
  final List<Map<String, dynamic>> payments;
  // Totals are server-computed on save; present in fetched orders.
  final num subtotal;
  final num tax;
  final num total;
  /// Amount collected against the bill (for partial payments). Refunds do
  /// not reopen a check: the server's net `amountPaid` plus `amountRefunded`.
  final num amountPaid;
  /// Money handed back on this check (returns, refunds).
  final num amountRefunded;
  /// The seated party (from the visit the host seated): how many, and the
  /// booking's special requests. Server-set when a tab is opened at a table.
  final num? partySize;
  final String? guestNotes;

  const PosOrder({
    this.sk = '',
    this.number,
    this.status = 'new',
    required this.businessLocationId,
    this.servicePointId,
    this.alias,
    this.tabLabel,
    this.name,
    this.email,
    this.phone,
    this.customer,
    this.currency = 'USD',
    this.productItems = const [],
    this.payments = const [],
    this.subtotal = 0,
    this.tax = 0,
    this.total = 0,
    this.amountPaid = 0,
    this.amountRefunded = 0,
    this.partySize,
    this.guestNotes,
  });

  /// Display name pulled from the customer subdoc, the top-level `name`, or
  /// the alias — whichever the operator set. Returns null if none of them
  /// have a value.
  String? get customerName {
    final n = (customer?['name'] ?? '').toString().trim();
    if (n.isNotEmpty) return n;
    final top = (name ?? '').trim();
    // The repository generates this record name for anonymous table orders.
    // It is an internal identifier, not the guest's name.
    return top.isEmpty || RegExp(r'^sf_order-\d+-').hasMatch(top) ? null : top;
  }

  /// Card last-4 displayed on the tab — comes from `data.cardLast4` if the
  /// operator pre-bound a card, otherwise the first payment's `last4`.
  String? get cardLast4 {
    if (payments.isNotEmpty) {
      final first = payments.first;
      final l4 = (first['last4'] ?? '').toString().trim();
      if (l4.isNotEmpty) return l4;
    }
    return null;
  }

  /// Build from the wrapped server response: { sk, data: { ... } }.
  /// Also accepts a flat data-only map (used when emitting locally).
  factory PosOrder.fromJson(Map<String, dynamic> json) {
    final data = (json['data'] is Map ? json['data'] : json) as Map;
    final items = (data['productItems'] is List ? data['productItems'] as List : <dynamic>[])
        .whereType<Map>()
        .map((e) => PosLineItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final pays = <Map<String, dynamic>>[];
    if (data['payments'] is List) {
      for (final p in data['payments'] as List) {
        if (p is Map) pays.add(Map<String, dynamic>.from(p));
      }
    }
    return PosOrder(
      sk: (json['sk'] ?? data['sk'] ?? '').toString(),
      number: data['number']?.toString(),
      status: (data['status'] ?? 'new').toString(),
      businessLocationId: (data['businessLocationId'] ?? '').toString(),
      servicePointId: data['servicePointId']?.toString(),
      alias: data['alias']?.toString(),
      tabLabel: data['tabLabel']?.toString(),
      name: data['name']?.toString(),
      // A tab opened for a guest (a booking, a picked customer) carries them
      // on `customer`; the receipt goes to their email or phone.
      email: _nonEmpty(data['email']) ??
          (data['customer'] is Map ? _nonEmpty((data['customer'] as Map)['email']) : null),
      phone: _nonEmpty(data['phone']) ??
          (data['customer'] is Map ? _nonEmpty((data['customer'] as Map)['phone']) : null),
      customer: data['customer'] is Map ? Map<String, dynamic>.from(data['customer'] as Map) : null,
      currency: (data['currency'] ?? 'USD').toString(),
      productItems: items,
      payments: pays,
      subtotal: _num(data['subtotal']),
      tax: _num(data['tax']),
      total: _num(data['total']),
      amountPaid: _num(data['amountPaid']) + _num(data['amountRefunded']),
      amountRefunded: _num(data['amountRefunded']),
      partySize: data['partySize'] is num ? data['partySize'] as num : null,
      guestNotes: data['guestNotes']?.toString(),
    );
  }

  bool get isPersisted => sk.isNotEmpty;

  /// What to show as the tab's amount. Open tabs only carry `subtotal` on the
  /// server (`total` is stamped at settle), so fall back through subtotal and
  /// the line items rather than printing $0.00 for a tab with items on it.
  num get displayTotal {
    if (total > 0) return total;
    if (subtotal > 0) return subtotal;
    return productItems.fold<num>(0, (sum, l) => sum + l.amount);
  }
  bool get isPaid => status == 'paid' || status == 'completed';

  /// Display label preferring tabLabel → alias → "Tab {last 6 of sk}" → "Cart"
  String get displayLabel {
    final t = (tabLabel ?? '').trim();
    if (t.isNotEmpty) return t;
    final a = (alias ?? '').trim();
    if (a.isNotEmpty) return a;
    if (sk.isNotEmpty) return 'Tab ${sk.substring(sk.length - 6)}';
    return 'Cart';
  }

  /// Local subtotal computed from line items — used while editing before
  /// the server returns authoritative totals.
  num get localSubtotal => productItems.fold<num>(0, (s, i) => s + i.amount);

  PosOrder copyWith({
    String? sk,
    String? status,
    String? servicePointId,
    String? alias,
    String? tabLabel,
    String? name,
    String? email,
    String? phone,
    List<PosLineItem>? productItems,
    num? subtotal,
    num? tax,
    num? total,
    num? amountPaid,
    num? amountRefunded,
  }) {
    return PosOrder(
      sk: sk ?? this.sk,
      number: number,
      status: status ?? this.status,
      businessLocationId: businessLocationId,
      servicePointId: servicePointId ?? this.servicePointId,
      alias: alias ?? this.alias,
      tabLabel: tabLabel ?? this.tabLabel,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      customer: customer,
      currency: currency,
      productItems: productItems ?? this.productItems,
      payments: payments,
      subtotal: subtotal ?? this.subtotal,
      tax: tax ?? this.tax,
      total: total ?? this.total,
      amountPaid: amountPaid ?? this.amountPaid,
      amountRefunded: amountRefunded ?? this.amountRefunded,
      partySize: partySize,
      guestNotes: guestNotes,
    );
  }
}
