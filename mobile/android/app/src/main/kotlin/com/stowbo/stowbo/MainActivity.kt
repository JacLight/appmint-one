package com.stowbo.stowbo

import io.flutter.embedding.android.FlutterFragmentActivity

// flutter_stripe's PaymentSheet requires a FragmentActivity host; the default
// FlutterActivity crashes the sheet on Android.
class MainActivity : FlutterFragmentActivity()
