// Course-capture drive for Stowbo (test tooling only; not shipped in the app).
//
// Runs the real app on a simulator or device and executes commands that a host
// script appends to `$RIG_DIR/cmd.jsonl`, one JSON object per line. Results and
// timestamps go to `$RIG_DIR/res.jsonl`. The same commands serve the live gate
// (one at a time, like a REPL) and the recorded takes (a whole scene script).
//
//   flutter test integration_test/capture/drive_test.dart -d <device> \
//     --dart-define=RIG_DIR=/abs/path --dart-define=APPENGINE_URL=http://localhost:3300 \
//     --dart-define=FAST_LOGIN=false
//
// Full write-up: docs/videos/appmint-mobile-rig/RIG.md. Secrets: the `secret`
// command reads a value from a 0600 identity file and types it; the value is
// never written to the result log.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:integration_test/integration_test.dart';

import 'package:appmint_one/main.dart' as app;
import 'package:appmint_one/services/http_client.dart';

const String rigDir = String.fromEnvironment('RIG_DIR');
// A real device cannot read the Mac's files: it talks to rig/bridge.py instead
// (GET /cmd?n=<lines consumed>, POST /res). Secrets are resolved by the bridge.
const String rigUrl = String.fromEnvironment('RIG_URL');

int _now() => DateTime.now().microsecondsSinceEpoch;

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;
  // Taps go in as device events: the live test binding paints a crosshair for
  // every test-sourced pointer, which must never show up in a course take.
  binding.shouldPropagateDevicePointerEvents = true;

  testWidgets('drive', (tester) async {
    // The real platform keyboard, not the test stand-in: fields show the iOS
    // keyboard when focused, as they would for a person.
    tester.testTextInput.unregister();
    final d = _Driver(tester);
    if (rigUrl.isNotEmpty) {
      // Real device: say on the console whether the Mac's bridge answers.
      try {
        final rq = await HttpClient().getUrl(Uri.parse('$rigUrl/cmd?n=999999'));
        final rs = await rq.close();
        // ignore: avoid_print
        print('RIG bridge reachable: HTTP ${rs.statusCode}');
      } catch (e) {
        // ignore: avoid_print
        print('RIG bridge NOT reachable: $e');
      }
    }
    d.log({'op': 'boot'});
    // An error the app does not catch (e.g. the chat socket closing on an expired token) must
    // not end the capture session: log it and keep driving.
    runZonedGuarded(app.main, (e, st) => d.log({'op': 'apperror', 'err': e.toString().split('\n').first}));
    await d.idle(2500);
    d.log({'op': 'ready'});
    await d.loop();
  }, timeout: Timeout.none, semanticsEnabled: false);
}

class _Driver {
  _Driver(this.tester);
  final WidgetTester tester;
  late final File cmdFile = File('$rigDir/cmd.jsonl');
  late final File resFile = File('$rigDir/res.jsonl');
  int _offset = 0;

  void log(Map<String, dynamic> m) {
    m['t'] = _now();
    if (rigUrl.isNotEmpty) {
      _post(jsonEncode(m));
      return;
    }
    resFile.writeAsStringSync('${jsonEncode(m)}\n', mode: FileMode.append, flush: true);
  }

  final HttpClient _http = HttpClient();
  int _consumed = 0;

  void _post(String line) {
    () async {
      try {
        final rq = await _http.postUrl(Uri.parse('$rigUrl/res'));
        rq.headers.contentType = ContentType.json;
        rq.add(utf8.encode(line));
        await (await rq.close()).drain<void>();
      } catch (_) {}
    }();
  }

  Future<List<String>> _fetch() async {
    try {
      final rq = await _http.getUrl(Uri.parse('$rigUrl/cmd?n=$_consumed'));
      final rs = await rq.close();
      final body = await rs.transform(utf8.decoder).join();
      final lines = body.split('\n').where((l) => l.trim().isNotEmpty).toList();
      _consumed += lines.length;
      return lines;
    } catch (_) {
      return [];
    }
  }

