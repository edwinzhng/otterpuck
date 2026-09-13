# Automatic offline play

Production builds register `/sw.js` after the initial game load. No settings or download action are required. Development mode does not register a worker. HTTPS is required except on localhost.

`offline-assets.ts` lists runtime content for both arenas, current swimmers and first-person rig, tutorial art, audio and install icons. The build also includes emitted HTML, JavaScript, styles and linked assets. It cleans the generated output first so abandoned bundles cannot accumulate in the cache manifest.

Each build derives a cache version from the worker source and every resource's SHA-256 digest. Installation requests use integrity checks and publish the complete cache atomically via `Cache.addAll`. A failed or interrupted download discards only the incomplete new version. This also rejects mismatched resources if a deployment changes during installation.

Known same-origin GET requests are served from that worker's versioned cache, including arena URLs with query strings. `/` and `/index.html` share the cached app shell. Other paths, non-GET requests and other origins are not intercepted. Missing cache entries fall back to the network. Service worker updates bypass the worker's fetch handler and HTTP caching.

The worker does not call `skipWaiting` or claim existing clients. A fully downloaded update waits until the existing app pages close; it cannot change assets underneath an active match. Activation removes only older Otterpuck caches. Registration retries when connectivity returns and on subsequent launches. This follows the [service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

The first background download must finish while online. Device storage remains browser-managed; clearing website data or storage eviction can remove offline files. No persistence permission prompts are requested.

## Verification

201 tests pass, including interrupted installation, activation cleanup, request integrity settings, cached navigation, query-string asset lookup and bypass behavior. TypeScript, Biome and production build pass with existing CSS diagnostics.

In a fresh desktop browser origin, the app loaded online and installed the cache automatically. The local server was then stopped. Reload succeeded; Neon Rooftop, which had not previously been selected in that origin, loaded successfully. A twelve-player match advanced to 02:25 with a goal scored, and pause worked. No console warnings or errors were reported. A 600-sample offline match window measured 59.86 FPS, 18.0 ms p95 and 2.11 ms callback CPU at the default desktop viewport. This verifies local offline behavior, not sustained phone performance or iOS storage retention.

## Icon reference

The updated smooth mouthpiece is centered below the smile. The connection was based on the full [Cressi Corsica snorkel](https://store.cressi.com/products/corsica-snorkel) and its lower elbow/mouthpiece assembly, simplified for the game icon. Product reference photos are not shipped in the game.
