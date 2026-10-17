/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

// The service worker (bundled by src/app/serwist/[path]/route.ts).
//
// Deliberately narrow: only the members list and the pending list are kept
// for offline reading (the last copy loaded). Every other page, every API
// response and every Server Action always goes to the network, so private
// data (cases, receipts, reports) is never stored on the phone and nothing can
// be saved while offline. Pages that cannot load show /~offline.

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Name of the cache holding the read-only lists; the login page empties it (see ClearOfflineCache). */
const OFFLINE_LISTS_CACHE = "offline-lists";
const OFFLINE_PATHS = new Set(["/manage/members", "/manage/pending"]);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Full page loads of the two lists: fresh when online, the last good copy when offline.
      matcher: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && OFFLINE_PATHS.has(url.pathname),
      handler: new NetworkFirst({
        cacheName: OFFLINE_LISTS_CACHE,
        networkTimeoutSeconds: 8,
        plugins: [
          {
            // One copy per list: ?month= and other filters share the latest version.
            cacheKeyWillBeUsed: async ({ request }) => {
              const url = new URL(request.url);
              return `${url.origin}${url.pathname}`;
            },
            // Never keep error pages or a redirect to the login page.
            cacheWillUpdate: async ({ response }) => (response.ok && !response.redirected ? response : null),
          },
          new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      // Build output has content hashes in its names, so it never goes stale.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/icons\/.+\.png$/.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: "app-icons" }),
    },
    {
      // Everything else, including page loads: network only, so the offline page can step in.
      matcher: () => true,
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