  Future<void> idle(int ms) async {
    final end = DateTime.now().add(Duration(milliseconds: ms));
    while (DateTime.now().isBefore(end)) {
      await tester.pump();
      await Future<void>.delayed(const Duration(milliseconds: 16));
    }
  }

  Future<void> loop() async {
    if (rigUrl.isNotEmpty) {
      // the bridge starts counting at the commands written after it started
      while (true) {
        for (final line in await _fetch()) {
          final c = jsonDecode(line) as Map<String, dynamic>;
          if (c['op'] == 'quit') {
            log({'op': 'quit'});
            return;
          }
          try {
            await run(c);
          } catch (e) {
            log({'op': 'error', 'cmd': c['op'], 'id': c['id'], 'err': e.toString().split('\n').first});
          }
        }
        await tester.pump();
        await Future<void>.delayed(const Duration(milliseconds: 60));
      }
    }
    if (!cmdFile.existsSync()) cmdFile.createSync(recursive: true);
    _offset = cmdFile.lengthSync(); // only commands written after start
    while (true) {
      final len = cmdFile.lengthSync();
      if (len > _offset) {
        final raf = cmdFile.openSync();
        raf.setPositionSync(_offset);
        final bytes = raf.readSync(len - _offset);
        raf.closeSync();
        final text = utf8.decode(bytes, allowMalformed: true);
        final lastNl = text.lastIndexOf('\n');
        if (lastNl >= 0) {
          _offset += utf8.encode(text.substring(0, lastNl + 1)).length;
          for (final line in text.substring(0, lastNl).split('\n')) {
            if (line.trim().isEmpty) continue;
            Map<String, dynamic> c;
            try {
              c = jsonDecode(line) as Map<String, dynamic>;
            } catch (e) {
              log({'op': 'bad-json', 'err': '$e'});
              continue;
            }
            if (c['op'] == 'quit') {
              log({'op': 'quit'});
              return;
            }
            try {
              await run(c);
            } catch (e) {
              log({'op': 'error', 'cmd': c['op'], 'id': c['id'], 'err': e.toString().split('\n').first});
            }
          }
        }
      }
      await tester.pump();
      await Future<void>.delayed(const Duration(milliseconds: 40));
    }
  }

  // ---- finders ----------------------------------------------------------
  Finder finder(Map<String, dynamic> c) {
    Finder f;
    if (c['text'] != null) {
      f = find.text(c['text'] as String, findRichText: true);
    } else if (c['contains'] != null) {
      f = find.textContaining(c['contains'] as String, findRichText: true);
    } else if (c['key'] != null) {
      f = find.byKey(ValueKey<String>(c['key'] as String));
    } else if (c['tooltip'] != null) {
      f = find.byTooltip(c['tooltip'] as String);
    } else if (c['hint'] != null) {
      final h = c['hint'] as String;
      f = find.byWidgetPredicate((w) =>
          (w is TextField && (w.decoration?.hintText == h || w.decoration?.labelText == h)) ||
          (w is TextFormField && false));
      if (f.evaluate().isEmpty) {
        // TextFormField builds a TextField; also match InputDecorator labels.
        f = find.byWidgetPredicate((w) =>
            w is InputDecorator && (w.decoration.hintText == h || w.decoration.labelText == h));
      }
    } else if (c['icon'] != null) {
      final cp = int.parse(c['icon'] as String);
      f = find.byWidgetPredicate((w) => w is Icon && w.icon?.codePoint == cp);
    } else if (c['type'] != null) {
      final t = c['type'] as String;
      f = find.byWidgetPredicate((w) => w.runtimeType.toString() == t);
    } else {
      throw StateError('no finder in ${jsonEncode(c)}');
    }
    if (c['within'] != null) {
      // the match inside the nearest ancestor of type `withinType` (default Card)
      // that also contains the text `within`
      final anc = find.ancestor(
          of: find.text(c['within'] as String, findRichText: true),
          matching: find.byWidgetPredicate(
              (w) => w.runtimeType.toString() == (c['withinType'] ?? 'Card')));
      f = find.descendant(of: anc, matching: f);
    }
    // keep only hit-testable-ish, on-screen matches
    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    final all = f.evaluate().toList();
    final onScreen = <Element>[];
    for (final e in all) {
      final ro = e.renderObject;
      if (ro is RenderBox && ro.attached && ro.hasSize) {
        final p = ro.localToGlobal(ro.size.center(Offset.zero));
        if (p.dx >= 0 && p.dy >= 0 && p.dx <= screen.width && p.dy <= screen.height) onScreen.add(e);
      }
    }
    final pool = (c['offscreen'] == true) ? all : onScreen;
    if (pool.isEmpty) throw StateError('not found: ${_desc(c)} (${all.length} in tree)');
    final idx = c['index'];
    Element pick;
    if (idx == 'last') {
      pick = pool.last;
    } else {
      pick = pool[(idx as int?) ?? 0];
    }
    return find.byElementPredicate((e) => identical(e, pick));
  }

