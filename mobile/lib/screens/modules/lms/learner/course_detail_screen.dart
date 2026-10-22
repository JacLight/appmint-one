import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/learning_provider.dart';
import '../../../../services/lms_api.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';
import 'player_screen.dart';

/// A course before and during: what is in it, how far through you are, and
/// the one button that matters — enrol, or carry on.
class CourseDetailScreen extends StatefulWidget {
  final Map<String, dynamic> course;
  const CourseDetailScreen({super.key, required this.course});

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> {
  Map<String, dynamic> _outline = const {};
  bool _loading = true;
  bool _busy = false;
  String? _error;

  String get _id =>
      '${widget.course['id'] ?? widget.course['slug'] ?? widget.course['sk'] ?? ''}';

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
      final full = await lmsApi.course(_id);
      if (!mounted) return;
      setState(() {
        _outline = full;
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

  Map<String, dynamic> get _course {
    final c = _outline['course'];
    return c is Map ? Map<String, dynamic>.from(c) : widget.course;
  }

  Map<String, dynamic>? get _enrollment {
    final e = _outline['enrollment'];
    return e is Map ? Map<String, dynamic>.from(e) : null;
  }

  List<Map<String, dynamic>> get _items {
    final raw = _outline['items'];
    if (raw is! List) return const [];
    return [
      for (final i in raw)
        if (i is Map) Map<String, dynamic>.from(i),
    ];
  }

  Future<void> _enroll() async {
    // Enrolling is the first thing in this module that belongs to a person.
    // Saying so here beats letting the server refuse it in its own words.
    if (context.read<AuthProvider>().exploring) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        backgroundColor: SColors.ink,
        content: Text('Sign in to enrol — your progress is saved to your '
            'account.'),
      ));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await context.read<LearningProvider>().enroll(_id);
    if (!mounted) return;
    if (err != null) {
      setState(() {
        _busy = false;
        _error = err;
      });
      return;
    }
    setState(() => _busy = false);
    await _load();
  }

  void _open(String itemId) {
    Navigator.of(context)
        .push(MaterialPageRoute(
          builder: (_) => PlayerScreen(courseId: _id, itemId: itemId),
        ))
        // Coming back from a lesson must show the progress that lesson made.
        .then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final title = '${_course['title'] ?? 'Course'}';
    final summary = '${_course['summary'] ?? ''}'.trim();
    final steps = _course['steps'];
    final percent =
        _enrollment == null ? 0 : LearningProvider.percentOf(_outline);
    final next = '${_outline['next'] ?? ''}';

    return Scaffold(
      backgroundColor: SColors.paper,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 240,
            pinned: true,
            backgroundColor: brand.primary,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  ThumbArt(
                    name: title,
                    imageUrl: '${_course['coverImage'] ?? ''}'.isEmpty
                        ? null
                        : '${_course['coverImage']}',
                    radius: 0,
                    icon: Icons.school_rounded,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black26,
                          Colors.transparent,
                          Colors.black54
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.lg, SSpace.lg, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                        fontSize: 24,
                        height: 1.15,
                        fontWeight: FontWeight.w800,
                        color: SColors.ink,
                        fontFamily: brand.displayFont,
                      )),
                  if (summary.isNotEmpty) ...[
                    const SizedBox(height: SSpace.sm),
                    Text(summary,
                        style: const TextStyle(
                            color: SColors.ink2, fontSize: 14.5, height: 1.5)),
                  ],
                  const SizedBox(height: SSpace.lg),
                  Row(
                    children: [
                      if (steps is num && steps > 0)
                        _Fact(
                            icon: Icons.list_alt_rounded,
                            label: '${steps.toInt()} steps'),
                      if (_course['dueInDays'] is num) ...[
                        const SizedBox(width: SSpace.lg),
                        _Fact(
                            icon: Icons.event_rounded,
                            label: 'due in ${_course['dueInDays']} days'),
                      ],
                    ],
                  ),
                  if (_enrollment != null) ...[
                    const SizedBox(height: SSpace.lg),
                    Container(
                      padding: const EdgeInsets.all(SSpace.lg),
                      decoration: BoxDecoration(
                        color: SColors.card,
                        borderRadius: BorderRadius.circular(SRadius.md),
                        border: Border.all(color: SColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text('$percent% complete',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: SColors.ink)),
                              const Spacer(),
                              Text('${_enrollment!['status'] ?? 'enrolled'}',
                                  style: const TextStyle(
                                      color: SColors.muted, fontSize: 12)),
                            ],
                          ),
                          const SizedBox(height: SSpace.sm),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(SRadius.pill),
                            child: LinearProgressIndicator(
                              value: percent / 100,
                              minHeight: 6,
                              backgroundColor: SColors.line,
                              valueColor:
                                  AlwaysStoppedAnimation(brand.accent),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: SSpace.lg),
                    ModuleError(message: _error!, onRetry: _load),
                  ],
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xl, SSpace.lg, SSpace.md),
              child: Text("What's inside",
                  style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink)),
            ),
          ),
          if (_loading)
            const SliverToBoxAdapter(child: ModuleLoading())
          else if (_items.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.menu_book_rounded,
                  title: 'No steps yet',
                  body: 'This course has no pages in it to walk through.',
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, 0, SSpace.lg, SSpace.xxl * 2),
              sliver: SliverList.separated(
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: SSpace.sm),
                itemBuilder: (_, i) => _OutlineRow(
                  item: _items[i],
                  onTap: () => _open('${_items[i]['id']}'),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.md, SSpace.lg, SSpace.md),
        decoration: const BoxDecoration(
          color: SColors.card,
          border: Border(top: BorderSide(color: SColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: brand.primary,
                padding: const EdgeInsets.symmetric(vertical: SSpace.md + 4),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SRadius.pill)),
              ),
              onPressed: _busy || _loading
                  ? null
                  : _enrollment == null
                      ? _enroll
                      : next.isEmpty
                          ? (_items.isEmpty ? null : () => _open('${_items.first['id']}'))
                          : () => _open(next),
              child: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      _enrollment == null
                          ? 'Enrol'
                          : percent >= 100
                              ? 'Read it again'
                              : percent > 0
                                  ? 'Continue'
                                  : 'Start',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Fact({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: SColors.muted),
          const SizedBox(width: SSpace.xs + 2),
          Text(label,
              style: const TextStyle(color: SColors.muted, fontSize: 12.5)),
        ],
      );
}

