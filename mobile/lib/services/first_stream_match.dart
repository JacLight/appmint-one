import 'dart:async';

/// Await a discovery result and finish cancellation before allowing another
/// SDK operation. Future.timeout alone leaves the discovery stream running.
Future<T?> firstStreamMatch<T>(
  Stream<T> stream,
  bool Function(T) matches, {
  required Duration timeout,
}) async {
  final result = Completer<T?>();
  final subscription = stream.listen(
    (value) {
      if (!result.isCompleted && matches(value)) result.complete(value);
    },
    onError: (Object error, StackTrace stack) {
      if (!result.isCompleted) result.completeError(error, stack);
    },
    onDone: () {
      if (!result.isCompleted) result.complete(null);
    },
  );
  try {
    return await result.future.timeout(timeout, onTimeout: () => null);
  } finally {
    await subscription.cancel();
  }
}