  String _desc(Map<String, dynamic> c) =>
      ['text', 'contains', 'key', 'tooltip', 'hint', 'icon', 'type']
          .where((k) => c[k] != null)
          .map((k) => '$k=${c[k]}')
          .join(',');

  Rect rectOf(Finder f) {
    final ro = f.evaluate().first.renderObject as RenderBox;
    final o = ro.localToGlobal(Offset.zero);
    return o & ro.size;
  }

  Map<String, dynamic> rectJson(Rect r) => {
        'x': double.parse(r.left.toStringAsFixed(1)),
        'y': double.parse(r.top.toStringAsFixed(1)),
        'w': double.parse(r.width.toStringAsFixed(1)),
        'h': double.parse(r.height.toStringAsFixed(1)),
      };

  // ---- commands ---------------------------------------------------------
  Future<void> run(Map<String, dynamic> c) async {
    final op = c['op'] as String;
    final id = c['id'];
    switch (op) {
      case 'mark':
        log({'op': 'mark', 'id': id, 'name': c['name']});
        break;
      case 'wait':
        await idle((c['ms'] as num).toInt());
        log({'op': 'wait', 'id': id});
        break;
      case 'waitFor':
        final end = DateTime.now().add(Duration(milliseconds: (c['timeout'] as num?)?.toInt() ?? 15000));
        while (true) {
          try {
            finder(c);
            break;
          } catch (_) {
            if (DateTime.now().isAfter(end)) rethrow;
            await idle(100);
          }
        }
        log({'op': 'waitFor', 'id': id, 'what': _desc(c)});
        break;
      case 'waitGone':
        final end = DateTime.now().add(Duration(milliseconds: (c['timeout'] as num?)?.toInt() ?? 15000));
        while (true) {
          try {
            finder(c);
            if (DateTime.now().isAfter(end)) throw StateError('still there: ${_desc(c)}');
            await idle(100);
          } on StateError catch (e) {
            if (e.message.startsWith('still there')) rethrow;
            break;
          }
        }
        log({'op': 'waitGone', 'id': id});
        break;
      case 'tap':
      case 'longpress':
        final f = finder(c);
        final r = rectOf(f);
        final at = c['dx'] != null ? r.topLeft + Offset((c['dx'] as num).toDouble(), (c['dy'] as num).toDouble()) : r.center;
        log({'op': op, 'id': id, 'what': _desc(c), ...rectJson(r), 'px': at.dx, 'py': at.dy});
        await _press(at, holdMs: op == 'tap' ? 70 : 650);
        await tester.pump();
        break;
      case 'invalidate-access-token':
        // Test-only fault injection: keep the real refresh credential intact,
        // then exercise recovery by performing the next action through the UI.
        appengineHttpClient.setUserToken('expired-test-access-token');
        log({'op': 'mark', 'id': id, 'what': 'access-token-invalidated'});
        break;
      case 'type':
      case 'secret':
        final f = finder(c);
        final r = rectOf(f);
        final editable = find.descendant(of: f, matching: find.byType(EditableText), matchRoot: true);
        if (c['focus'] != false) {
          log({'op': 'focus', 'id': id, 'what': 'field ${_desc(c)}', ...rectJson(r), 'px': r.center.dx, 'py': r.center.dy});
          await _press(r.center);
          await idle((c['afterFocus'] as num?)?.toInt() ?? 450);
        }
        String value;
        if (op == 'secret' && c['value'] is String) {
          value = c['value'] as String; // resolved by the bridge (real device)
        } else if (op == 'secret') {
          final m = jsonDecode(File(c['file'] as String).readAsStringSync()) as Map<String, dynamic>;
          value = '${m[c['field'] ?? 'password']}';
        } else {
          value = c['value'] as String;
        }
        final cps = (c['cps'] as num?)?.toDouble() ?? 14.0;
        if (editable.evaluate().isEmpty) {
          throw StateError('The selected control is not an editable text field');
        }
        final state = tester.state<EditableTextState>(editable.first);
        final base = c['append'] == true ? state.textEditingValue.text : '';
        log({'op': op, 'id': id, 'what': _desc(c), 'len': value.length, ...rectJson(r)});
        for (var i = 1; i <= value.length; i++) {
          final s = base + value.substring(0, i);
          state.userUpdateTextEditingValue(
              TextEditingValue(text: s, selection: TextSelection.collapsed(offset: s.length)),
              SelectionChangedCause.keyboard);
          await idle((1000 / cps).round());
        }
        log({'op': '$op-done', 'id': id});
        break;
      case 'submit':
        final focused = find.byWidgetPredicate((w) => w is EditableText && w.focusNode.hasFocus);
        if (focused.evaluate().isNotEmpty) {
          tester.state<EditableTextState>(focused.first).performAction(TextInputAction.done);
        }
        await tester.pump();
        log({'op': 'submit', 'id': id});
        break;
      case 'hid':
        // A handheld barcode scanner in HID (keyboard-wedge) mode: the code arrives as machine-fast key
        // presses followed by Enter, through the same platform key path a USB/Bluetooth scanner uses.
        final code = c['code'] as String;
        final gap = (c['gapMs'] as num?)?.toInt() ?? 12;
        for (final ch in code.split('')) {
          final key = LogicalKeyboardKey(ch.toLowerCase().codeUnitAt(0));
          await simulateKeyDownEvent(key, character: ch, platform: 'ios');
          await simulateKeyUpEvent(key, platform: 'ios');
          await Future<void>.delayed(Duration(milliseconds: gap));
        }
        await simulateKeyDownEvent(LogicalKeyboardKey.enter, platform: 'ios');
        await simulateKeyUpEvent(LogicalKeyboardKey.enter, platform: 'ios');
        await idle(200);
        log({'op': 'hid-done', 'id': id, 'what': 'hid ${code.length} chars'});
        break;
      case 'unfocus':
        FocusManager.instance.primaryFocus?.unfocus();
        await idle(300);
        log({'op': 'unfocus', 'id': id});
        break;
      case 'drag':
        // a visible finger drag: from the finder (or screen centre) by dy over ms
        Offset from;
        if (c['text'] != null || c['key'] != null || c['contains'] != null || c['type'] != null) {
          from = rectOf(finder(c)).center;
        } else {
          final s = tester.view.physicalSize / tester.view.devicePixelRatio;
          from = Offset(s.width / 2, (c['y'] as num?)?.toDouble() ?? s.height * 0.6);
        }
        final dy = ((c['by'] as num?) ?? 0).toDouble();
        final dxBy = ((c['byX'] as num?) ?? 0).toDouble(); // a sideways swipe (chip rows)
        final ms = (c['ms'] as num?)?.toInt() ?? 700;
        log({'op': 'drag', 'id': id, 'px': from.dx, 'py': from.dy, 'by': dy, 'byX': dxBy, 'ms': ms});
        await _smoothDrag(from, Offset(dxBy, dy), ms);
        await idle(350);
        log({'op': 'drag-done', 'id': id});
        break;
      case 'reveal':
        // drag the nearest scrollable until the target sits near `toY` (logical px).
        // A lazy list builds rows only near the screen: step down until it exists.
        final dir = (c['up'] == true) ? 1.0 : -1.0;
        for (var i = 0; i < 12; i++) {
          try {
            finder({...c, 'offscreen': true});
            break;
          } catch (_) {
            final s0 = tester.view.physicalSize / tester.view.devicePixelRatio;
            final from = Offset(s0.width / 2, dir < 0 ? s0.height * 0.72 : s0.height * 0.3);
            log({'op': 'drag', 'id': id, 'px': from.dx, 'py': from.dy, 'by': dir * s0.height * 0.4, 'ms': 600});
            await _smoothDrag(from, Offset(0, dir * s0.height * 0.4), 600);
            await idle(250);
          }
        }
        final target = finder({...c, 'offscreen': true});
        final r = rectOf(target);
        final s = tester.view.physicalSize / tester.view.devicePixelRatio;
        final toY = (c['toY'] as num?)?.toDouble() ?? s.height * 0.45;
        final dy = toY - r.center.dy;
        if (dy.abs() > 8) {
          final from = Offset(s.width / 2, dy < 0 ? s.height * 0.72 : s.height * 0.3);
          log({'op': 'drag', 'id': id, 'px': from.dx, 'py': from.dy, 'by': dy, 'ms': c['ms'] ?? 800});
          await _smoothDrag(from, Offset(0, dy), (c['ms'] as num?)?.toInt() ?? 800);
          await idle(400);
        }
        log({'op': 'reveal-done', 'id': id});
        break;
      case 'back':
        final nav = tester.state<NavigatorState>(find.byType(Navigator).last);
        log({'op': 'back', 'id': id});
        await nav.maybePop();
        await tester.pump();
        break;
      case 'dump':
        log({'op': 'dump', 'id': id, 'items': _dump(c['all'] == true)});
        break;
      case 'screenshot':
        final boundaries = find.byType(RepaintBoundary).evaluate()
            .map((e) => e.renderObject)
            .whereType<RenderRepaintBoundary>()
            .where((r) => r.attached && r.hasSize && !r.size.isEmpty)
            .toList()
          ..sort((a, b) => (b.size.width * b.size.height)
              .compareTo(a.size.width * a.size.height));
        if (boundaries.isEmpty) throw StateError('No visible screen to capture');
        final capture = await boundaries.first.toImage(
            pixelRatio: tester.view.devicePixelRatio);
        try {
          final bytes = await capture.toByteData(format: ui.ImageByteFormat.png);
          if (bytes == null) throw StateError('Could not encode screen capture');
          log({'op': 'screenshot', 'id': id,
            'png': base64Encode(bytes.buffer.asUint8List())});
        } finally {
          capture.dispose();
        }
        break;
      case 'prefs-remove':
        // Off-camera reset of device-local choices (a phone's event, its scanner setup) by key prefix,
        // so a take can start like a phone that was never set up. Logged as 'wait' (a done op).
        final prefs = await SharedPreferences.getInstance();
        final gone = <String>[];
        for (final k in prefs.getKeys().toList()) {
          if ((c['prefixes'] as List).any((x) => k.startsWith('$x'))) { await prefs.remove(k); gone.add(k); }
        }
        log({'op': 'wait', 'id': id, 'what': 'prefs-remove ${gone.join(',')}'});
        break;
      case 'orient':
        // A counter iPad stands in landscape: lock the app to it for the take.
        await SystemChrome.setPreferredOrientations(c['to'] == 'landscape'
            ? [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]
            : [DeviceOrientation.portraitUp]);
        await idle(1500);
        log({'op': 'orient', 'id': id});
        break;
      case 'flash':
        // full-screen sync flash (video/clock alignment)
        final ov = tester.state<NavigatorState>(find.byType(Navigator).first).overlay!;
        final entry = OverlayEntry(builder: (_) => const ColoredBox(color: Color(0xFFFF00FF)));
        ov.insert(entry);
        await tester.pump();
        log({'op': 'flash-on', 'id': id});
        await idle((c['ms'] as num?)?.toInt() ?? 400);
        entry.remove();
        await tester.pump();
        log({'op': 'flash-off', 'id': id});
        break;
      default:
        throw StateError('unknown op $op');
    }
  }

