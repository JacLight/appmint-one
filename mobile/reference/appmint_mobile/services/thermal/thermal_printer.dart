// Platform switch for the thermal printer plugin.
//
// `flutter_thermal_printer` drags in Windows FFI code that cannot compile for
// the web, so the web build gets a no-op stand-in with the same surface. Mobile
// and desktop builds export the plugin plus checked transports that propagate print failures.
export 'thermal_printer_io.dart'
    if (dart.library.js_interop) 'thermal_printer_web.dart';
