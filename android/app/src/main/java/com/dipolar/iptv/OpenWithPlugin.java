package com.dipolar.iptv;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens a stream URL via the Share sheet so the user can pick VLC, MX Player, etc.
 * (Share sheet reliably lists video apps that can open the URL with proper codecs.)
 */
@CapacitorPlugin(name = "OpenWith")
public class OpenWithPlugin extends Plugin {

    @PluginMethod
    public void openWith(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL is required");
            return;
        }
        String trimmed = url.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "http://" + trimmed;
        }
        if (trimmed.contains("undefined") || trimmed.contains("null")) {
            call.reject("Invalid stream URL");
            return;
        }
        try {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("text/plain");
            send.putExtra(Intent.EXTRA_TEXT, trimmed);
            send.putExtra(Intent.EXTRA_TITLE, "Stream URL");
            final Intent chooser = Intent.createChooser(send, "Open stream with");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    try {
                        if (getActivity() != null) {
                            getActivity().startActivity(chooser);
                            call.resolve(new JSObject());
                        } else {
                            getContext().startActivity(chooser);
                            call.resolve(new JSObject());
                        }
                    } catch (Exception e2) {
                        call.reject("Could not open: " + (e2.getMessage() != null ? e2.getMessage() : "No app to handle this URL"));
                    }
                });
            } else {
                getContext().startActivity(chooser);
                call.resolve(new JSObject());
            }
        } catch (Exception e) {
            call.reject("Could not open URL: " + (e.getMessage() != null ? e.getMessage() : "No app to handle this URL"));
        }
    }

    /**
     * Play stream in the built-in VLC player (same activity, no Share sheet).
     */
    @PluginMethod
    public void playInVlc(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL is required");
            return;
        }
        String trimmed = url.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "http://" + trimmed;
        }
        if (trimmed.contains("undefined") || trimmed.contains("null")) {
            call.reject("Invalid stream URL");
            return;
        }
        try {
            Intent intent = new Intent(getContext(), VlcPlayerActivity.class);
            intent.putExtra(VlcPlayerActivity.EXTRA_STREAM_URL, trimmed);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    try {
                        getContext().startActivity(intent);
                        call.resolve(new JSObject());
                    } catch (Exception e2) {
                        call.reject("Could not open VLC player: " + (e2.getMessage() != null ? e2.getMessage() : "Unknown"));
                    }
                });
            } else {
                getContext().startActivity(intent);
                call.resolve(new JSObject());
            }
        } catch (Exception e) {
            call.reject("Could not open VLC player: " + (e.getMessage() != null ? e.getMessage() : "Unknown"));
        }
    }
}
