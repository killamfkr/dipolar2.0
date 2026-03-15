/**
 * Poster image that on native fetches via CapacitorHttp so box art loads
 * when the WebView blocks cross-origin or provider image URLs.
 * Uses a small concurrency limit so many posters loading at once don't lock the UI.
 */

import { useState, useEffect, useRef } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const CACHE_MAX = 80;
const MAX_CONCURRENT_IMAGE_REQUESTS = 3;
const urlToBlobUrl = new Map<string, string>();
const urlOrder: string[] = [];

type QueuedTask = { url: string; resolve: (v: string | null) => void };
const requestQueue: QueuedTask[] = [];
let inFlight = 0;

function evictCache(): void {
  while (urlOrder.length >= CACHE_MAX && urlOrder.length > 0) {
    const old = urlOrder.shift()!;
    const blobUrl = urlToBlobUrl.get(old);
    urlToBlobUrl.delete(old);
    if (blobUrl) try { URL.revokeObjectURL(blobUrl); } catch { /* ignore */ }
  }
}

function doOneFetch(url: string): Promise<string | null> {
  if (urlToBlobUrl.has(url)) return Promise.resolve(urlToBlobUrl.get(url)!);
  return new Promise((resolve) => {
    function run() {
      inFlight++;
      CapacitorHttp.get({
        url,
        responseType: 'blob',
        connectTimeout: 10_000,
        readTimeout: 10_000,
      })
        .then((res) => {
          if (res.status >= 400) return null;
          const data = res.data;
          if (data instanceof Blob) {
            return new Promise<string | null>((r) => {
              requestAnimationFrame(() => {
                evictCache();
                const blobUrl = URL.createObjectURL(data);
                urlToBlobUrl.set(url, blobUrl);
                urlOrder.push(url);
                r(blobUrl);
              });
            });
          }
          if (typeof data === 'string' && data.length > 0) {
            const headers = (res as { headers?: Record<string, string> }).headers;
            const contentType = headers?.['Content-Type'] || 'image/jpeg';
            return new Promise<string | null>((r) => {
              requestAnimationFrame(() => {
                try {
                  evictCache();
                  const binary = atob(data);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                  const blob = new Blob([bytes], { type: contentType });
                  const blobUrl = URL.createObjectURL(blob);
                  urlToBlobUrl.set(url, blobUrl);
                  urlOrder.push(url);
                  r(blobUrl);
                } catch {
                  r(null);
                }
              });
            });
          }
          return null;
        })
        .catch(() => null)
        .then((result) => {
          inFlight--;
          resolve(result);
          const next = requestQueue.shift();
          if (next) runNext(next);
        });
    }
    run();
  });
}

function runNext(task: QueuedTask) {
  if (urlToBlobUrl.has(task.url)) {
    task.resolve(urlToBlobUrl.get(task.url)!);
    const next = requestQueue.shift();
    if (next) runNext(next);
    return;
  }
  doOneFetch(task.url).then(task.resolve);
}

function fetchImageAsBlobUrl(url: string): Promise<string | null> {
  if (urlToBlobUrl.has(url)) return Promise.resolve(urlToBlobUrl.get(url)!);
  if (inFlight < MAX_CONCURRENT_IMAGE_REQUESTS) {
    return doOneFetch(url);
  }
  return new Promise((resolve) => {
    requestQueue.push({ url, resolve });
  });
}

export interface ProxiedPosterProps {
  src: string | undefined;
  fallback?: string;
  alt?: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function ProxiedPoster({ src, fallback = '', alt = '', className, loading = 'lazy' }: ProxiedPosterProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const [errored, setErrored] = useState(false);
  const mounted = useRef(true);

  const isNative = Capacitor.isNativePlatform();
  const effectiveSrc = src?.trim();
  const shouldProxy = isNative && effectiveSrc && (effectiveSrc.startsWith('http://') || effectiveSrc.startsWith('https://'));

  useEffect(() => {
    mounted.current = true;
    setErrored(false);
    if (!effectiveSrc) {
      setResolvedSrc(undefined);
      return;
    }
    if (!shouldProxy) {
      setResolvedSrc(effectiveSrc);
      return;
    }
    setResolvedSrc(undefined);
    fetchImageAsBlobUrl(effectiveSrc).then((blobUrl) => {
      if (mounted.current && blobUrl) setResolvedSrc(blobUrl);
      else if (mounted.current && !blobUrl) setResolvedSrc(effectiveSrc);
    });
    return () => {
      mounted.current = false;
    };
  }, [effectiveSrc, shouldProxy]);

  const displaySrc = resolvedSrc ?? (shouldProxy ? undefined : effectiveSrc);
  const finalSrc = errored && fallback ? fallback : displaySrc ?? effectiveSrc;

  if (!finalSrc && shouldProxy) return <span className={className} aria-hidden> </span>;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setErrored(true)}
    />
  );
}
