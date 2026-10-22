import 'dart:convert';
import 'dart:typed_data';

import 'package:nfc_manager/ndef_record.dart';

/// The NDEF text format used for employee cards, including existing cards.
NdefMessage encodeEmployeeCard(String employeeId) => NdefMessage(
  records: [
    NdefRecord(
      typeNameFormat: TypeNameFormat.wellKnown,
      type: Uint8List.fromList([0x54]),
      identifier: Uint8List(0),
      payload: Uint8List.fromList([
        0x02,
        0x65,
        0x6e,
        ...utf8.encode(employeeId),
      ]),
    ),
  ],
);

String? decodeEmployeeCard(NdefMessage? message) {
  if (message == null) return null;
  for (final record in message.records) {
    if (record.typeNameFormat != TypeNameFormat.wellKnown ||
        record.type.length != 1 ||
        record.type.first != 0x54)
      continue;
    final payload = record.payload;
    if (payload.isEmpty) continue;
    final start = 1 + (payload.first & 0x3f);
    if (start >= payload.length) continue;
    // Cards issued by Appmint use UTF-8; don't misread UTF-16 as an ID.
    if (payload.first & 0x80 != 0) continue;
    try {
      final text = utf8.decode(payload.sublist(start)).trim();
      if (text.isNotEmpty) return text;
    } on FormatException {
      // A malformed record must not prevent reading a later valid record.
    }
  }
  return null;
}
