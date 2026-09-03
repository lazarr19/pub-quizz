// Minimal service worker: only caches static assets (images/fonts/css/js).
// Navigations and API/auth requests always hit the network untouched.
const CACHE_VERSION = "kzz-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStaticAsset = ["image", "font", "style", "script"].includes(
    request.destination,
  );
  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Ko Zna Zna", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Ignore malformed push payloads.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "kzz-notification",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        for (const client of clientsList) {
          if (new URL(client.url).pathname === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