/// One step. A chapter is a heading, a page is a tap — and a locked page says
/// why it is locked rather than just refusing.
class _OutlineRow extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;
  const _OutlineRow({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final kind = '${item['kind'] ?? 'page'}';
    final title = '${item['title'] ?? ''}';
    final status = '${item['status'] ?? ''}';
    final lock = '${item['lockReason'] ?? ''}'.trim();
    final type = '${item['type'] ?? ''}';
    final duration = '${item['duration'] ?? ''}'.trim();
    final step = item['step'];
    final done = status == 'done' || status == 'complete';

    if (kind == 'chapter') {
      return Padding(
        padding: const EdgeInsets.only(top: SSpace.md, bottom: SSpace.xs),
        child: Text(title.toUpperCase(),
            style: const TextStyle(
                color: SColors.muted,
                fontSize: 11,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w800)),
      );
    }

    return GestureDetector(
      onTap: lock.isEmpty ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.md),
          border: Border.all(color: SColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: done
                    ? SColors.greenSoft
                    : lock.isNotEmpty
                        ? SColors.paper2
                        : brand.primary.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: done
                  ? const Icon(Icons.check_rounded,
                      size: 17, color: SColors.green)
                  : lock.isNotEmpty
                      ? const Icon(Icons.lock_rounded,
                          size: 15, color: SColors.faint)
                      : Text('${step ?? ''}',
                          style: TextStyle(
                              color: brand.primary,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: SSpace.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          height: 1.25,
                          color:
                              lock.isEmpty ? SColors.ink : SColors.faint)),
                  if (lock.isNotEmpty || type.isNotEmpty || duration.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      lock.isNotEmpty
                          ? lock
                          : [
                              if (type.isNotEmpty) _typeWord(type),
                              if (duration.isNotEmpty) duration,
                            ].join(' · '),
                      style: TextStyle(
                          color: lock.isNotEmpty
                              ? SColors.amber
                              : SColors.muted,
                          fontSize: 11.5),
                    ),
                  ],
                ],
              ),
            ),
            if (lock.isEmpty)
              Icon(_typeIcon(type), size: 17, color: SColors.faint),
          ],
        ),
      ),
    );
  }

  static String _typeWord(String type) => switch (type) {
        'video' => 'Video',
        'audio' => 'Audio',
        'pdf' => 'PDF',
        'quiz' => 'Quiz',
        'form' => 'Form',
        'assignment' => 'Assignment',
        'download' => 'Download',
        _ => 'Reading',
      };

  static IconData _typeIcon(String type) => switch (type) {
        'video' => Icons.play_circle_outline_rounded,
        'audio' => Icons.headphones_rounded,
        'pdf' => Icons.picture_as_pdf_rounded,
        'quiz' => Icons.quiz_outlined,
        'form' => Icons.assignment_outlined,
        'assignment' => Icons.edit_note_rounded,
        'download' => Icons.download_rounded,
        _ => Icons.article_outlined,
      };
}
