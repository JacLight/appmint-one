import 'package:flutter/material.dart';

import '../config/stowbo_theme.dart';

/// Lesson content, rendered.
///
/// Course pages are authored as HTML. Rather than add a rendering package to
/// an app that is already large, this handles the subset course content is
/// actually written in — headings, paragraphs, lists, quotes, images, rules —
/// and falls back to readable text for anything else. What it will not do is
/// show tags to the reader: a lesson full of `<p>` is worse than plain prose.
class LessonContent extends StatelessWidget {
  final String html;
  const LessonContent({super.key, required this.html});

  @override
  Widget build(BuildContext context) {
    final blocks = _parse(html);
    if (blocks.isEmpty) {
      return const Text(
        'This page has no content yet.',
        style: TextStyle(color: SColors.muted, fontStyle: FontStyle.italic),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final b in blocks) ...[
          _block(context, b),
          SizedBox(height: b.kind == _Kind.listItem ? SSpace.sm : SSpace.lg),
        ],
      ],
    );
  }

  Widget _block(BuildContext context, _Block b) {
    switch (b.kind) {
      case _Kind.h1:
        return Text(b.text,
            style: const TextStyle(
                fontSize: 23,
                height: 1.25,
                fontWeight: FontWeight.w800,
                color: SColors.ink));
      case _Kind.h2:
        return Text(b.text,
            style: const TextStyle(
                fontSize: 19,
                height: 1.3,
                fontWeight: FontWeight.w800,
                color: SColors.ink));
      case _Kind.h3:
        return Text(b.text,
            style: const TextStyle(
                fontSize: 16,
                height: 1.3,
                fontWeight: FontWeight.w700,
                color: SColors.ink));
      case _Kind.listItem:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 7, right: SSpace.sm),
              child: SizedBox(
                width: 5,
                height: 5,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                      color: SColors.clay, shape: BoxShape.circle),
                ),
              ),
            ),
            Expanded(
              child: Text(b.text,
                  style: const TextStyle(
                      fontSize: 15, height: 1.55, color: SColors.ink2)),
            ),
          ],
        );
      case _Kind.quote:
        return Container(
          padding: const EdgeInsets.fromLTRB(SSpace.lg, SSpace.md, SSpace.md, SSpace.md),
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: SColors.clay, width: 3)),
          ),
          child: Text(b.text,
              style: const TextStyle(
                  fontSize: 15,
                  height: 1.5,
                  color: SColors.ink2,
                  fontStyle: FontStyle.italic)),
        );
      case _Kind.code:
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SSpace.md),
          decoration: BoxDecoration(
            color: SColors.ink,
            borderRadius: BorderRadius.circular(SRadius.sm),
          ),
          child: Text(b.text,
              style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12.5,
                  height: 1.5,
                  color: Color(0xFFE8E1D0))),
        );
      case _Kind.image:
        return ClipRRect(
          borderRadius: BorderRadius.circular(SRadius.md),
          child: Image.network(
            b.text,
            fit: BoxFit.cover,
            width: double.infinity,
            // A lesson image that will not load must not take the lesson with
            // it; the words are the point.
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
        );
      case _Kind.rule:
        return const Divider(color: SColors.line);
      case _Kind.paragraph:
        return Text(b.text,
            style: const TextStyle(
                fontSize: 15, height: 1.6, color: SColors.ink2));
    }
  }

  // ── The small parser ──────────────────────────────────────────────────────

  static List<_Block> _parse(String source) {
    final out = <_Block>[];
    if (source.trim().isEmpty) return out;

    // Nothing that runs: a lesson is prose, and a script tag in it is either a
    // mistake or something this app has no business executing.
    var s = source
        .replaceAll(RegExp(r'<script[\s\S]*?</script>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<style[\s\S]*?</style>', caseSensitive: false), '');

    for (final m in RegExp(r'<img[^>]*src="([^"]+)"[^>]*>', caseSensitive: false)
        .allMatches(s)) {
      // Images are pulled out first so they survive tag stripping.
      s = s.replaceFirst(m.group(0)!, '\u0000IMG:${m.group(1)}\u0000');
    }

    final blockRe = RegExp(
      r'<(h1|h2|h3|h4|p|li|blockquote|pre|code|hr)[^>]*>([\s\S]*?)</\1>|<hr\s*/?>',
      caseSensitive: false,
    );

    final matches = blockRe.allMatches(s).toList();
    if (matches.isEmpty) {
      // Not HTML at all, or one unwrapped run of text: split on blank lines so
      // plain-text lessons still read as paragraphs.
      for (final part in s.split(RegExp(r'\n\s*\n'))) {
        _emit(out, _Kind.paragraph, part);
      }
      return out;
    }

    for (final m in matches) {
      final tag = (m.group(1) ?? 'hr').toLowerCase();
      final inner = m.group(2) ?? '';
      switch (tag) {
        case 'h1':
          _emit(out, _Kind.h1, inner);
        case 'h2':
          _emit(out, _Kind.h2, inner);
        case 'h3':
        case 'h4':
          _emit(out, _Kind.h3, inner);
        case 'li':
          _emit(out, _Kind.listItem, inner);
        case 'blockquote':
          _emit(out, _Kind.quote, inner);
        case 'pre':
        case 'code':
          _emit(out, _Kind.code, inner);
        case 'hr':
          out.add(const _Block(_Kind.rule, ''));
        default:
          _emit(out, _Kind.paragraph, inner);
      }
    }
    return out;
  }

  /// Adds a block, turning any image markers inside it into their own blocks.
  static void _emit(List<_Block> out, _Kind kind, String raw) {
    for (final part in raw.split('\u0000')) {
      if (part.startsWith('IMG:')) {
        final url = part.substring(4).trim();
        if (url.isNotEmpty) out.add(_Block(_Kind.image, url));
        continue;
      }
      final text = _text(part);
      if (text.isNotEmpty) out.add(_Block(kind, text));
    }
  }

  static String _text(String raw) => raw
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp(r'<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll(RegExp(r'[ \t]+'), ' ')
      .trim();
}

enum _Kind { h1, h2, h3, paragraph, listItem, quote, code, image, rule }

class _Block {
  final _Kind kind;
  final String text;
  const _Block(this.kind, this.text);
}
