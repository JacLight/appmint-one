// Conditional export: real flutter_stripe on mobile, a stub on web.
export 'stripe_service_stub.dart'
    if (dart.library.io) 'stripe_service_mobile.dart';
