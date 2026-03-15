# Android app (Capacitor)

## Built-in VLC player (full codecs for IPTV)

In-app playback on Android uses **LibVLC** via `org.videolan.android:libvlc-all`. This is the full VLC build with codecs included—no extra plugins needed.

- **Dependency:** `libvlc-all:3.4.4` in `app/build.gradle`
- **Activity:** `VlcPlayerActivity` (launched by `OpenWithPlugin.playInVlc()` when not using external player)
- **Formats/codecs:** HLS, MPEG-TS, RTSP, RTMP; H.264, HEVC, VP9, AAC, AC3, E-AC3, etc.

Options in `VlcPlayerActivity` are tuned for IPTV (network/live caching, RTSP over TCP, hardware decode). To change buffer or codec behavior, edit `VlcPlayerActivity.getIptvLibVlcOptions()` and the `Media` options in `onCreate`.
