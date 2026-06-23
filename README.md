# Seasons and Ecliptic Simulator (Accessible HTML5)

An accessible HTML5 re-implementation of the NAAP *Seasons and Ecliptic Simulator*
(originally an Adobe Flash applet), rebuilt on the shared **KL-UNL foundation**
and meeting WCAG 2.1 AA.

## ⚠️ It must be served over HTTP — it will **not** run from a double-clicked `file://` path

The KL-UNL masthead (`foundation/kl-unl-masthead.js`) loads its title / Help /
About text with `fetch('foundation/contents.json')`. Browsers **block `fetch()`
over the `file://` protocol** (same-origin policy), so if you double-click
`index.html` the masthead (and therefore the title bar and Reset/Help/About
buttons) will be blank or broken. Served over HTTP the fetch succeeds and the
sim loads normally.

## How to run locally

Open a terminal **inside this `html5/` folder** and start any static server:

```sh
# Python 3
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve
#   (or)  npx http-server

# VS Code
#   Install the "Live Server" extension and "Open with Live Server"
```

Because you serve from **inside** `html5/`, the sim is at the server **root**, so
the URL is `http://localhost:8123/` — **not** `.../html5/index.html`. (Serving
from the root keeps the masthead's internal `../foundation/...` references
resolving correctly.)

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works — the
`file://` limitation only affects local double-clicking.

## What's in here

| Path | Purpose |
|------|---------|
| `index.html` | KL-UNL scaffold: `.app-shell` + `<kl-unl-masthead>` + panels |
| `foundation/` | Shared KL-UNL files, copied in unchanged (see note in CONVERSION_NOTES.md about a JSON repair) |
| `styles/styles.css` | Sim-specific styles only (foundation CSS is untouched) |
| `simulation.js` | All sim logic + the ported 3D celestial-sphere engine |
| `assets/shoredata.js` | Earth coastline point data, extracted verbatim from the original `GlobeComponent` |
| `assets/mathjax/tex-svg.js` | Local MathJax bundle (no CDN at runtime) |

No build step, no bundler, no framework, no CDN, no analytics. Everything is
local; the only runtime fetches are `foundation/contents.json` and the local
MathJax bundle.

## Browser support

Tested against current Chrome, Edge, Firefox and Safari (desktop and iOS).
Uses Pointer Events (mouse + touch share one path), `touch-action: none` on the
draggable canvases, standards-based CSS (no vendor-prefix-only declarations),
and MathJax's self-contained SVG output.
