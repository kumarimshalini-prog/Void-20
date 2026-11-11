/* VOID-20 service worker: installable, and fully usable offline after the first visit.
   Bump VER whenever the shell files change; old caches are dropped on activate. */
const VER = "void20-v3";
const EXT = VER + "-ext";
const NAV_TIMEOUT = 2500; // ms to wait for the network before falling back to the cached app

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./fonts/orbitron-latin.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    const ok = await Promise.all(SHELL.map(async u => {
      try {
        // cache:"reload" so a stale HTTP cache can't poison the precache
        await c.add(new Request(u, { cache: "reload" }));
        return true;
      } catch (err) {
        console.warn("[void20 sw] could not precache", u, err);
        return false;
      }
    }));
    const missing = SHELL.filter((_, i) => !ok[i]);
    if (missing.length) console.warn("[void20 sw] missing from offline cache:", missing.join(", "));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER && k !== EXT).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Off-origin (none by default now the font is self-hosted): cache first, refresh quietly.
  if (url.origin !== self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(EXT);
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response("", { status: 504 });
    })());
    return;
  }

  // Pages: prefer the network so updates land, but never let a dead, erroring or hanging
  // origin keep the user waiting - fall back to the cached app shell.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const shell = async () => (await c.match("./index.html")) || (await c.match("./"));
      const cached = await shell();
      const net = fetch(req).then(r => (r && r.ok) ? r : null).catch(() => null);
      const fresh = cached
        ? await Promise.race([net, new Promise(res => setTimeout(() => res(null), NAV_TIMEOUT))])
        : await net;
      if (fresh) {
        c.put("./index.html", fresh.clone()).catch(() => {});
        return fresh;
      }
      net.then(r => { if (r) c.put("./index.html", r.clone()).catch(() => {}); }).catch(() => {});
      return cached || new Response(
        "VOID-20 has not finished installing yet. Open it once while online, then it works offline.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    })());
    return;
  }

  // Same-origin assets: answer from cache immediately, update the copy in the background.
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(req);
    const refresh = fetch(req)
      .then(r => { if (r && r.ok) c.put(req, r.clone()); return r; })
      .catch(() => null);
    if (hit) {
      refresh.catch(() => {}); // best effort; if the worker dies mid-flight the cache is simply not refreshed
      return hit;
    }
    const r = await refresh;
    return r || new Response("", { status: 504, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })());
});
