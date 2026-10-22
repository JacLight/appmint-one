import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../config/setup.dart';
import '../../../../config/stowbo_theme.dart';
import '../../../../providers/learning_provider.dart';
import '../../../../widgets/thumb.dart';
import '../../shared/module_states.dart';
import '../../property/property_widgets.dart' show SectionHead;
import 'course_detail_screen.dart';

/// Everything this person is on, and everything they have finished.
class MyLearningScreen extends StatelessWidget {
  const MyLearningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = context.watch<LearningProvider>();
    final brand = CurrentSetup.brand;
    final words = CurrentSetup.words;
    final going = l.inProgress;
    final notStarted = [
      for (final c in l.mine)
        if (LearningProvider.percentOf(c) == 0) c,
    ];
    final done = l.finished;

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
              child: Text(
                'My learning',
                style: TextStyle(
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                  color: SColors.ink,
                  fontFamily: brand.displayFont,
                ),
              ),
            ),
            if (l.mineError != null)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child:
                    ModuleError(message: l.mineError!, onRetry: () => l.load()),
              )
            else if (l.loading && l.mine.isEmpty)
              const ModuleLoading()
            else if (l.mine.isEmpty)
              Padding(
                padding: const EdgeInsets.all(SSpace.lg),
                child: ModuleEmpty(
                  icon: Icons.school_rounded,
                  title: 'Nothing enrolled yet',
                  body:
                      'Enrol on a ${words.lower(LexiconKeys.course)} and it '
                      'appears here, with how far through it you are.',
                ),
              )
            else ...[
              if (going.isNotEmpty) ...[
                SectionHead(title: 'In progress · ${going.length}'),
                for (final c in going) _Row(row: c),
              ],
              if (notStarted.isNotEmpty) ...[
                SectionHead(title: 'Not started · ${notStarted.length}'),
                for (final c in notStarted) _Row(row: c),
              ],
              if (done.isNotEmpty) ...[
                SectionHead(title: 'Finished · ${done.length}'),
                for (final c in done) _Row(row: c),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final Map<String, dynamic> row;
  const _Row({required this.row});

  @override
  Widget build(BuildContext context) {
    final brand = CurrentSetup.brand;
    final course = LearningProvider.courseOf(row);
    final title = '${course['title'] ?? 'Course'}';
    final percent = LearningProvider.percentOf(row);
    final e = row['enrollment'];
    final status = e is Map ? '${e['status'] ?? ''}' : '';

    return Padding(
      padding:
          const EdgeInsets.fromLTRB(SSpace.lg, 0, SSpace.lg, SSpace.md),
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CourseDetailScreen(course: course),
        )),
        child: Container(
          padding: const EdgeInsets.all(SSpace.md),
          decoration: BoxDecoration(
            color: SColors.card,
            borderRadius: BorderRadius.circular(SRadius.md),
            border: Border.all(color: SColors.line),
          ),
          child: Row(
            children: [
              ThumbArt(
                name: title,
                imageUrl: '${course['coverImage'] ?? ''}'.isEmpty
                    ? null
                    : '${course['coverImage']}',
                width: 58,
                height: 58,
                radius: SRadius.sm,
                icon: Icons.school_rounded,
              ),
              const SizedBox(width: SSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            height: 1.25,
                            color: SColors.ink)),
                    const SizedBox(height: SSpace.sm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(SRadius.pill),
                      child: LinearProgressIndicator(
                        value: percent / 100,
                        minHeight: 5,
                        backgroundColor: SColors.line,
                        valueColor: AlwaysStoppedAnimation(
                            percent >= 100 ? SColors.green : brand.accent),
                      ),
                    ),
                    const SizedBox(height: SSpace.xs + 2),
                    Text(
                      [
                        '$percent%',
                        if (status.isNotEmpty) status,
                      ].join(' · '),
                      style:
                          const TextStyle(color: SColors.muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: SColors.faint),
            ],
          ),
        ),
      ),
    );
  }
}
