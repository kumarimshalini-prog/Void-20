# VOID-20

A 20-band equalizer, deep-bass toolkit and party-box front end that runs entirely in the browser. It shapes its own audio files **and** sound playing in other music apps, and it installs like a native app.

## What it does

- 20-band EQ plus 30 fine bands, custom parametric bands, preamp, anti-clip, bypass.
- Deep bass / ultra-deep / harmonics, speaker guard (high-pass, ceiling, soft clip), limiter.
- Live analyzer, bass analyzer, response curve, per-mode curves, presets library with export/import.
- APEX party mode: bass slam, drop, beat lights, wake lock, fullscreen, 50 bands.
- **Other apps:** capture the audio a tab or window is playing and run it through the whole chain.
- **Hand-off:** open audio files from other apps ("Open with"), drag and drop them, or use the playlist.

## Run it locally

It needs a real HTTP origin (a service worker cannot run from `file://`):

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static server works; there is no build step and no dependencies.

## Deploy to a static host

Publish the repository root as-is. Nothing needs compiling. GitHub Pages, Netlify and Cloudflare Pages all work.

Three host requirements:

| Requirement | Why | Already handled by |
| --- | --- | --- |
| `manifest.webmanifest` served as `application/manifest+json` (or `application/json`) | Some browsers refuse a manifest with a non-JSON type, which blocks install | `_headers` (Netlify / Cloudflare Pages); GitHub Pages does this correctly by itself |
| `sw.js` not cached long-term | Otherwise service-worker updates never reach returning users | `_headers` sets `Cache-Control: no-cache` |
| HTTPS | Service workers and install prompts require a secure context | The host's default |

`.nojekyll` is included so GitHub Pages serves the files verbatim without Jekyll processing.

If your host is neither Netlify nor Cloudflare Pages (an nginx box, S3, IIS), set the same two headers yourself; `_headers` is just a declaration of intent.

## Offline behaviour

After the first successful visit the service worker precaches the HTML, manifest, icons and font, so the app launches and runs with no network at all. Pages use network-first (updates land immediately when online) and fall back to the cached shell when the network is gone **or** answers with an error. Assets are served from cache and refreshed in the background. Bump `VER` in `sw.js` when shell files change; old caches are deleted on activate.

## Limits

- Capturing another app's audio uses `getDisplayMedia` and works in Chrome/Edge on desktop only. No browser can capture native phone apps, and iOS/Safari cannot capture at all; there, use file import, drag and drop, or "Open with" from the installed app.
- The equalizer settings, presets and playlist live in that browser's storage. They are per-device.