  int _pointer = 900;

  void _dev(PointerEvent e) => TestWidgetsFlutterBinding.instance
      .handlePointerEventForSource(e, source: TestBindingEventSource.device);

  Future<void> _press(Offset at, {int holdMs = 70}) async {
    final id = ++_pointer;
    _dev(PointerAddedEvent(pointer: id, position: at, kind: PointerDeviceKind.touch));
    _dev(PointerDownEvent(pointer: id, position: at, kind: PointerDeviceKind.touch));
    await idle(holdMs);
    _dev(PointerUpEvent(pointer: id, position: at, kind: PointerDeviceKind.touch));
    _dev(PointerRemovedEvent(pointer: id, position: at, kind: PointerDeviceKind.touch));
  }

  Future<void> _smoothDrag(Offset from, Offset by, int ms) async {
    final id = ++_pointer;
    var pos = from;
    _dev(PointerAddedEvent(pointer: id, position: pos, kind: PointerDeviceKind.touch));
    _dev(PointerDownEvent(pointer: id, position: pos, kind: PointerDeviceKind.touch));
    const steps = 30;
    final stepMs = (ms / steps).round();
    for (var i = 1; i <= steps; i++) {
      // ease in-out
      final t0 = (i - 1) / steps, t1 = i / steps;
      double e(double t) => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      final d = by * (e(t1) - e(t0));
      pos += d;
      _dev(PointerMoveEvent(pointer: id, position: pos, delta: d, kind: PointerDeviceKind.touch));
      await idle(stepMs);
    }
    await idle(60); // a short rest before lifting: no fling
    _dev(PointerUpEvent(pointer: id, position: pos, kind: PointerDeviceKind.touch));
    _dev(PointerRemovedEvent(pointer: id, position: pos, kind: PointerDeviceKind.touch));
  }

