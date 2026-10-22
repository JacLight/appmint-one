import 'package:flutter/material.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../services/lms_api.dart';
import '../../../../widgets/lesson_content.dart';
import '../../shared/module_states.dart';

/// One step of a course: read it, then say you are done.
///
/// Completion belongs to the server. The button reports progress and takes
/// the answer back — it never decides locally that a lesson is finished,
/// because the next step may be gated on this one.
class PlayerScreen extends StatefulWidget {
  final String courseId;
  final String itemId;
  const PlayerScreen({super.key, required this.courseId, required this.itemId});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  late String _itemId = widget.itemId;
  Map<String, dynamic> _data = const {};
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await lmsApi.item(widget.courseId, _itemId);
      if (!mounted) return;
      setState(() {
        _data = r;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e'.replaceAll('Exception: ', '');
      });
    }
  }

  Map<String, dynamic> get _item {
    final i = _data['item'];
    return i is Map ? Map<String, dynamic>.from(i) : const {};
  }

  Map<String, dynamic>? get _page {
    final p = _data['page'];
    return p is Map ? Map<String, dynamic>.from(p) : null;
  }

  bool get _done {
    final p = _data['progress'];
    return p is Map && p['done'] == true;
  }

  Future<void> _complete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await lmsApi.reportProgress(widget.courseId, _itemId,
          body: {'done': true, 'percent': 100});
      if (!mounted) return;
      final next = '${_item['next'] ?? ''}';
      if (next.isEmpty) {
        setState(() => _busy = false);
        await _load();
        return;
      }
      setState(() {
        _itemId = next;
        _busy = false;
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '$e'.replaceAll('Exception: ', '');
      });
    }
  }

  void _go(String itemId) {
    setState(() => _itemId = itemId);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final page = _page;
    final title = '${_item['title'] ?? page?['title'] ?? 'Lesson'}';
    final type = '${page?['type'] ?? 'text'}';
    final prev = '${_item['prev'] ?? ''}';
    final next = '${_item['next'] ?? ''}';

    return Scaffold(
      backgroundColor: SColors.paper,
      appBar: AppBar(
        backgroundColor: SColors.paper,
        surfaceTintColor: Colors.transparent,
        title: Text(title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: SColors.ink)),
        actions: [
          if (_done)
            const Padding(
              padding: EdgeInsets.only(right: SSpace.lg),
              child: Icon(Icons.check_circle_rounded,
                  color: SColors.green, size: 22),
            ),
        ],
      ),
      body: _loading
          ? const ModuleLoading()
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.all(SSpace.lg),
                  child: ModuleError(message: _error!, onRetry: _load),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, SSpace.sm, SSpace.lg, SSpace.xxl),
                  children: [
                    Text(title,
                        style: TextStyle(
                          fontSize: 22,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          color: SColors.ink,
                          fontFamily: brand.displayFont,
                        )),
                    if ('${page?['summary'] ?? ''}'.trim().isNotEmpty) ...[
                      const SizedBox(height: SSpace.sm),
                      Text('${page!['summary']}',
                          style: const TextStyle(
                              color: SColors.muted,
                              fontSize: 14,
                              height: 1.45)),
                    ],
                    if ('${page?['duration'] ?? ''}'.trim().isNotEmpty) ...[
                      const SizedBox(height: SSpace.sm),
                      Row(
                        children: [
                          const Icon(Icons.schedule_rounded,
                              size: 14, color: SColors.faint),
                          const SizedBox(width: 5),
                          Text('${page!['duration']}',
                              style: const TextStyle(
                                  color: SColors.faint, fontSize: 12)),
                        ],
                      ),
                    ],
                    const SizedBox(height: SSpace.xl),
                    if (_answerable(type)) _NotHereYet(type: type),
                    LessonContent(html: '${page?['content'] ?? ''}'),
                  ],
                ),
      bottomNavigationBar: _loading
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.md, SSpace.lg, SSpace.md),
              decoration: const BoxDecoration(
                color: SColors.card,
                border: Border(top: BorderSide(color: SColors.line)),
              ),
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    if (prev.isNotEmpty)
                      IconButton(
                        onPressed: _busy ? null : () => _go(prev),
                        icon: const Icon(Icons.arrow_back_rounded),
                        color: SColors.ink2,
                      ),
                    Expanded(
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor:
                              _done ? SColors.green : brand.primary,
                          padding: const EdgeInsets.symmetric(
                              vertical: SSpace.md + 2),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(SRadius.pill)),
                        ),
                        onPressed: _busy
                            ? null
                            : _done
                                ? (next.isEmpty ? null : () => _go(next))
                                : _complete,
                        child: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : Text(
                                _done
                                    ? (next.isEmpty
                                        ? 'Finished'
                                        : 'Next step')
                                    : next.isEmpty
                                        ? 'Mark done'
                                        : 'Done — next step',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  static bool _answerable(String type) =>
      type == 'quiz' || type == 'form' || type == 'assignment';
}

/// A quiz's questions are authored as form inputs inside the page's HTML, and
/// its answer key is by input name. Rendering that properly means rendering an
/// arbitrary HTML form, so the app does not pretend to: it shows the page and
/// says where to answer. The fix is a structured questions API, not a guess at
/// somebody's markup — see specs/06-learning/README.md.
class _NotHereYet extends StatelessWidget {
  final String type;
  const _NotHereYet({required this.type});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: SSpace.lg),
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: const Color(0xFFFDF1DC),
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.amber.withValues(alpha: 0.5)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.edit_note_rounded,
                size: 18, color: Color(0xFF8A5B16)),
            const SizedBox(width: SSpace.sm),
            Expanded(
              child: Text(
                'This step is ${type == 'quiz' ? 'a quiz' : 'an $type'}. You '
                'can read it here, but answering it is on the web for now.',
                style: const TextStyle(
                    color: Color(0xFF8A5B16), fontSize: 12.5, height: 1.4),
              ),
            ),
          ],
        ),
      );
}
