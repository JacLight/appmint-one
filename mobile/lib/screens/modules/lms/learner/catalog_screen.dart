import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/learning_provider.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';
import '../../property/property_widgets.dart' show SectionHead;
import 'course_detail_screen.dart';

/// The course catalogue: what there is to learn, and what I am part way
/// through. Continue comes first — somebody who started something yesterday is
/// not here to browse.
class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final l = context.read<LearningProvider>();
      if (l.catalog.isEmpty && l.mine.isEmpty && !l.loading) l.load();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.watch<LearningProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final browsable = l.browsable;

    return Scaffold(
      backgroundColor: SColors.paper,
      body: RefreshIndicator(
        color: brand.primary,
        onRefresh: () => l.load(),
        child: ListView(
          padding: const EdgeInsets.only(bottom: SSpace.xxl),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  SSpace.lg, SSpace.xxl + SSpace.sm, SSpace.lg, SSpace.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(brand.name.toUpperCase(),
                      style: const TextStyle(
                          color: SColors.faint,
                          fontSize: 10.5,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: SSpace.xs + 2),
                  Text(
                    'What do you want to learn?',
                    style: TextStyle(
                      fontSize: 25,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      color: SColors.ink,
                      fontFamily: brand.displayFont,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
              child: Container(
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.pill),
                  boxShadow: SShadow.soft,
                ),
                child: TextField(
                  controller: _search,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (v) => l.load(keyword: v),
                  decoration: InputDecoration(
                    hintText:
                        'Search ${words.lower(LexiconKeys.course)}s and topics',
                    hintStyle:
                        const TextStyle(color: SColors.faint, fontSize: 14),
                    prefixIcon: const Icon(Icons.search_rounded,
                        color: SColors.muted, size: 20),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ),

            // ── Continue ──────────────────────────────────────────────────
            if (l.inProgress.isNotEmpty) ...[
              const SectionHead(title: 'Pick up where you left off'),
              SizedBox(
                height: 158,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: SSpace.lg),
                  itemCount: l.inProgress.length,
                  separatorBuilder: (_, __) => const SizedBox(width: SSpace.md),
                  itemBuilder: (_, i) => _ContinueCard(row: l.inProgress[i]),
                ),
              ),
            ],

            // ── The catalogue ─────────────────────────────────────────────
            if (l.catalogError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleError(
                    message: l.catalogError!, onRetry: () => l.load()),
              )
            else if (l.loading && l.catalog.isEmpty)
              const _CatalogSkeleton()
            else if (browsable.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.school_rounded,
                  title: l.catalog.isEmpty
                      ? 'No ${words.lower(LexiconKeys.course)}s published yet'
                      : 'You are on everything there is',
                  body: l.catalog.isEmpty
                      ? 'A post becomes a ${words.lower(LexiconKeys.course)} '
                          'the moment it is marked as one and published. It '
                          'then shows here with its cover, summary and how '
                          'many steps it takes.'
                      : 'Every published '
                          '${words.lower(LexiconKeys.course)} is already in '
                          'your learning.',
                ),
              )
            else ...[
              SectionHead(
                  title: _search.text.trim().isEmpty
                      ? 'New ${words.lower(LexiconKeys.course)}s'
                      : '${browsable.length} found'),
              for (final c in browsable)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                      SSpace.lg, 0, SSpace.lg, SSpace.lg),
                  child: CourseCard(course: c),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A course as the catalogue sells it.
class CourseCard extends StatelessWidget {
  final Map<String, dynamic> course;
  const CourseCard({super.key, required this.course});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final title = '${course['title'] ?? 'Untitled'}';
    final summary = '${course['summary'] ?? ''}'.trim();
    final steps = course['steps'];
    final duration = '${course['duration'] ?? ''}'.trim();
    final access = '${course['access'] ?? 'open'}';

    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => CourseDetailScreen(course: course),
      )),
      child: Container(
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          boxShadow: SShadow.soft,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ThumbArt(
                  name: title,
                  imageUrl: '${course['coverImage'] ?? ''}'.isEmpty
                      ? null
                      : '${course['coverImage']}',
                  height: 150,
                  width: double.infinity,
                  radius: 0,
                  icon: Icons.school_rounded,
                ),
                if (access != 'open')
                  Positioned(
                    right: SSpace.md,
                    top: SSpace.md,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: SSpace.sm + 2, vertical: 4),
                      decoration: BoxDecoration(
                        color: SColors.ink.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(SRadius.pill),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.lock_rounded,
                              size: 11, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            access == 'code' ? 'Code needed' : 'Invite only',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(SSpace.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16.5,
                          height: 1.25,
                          fontWeight: FontWeight.w800,
                          color: SColors.ink)),
                  if (summary.isNotEmpty) ...[
                    const SizedBox(height: SSpace.xs + 2),
                    Text(summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: SColors.muted, fontSize: 13, height: 1.35)),
                  ],
                  const SizedBox(height: SSpace.md),
                  Row(
                    children: [
                      if (steps is num && steps > 0) ...[
                        Icon(Icons.list_alt_rounded,
                            size: 14, color: brand.primary),
                        const SizedBox(width: 5),
                        Text('${steps.toInt()} steps',
                            style: TextStyle(
                                color: brand.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                      ],
                      if (duration.isNotEmpty) ...[
                        const SizedBox(width: SSpace.md),
                        const Icon(Icons.schedule_rounded,
                            size: 14, color: SColors.muted),
                        const SizedBox(width: 5),
                        Text(duration,
                            style: const TextStyle(
                                color: SColors.muted, fontSize: 12)),
                      ],
                      const Spacer(),
                      Text('View',
                          style: TextStyle(
                              color: brand.primary,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A course already started: the bar is the point.
class _ContinueCard extends StatelessWidget {
  final Map<String, dynamic> row;
  const _ContinueCard({required this.row});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final course = LearningProvider.courseOf(row);
    final title = '${course['title'] ?? 'Course'}';
    final percent = LearningProvider.percentOf(row);

    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => CourseDetailScreen(course: course),
      )),
      child: Container(
        width: 232,
        padding: const EdgeInsets.all(SSpace.md),
        decoration: BoxDecoration(
          color: SColors.card,
          borderRadius: BorderRadius.circular(SRadius.xl),
          boxShadow: SShadow.soft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ThumbArt(
              name: title,
              imageUrl: '${course['coverImage'] ?? ''}'.isEmpty
                  ? null
                  : '${course['coverImage']}',
              height: 64,
              width: double.infinity,
              radius: SRadius.sm,
              icon: Icons.play_circle_rounded,
            ),
            const SizedBox(height: SSpace.sm),
            Text(title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                    height: 1.25,
                    color: SColors.ink)),
            const Spacer(),
            ClipRRect(
              borderRadius: BorderRadius.circular(SRadius.pill),
              child: LinearProgressIndicator(
                value: percent / 100,
                minHeight: 5,
                backgroundColor: SColors.line,
                valueColor: AlwaysStoppedAnimation(brand.accent),
              ),
            ),
            const SizedBox(height: SSpace.xs + 2),
            Text('$percent% done',
                style: const TextStyle(color: SColors.muted, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class _CatalogSkeleton extends StatelessWidget {
  const _CatalogSkeleton();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(
            SSpace.lg, SSpace.xl, SSpace.lg, SSpace.xxl),
        child: Column(
          children: [
            for (var i = 0; i < 3; i++) ...[
              Container(
                height: 236,
                decoration: BoxDecoration(
                  color: SColors.card,
                  borderRadius: BorderRadius.circular(SRadius.xl),
                  boxShadow: SShadow.soft,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 150,
                      decoration: const BoxDecoration(
                        color: SColors.paper2,
                        borderRadius: BorderRadius.vertical(
                            top: Radius.circular(SRadius.xl)),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(SSpace.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                              width: 180,
                              height: 13,
                              decoration: BoxDecoration(
                                  color: SColors.paper2,
                                  borderRadius:
                                      BorderRadius.circular(SRadius.pill))),
                          const SizedBox(height: SSpace.sm),
                          Container(
                              width: 120,
                              height: 10,
                              decoration: BoxDecoration(
                                  color: SColors.paper2,
                                  borderRadius:
                                      BorderRadius.circular(SRadius.pill))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SSpace.lg),
            ],
          ],
        ),
      );
}
