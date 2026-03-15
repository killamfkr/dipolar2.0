package com.dipolar.iptv;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenWithPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
