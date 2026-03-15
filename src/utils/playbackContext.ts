/**
 * Detect current playback context at runtime (mobile app, browser, TV).
 * Used so playback behavior and Settings copy adapt when switching devices.
 */

export type PlaybackContext = 'android' | 'web' | 'webTV' | 'nativeOther';

/** User-facing label for the current playback mode */
export const PLAYBACK_LABELS: Record<PlaybackContext, string> = {
  android: 'Built-in VLC (mobile)',
  web: 'In-app player (browser)',
  webTV: 'Opens in new tab (TV codecs)',
  nativeOther: 'External or in-app (your choice)',
};

function isWebTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const tvPatterns = [
    /TV\b/i,
    /SmartTV/i,
    /GoogleTV/i,
    /AFT[A-Z]/i,       // Amazon Fire TV
    /AFTM/i,
    /CrKey/i,          // Chromecast
    /HbbTV/i,
    /CE-HTML/i,
    /Opera TV/i,
    /POV_TV/i,
    /Viera/i,
    /Roku/i,
    /Xbox/i,
    /PlayStation/i,
    /Web0S/i,
    /Tizen/i,
    /NetCast/i,
  ];
  if (tvPatterns.some((p) => p.test(ua))) return true;
  // Only use UA for TV; avoid treating desktop/laptop as TV (so they get in-app player)
  return false;
}

/**
 * Resolve current playback context (detected each call, no persistence).
 */
export async function getPlaybackContext(): Promise<PlaybackContext> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    const native = Capacitor.isNativePlatform();
    const platform = (Capacitor.getPlatform?.() ?? '').toLowerCase();
    if (native && platform === 'android') return 'android';
    if (!native) {
      return isWebTV() ? 'webTV' : 'web';
    }
    return 'nativeOther';
  } catch {
    return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
      ? 'android'
      : isWebTV()
        ? 'webTV'
        : 'web';
  }
}

/**
 * Synchronous hint for initial render (web only; native detection needs async Capacitor).
 */
export function getPlaybackContextSync(): PlaybackContext {
  if (typeof navigator === 'undefined') return 'web';
  if (isWebTV()) return 'webTV';
  return 'web';
}
