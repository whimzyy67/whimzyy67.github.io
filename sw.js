/* Whimzyy service worker. Keep this file in the SITE ROOT (next to index.html).
   Bump VERSION whenever you deploy new files so phones drop the old cache. */
const VERSION = "whimzyy-v20";
const CORE = ["./", "./index.html", "./home.html", "./pwa/offline.html", "./pwa/manifest.json",
  "./pwa/icons/icon-192.png", "./pwa/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages: network first (always fresh), fall back to cache, then the offline page.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match("./pwa/offline.html")))
    );
    return;
  }

  // Same-site files + Google Fonts: serve from cache instantly, refresh in the background.
  const okHost = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!okHost) return;
  // Big media (video/audio) is streamed, not cached.
  if (/\.(mp4|webm|mp3|ogg|wav)$/i.test(url.pathname) || req.headers.has("range")) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});


/* ---------- closed-app alerts (Web Push) ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  e.waitUntil((async () => {
    // if Whimzyy is open and in front, the page already shows its own pop-up: do not double up
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === "visible")) return;
    await self.registration.showNotification(d.title || "Whimzyy", {
      body: d.body || "",
      tag: d.tag || "whimzyy",
      icon: "./pwa/icons/icon-192.png",
      badge: "./pwa/icons/icon-192.png",
      data: { url: d.url || "./home.html" }
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./home.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
