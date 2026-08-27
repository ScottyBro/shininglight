/* Shining Light service worker — app shell + offline reads.
 * Plain SW (no Workbox) so the caching policy stays explicit.
 */
const VERSION = "v1"
const SHELL_CACHE = `sl-shell-${VERSION}`
const PAGE_CACHE = `sl-pages-${VERSION}`
const ASSET_CACHE = `sl-assets-${VERSION}`

const SHELL = ["/", "/offline", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
  }
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    /\.(?:png|svg|jpg|jpeg|webp|ico|css|js|woff2?)$/.test(url.pathname)
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)

  // Only handle our own origin. Supabase (data/auth/realtime) always goes to
  // the network so nothing sensitive is cached by the SW.
  if (url.origin !== self.location.origin) return

  // App navigations: network-first, fall back to the cached page, then offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached || (await caches.match("/offline")) || Response.error()
        })
    )
    return
  }

  // Static assets: cache-first, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone()
            caches.open(ASSET_CACHE).then((c) => c.put(request, copy))
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