  List<Map<String, dynamic>> _dump(bool all) {
    final out = <Map<String, dynamic>>[];
    final s = tester.view.physicalSize / tester.view.devicePixelRatio;
    void add(String kind, String text, Element e) {
      final ro = e.renderObject;
      if (ro is! RenderBox || !ro.attached || !ro.hasSize) return;
      final o = ro.localToGlobal(Offset.zero);
      final r = o & ro.size;
      if (!all && (r.bottom < 0 || r.top > s.height || r.right < 0 || r.left > s.width)) return;
      out.add({'k': kind, 's': text, ...rectJson(r)});
    }
    for (final e in find.byType(Text).evaluate()) {
      final w = e.widget as Text;
      final t = w.data ?? w.textSpan?.toPlainText() ?? '';
      if (t.trim().isNotEmpty) add('text', t, e);
    }
    for (final e in find.byType(RichText).evaluate()) {
      final w = e.widget as RichText;
      final t = w.text.toPlainText();
      if (t.trim().isNotEmpty && e.findAncestorWidgetOfExactType<Text>() == null) add('rich', t, e);
    }
    for (final e in find.byType(TextField).evaluate()) {
      final w = e.widget as TextField;
      add('field', 'hint=${w.decoration?.hintText ?? ''} label=${w.decoration?.labelText ?? ''} val=${w.obscureText ? '***' : (w.controller?.text ?? '')}', e);
    }
    for (final e in find.byType(Tooltip).evaluate()) {
      final w = e.widget as Tooltip;
      if ((w.message ?? '').isNotEmpty) add('tip', w.message!, e);
    }
    return out;
  }
}
