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

/**
 * Full-screen in-app player using LibVLC (hardware decode, broad codec support).
 * Started with Intent extra EXTRA_STREAM_URL. Close button returns to the app.
 */
public class VlcPlayerActivity extends AppCompatActivity {

    public static final String EXTRA_STREAM_URL = "stream_url";

    private LibVLC libVlc;
    private MediaPlayer mediaPlayer;
    private VLCVideoLayout videoLayout;

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
            libVlc = new LibVLC(this);
            mediaPlayer = new MediaPlayer(libVlc);
            mediaPlayer.attachViews(videoLayout, null, false, false);

            Media media = new Media(libVlc, Uri.parse(url));
            media.setHWDecoderEnabled(true, false);
            media.addOption(":network-caching=1500");

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
