import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../config/stowbo_theme.dart';
import '../models/stowbo_host.dart';
import '../services/maps_config_service.dart';

/// Google Map rendered via the Maps JS API inside a WebView. The API key is
/// fetched from the server at runtime and injected here — never stored on the
/// platform. Tapping a price pin calls [onSelect] with the host.
class GoogleMapView extends StatefulWidget {
  final List<StowboHost> hosts;
  final ValueChanged<StowboHost> onSelect;
  final double? userLat;
  final double? userLng;
  const GoogleMapView({
    super.key,
    required this.hosts,
    required this.onSelect,
    this.userLat,
    this.userLng,
  });

  @override
  State<GoogleMapView> createState() => _GoogleMapViewState();
}

class _GoogleMapViewState extends State<GoogleMapView> {
  WebViewController? _controller;
  bool _loading = true;
  String? _error;

  List<StowboHost> get _located =>
      widget.hosts.where((h) => h.lat != null && h.lng != null).toList();

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final key = await mapsConfigService.mapsApiKey();
    if (!mounted) return;
    if (key == null || key.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Map unavailable — no Google key configured.';
      });
      return;
    }
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(SColors.paper)
      ..addJavaScriptChannel('MarkerTap', onMessageReceived: (msg) {
        final id = msg.message;
        final host =
            widget.hosts.where((h) => h.sk == id).cast<StowboHost?>().firstOrNull;
        if (host != null) widget.onSelect(host);
      })
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
      ))
      ..loadHtmlString(_html(key));
    setState(() => _controller = controller);
  }

  /// Re-center the live map on the guest without reloading the page.
  void recenterOnUser() {
    final lat = widget.userLat, lng = widget.userLng;
    if (lat == null || lng == null || _controller == null) return;
    _controller!.runJavaScript('recenter($lat,$lng);');
  }

  String _html(String key) {
    final l = _located;
    final hasUser = widget.userLat != null && widget.userLng != null;
    // Prefer the guest's own location as the map center (Uber-style); else the
    // mean of located listings; else a sensible default.
    final centerLat = hasUser
        ? widget.userLat!
        : l.isEmpty
            ? 40.7328
            : l.map((h) => h.lat!).reduce((a, b) => a + b) / l.length;
    final centerLng = hasUser
        ? widget.userLng!
        : l.isEmpty
            ? -73.9950
            : l.map((h) => h.lng!).reduce((a, b) => a + b) / l.length;
    final markers = jsonEncode(l
        .map((h) => {
              'id': h.sk,
              'lat': h.lat,
              'lng': h.lng,
              'price': h.ratePerHour.toStringAsFixed(0),
            })
        .toList());
    return '''
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>html,body,#map{height:100%;margin:0;padding:0;background:#F5F1E8}</style>
</head>
<body>
<div id="map"></div>
<script>
var _map, _me;
function recenter(lat,lng){
  if(!_map) return;
  _map.panTo({lat:lat,lng:lng});
  if(_me){ _me.setPosition({lat:lat,lng:lng}); }
}
function initMap(){
  _map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:$centerLat,lng:$centerLng}, zoom:14,
    disableDefaultUI:true, clickableIcons:false, gestureHandling:'greedy'
  });
  var hasUser=$hasUser;
  if(hasUser){
    // The "you are here" blue dot, Uber-style.
    _me=new google.maps.Marker({
      position:{lat:$centerLat,lng:$centerLng}, map:_map, zIndex:999,
      icon:{path:google.maps.SymbolPath.CIRCLE, scale:8, fillColor:'#1A73E8', fillOpacity:1, strokeColor:'#ffffff', strokeWeight:3}
    });
    new google.maps.Marker({
      position:{lat:$centerLat,lng:$centerLng}, map:_map, clickable:false, zIndex:1,
      icon:{path:google.maps.SymbolPath.CIRCLE, scale:22, fillColor:'#1A73E8', fillOpacity:0.14, strokeWeight:0}
    });
  }
  var data=$markers;
  data.forEach(function(m){
    var mk=new google.maps.Marker({
      position:{lat:m.lat,lng:m.lng}, map:_map,
      label:{text:'\$'+m.price, color:'#ffffff', fontWeight:'700', fontSize:'12px'},
      icon:{path:google.maps.SymbolPath.CIRCLE, scale:18, fillColor:'#CF6A3C', fillOpacity:1, strokeColor:'#ffffff', strokeWeight:2}
    });
    mk.addListener('click',function(){ MarkerTap.postMessage(m.id); });
  });
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=$key&callback=initMap"></script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(SSpace.xl),
          child: Text(_error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: SColors.muted)),
        ),
      );
    }
    final hasUser = widget.userLat != null && widget.userLng != null;
    return Stack(
      children: [
        if (_controller != null)
          WebViewWidget(controller: _controller!),
        if (_loading)
          const Center(
              child: CircularProgressIndicator(color: SColors.clay)),
        if (hasUser && !_loading)
          Positioned(
            right: SSpace.lg,
            bottom: SSpace.lg,
            child: Material(
              color: SColors.card,
              shape: const CircleBorder(),
              elevation: 3,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: recenterOnUser,
                child: const Padding(
                  padding: EdgeInsets.all(11),
                  child: Icon(Icons.my_location_rounded,
                      color: SColors.clay, size: 22),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
