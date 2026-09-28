# IDG — sites

Two static sites (HTML + CSS + JS, no build step).

| Folder | What it is |
|---|---|
| `idg-engenharia/` | IDG Engenharia e Consultoria landing page: navy + orange, WebGL light stream, LS3D point-cloud scan, services tabs, quote builder, contact. |
| `elo-relay-v1/` | Frozen reference version ("Elo") with the same effect set. Do not edit. |

## Run locally

```bash
python -m http.server 5178
```

Then open `http://localhost:5178/idg-engenharia/`. Add `?nointro` to the URL to skip the preloader.

## Stack

- [three.js](https://threejs.org/) 0.160 via importmap (jsDelivr) for the light stream (`js/lightstream.js`) and the point cloud (`js/pointcloud.js`)
- GSAP 3 + ScrollTrigger, Lenis smooth scroll (CDN)
- Fonts: Figtree, Instrument Serif, Azeret Mono (Google Fonts)

## Before going live

- Swap the simplified logo glyph (`<symbol id="glyph">` in `index.html`) for the official IDG SVG logo.
- Wire the contact form to a backend or CRM (`contactForm()` in `js/main.js`, marked `TODO`).
- Review the service descriptions, segment copy and certificate captions with the IDG team.
- The "Indicadores" panel uses sample data and is labelled as illustrative.
