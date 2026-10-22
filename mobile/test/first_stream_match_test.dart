import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:appmint_one/services/first_stream_match.dart';

void main() {
  for (final outcome in ['match', 'timeout', 'error', 'done']) {
    test(
      '$outcome waits for discovery cancellation before returning',
      () async {
        final cancellation = Completer<void>();
        final controller = StreamController<int>(
          onCancel: () => cancellation.future,
        );
        var finished = false;
        final pending = firstStreamMatch<int>(
          controller.stream,
          (value) => value == 2,
          timeout: const Duration(milliseconds: 20),
        );
        final observed = pending.then<Object?>(
          (value) {
            finished = true;
            return value;
          },
          onError: (Object error) {
            finished = true;
            return error;
          },
        );
        switch (outcome) {
          case 'match':
            controller.add(1);
            controller.add(2);
          case 'error':
            controller.addError(StateError('Discovery failed'));
          case 'done':
            unawaited(controller.close());
        }
        await Future<void>.delayed(const Duration(milliseconds: 40));
        expect(finished, isFalse);
        cancellation.complete();
        final result = await observed;
        if (outcome == 'match') {
          expect(result, 2);
        } else if (outcome == 'error') {
          expect(result, isA<StateError>());
        } else {
          expect(result, isNull);
        }
        await controller.close();
      },
    );
  }
}
