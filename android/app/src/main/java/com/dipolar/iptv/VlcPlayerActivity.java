package com.dipolar.iptv;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;
import org.videolan.libvlc.util.VLCVideoLayout;

import java.util.ArrayList;
import java.util.List;

/**
 * Full-screen in-app player using LibVLC (libvlc-all: full codecs for IPTV).
 * Supports HLS, MPEG-TS, RTSP, RTMP, and common codecs (H.264, HEVC, AAC, AC3, etc.).
 * Started with Intent extra EXTRA_STREAM_URL. Close button returns to the app.
 */
public class VlcPlayerActivity extends AppCompatActivity {

    public static final String EXTRA_STREAM_URL = "stream_url";

    private LibVLC libVlc;
    private MediaPlayer mediaPlayer;
    private VLCVideoLayout videoLayout;

    /**
     * LibVLC options tuned for IPTV: live/low-latency, HW decode, RTSP over TCP, codec support.
     * libvlc-all AAR includes full codec set (no extra plugins needed).
     */
    private static List<String> getIptvLibVlcOptions() {
        List<String> options = new ArrayList<>();
        options.add("--network-caching=2000");   // buffer ms for stability
        options.add("--live-caching=500");       // live stream buffer
        options.add("--rtsp-tcp");               // RTSP over TCP (reliable)
        options.add("--avcodec-hw=any");         // use hardware decode when available
        options.add("--no-drop-late-frames");   // avoid skipping for live
        options.add("--no-skip-frames");
        options.add("--clock-jitter=0");
        options.add("--clock-synchro=0");
        return options;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_vlc_player);

        videoLayout = findViewById(R.id.vlc_video_layout);
        Button closeButton = findViewById(R.id.close_button);
        closeButton.setOnClickListener((View v) -> finish());

        String url = getIntent() != null ? getIntent().getStringExtra(EXTRA_STREAM_URL) : null;
        if (url == null || url.trim().isEmpty()) {
            Toast.makeText(this, "No stream URL", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        url = url.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        if (url.contains("undefined") || url.contains("null")) {
            Toast.makeText(this, "Invalid stream URL", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        try {
            libVlc = new LibVLC(this, getIptvLibVlcOptions());
            mediaPlayer = new MediaPlayer(libVlc);
            mediaPlayer.attachViews(videoLayout, null, false, false);

            Media media = new Media(libVlc, Uri.parse(url));
            media.setHWDecoderEnabled(true, false);  // enable HW decode, fallback to software if needed
            media.addOption(":network-caching=2000");
            media.addOption(":live-caching=500");

            mediaPlayer.setMedia(media);
            media.release();
            mediaPlayer.play();
        } catch (Exception e) {
            Toast.makeText(this, "Playback failed: " + (e.getMessage() != null ? e.getMessage() : "Unknown error"), Toast.LENGTH_LONG).show();
            finish();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            mediaPlayer.detachViews();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (libVlc != null) {
            libVlc.release();
            libVlc = null;
        }
    }
}
