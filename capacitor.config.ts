import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dipolar.iptv',
  appName: 'Dipolar',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  plugins: {
    // Use native HTTP so fetch() bypasses CORS (Xtream API, M3U, EPG URLs)
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
