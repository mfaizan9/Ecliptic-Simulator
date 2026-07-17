# Conversion Notes — Seasons and Ecliptic Simulator

## Behaviour model (one paragraph)

The simulator demonstrates the geometry of Earth's orbit and why seasons occur.
The **left panel** shows either the *orbit view* (Sun centred, the Earth globe
revolving on a white orbital ellipse) or the *celestial sphere view* (Earth
centred, the Sun projected onto the sky along the green ecliptic, tilted 23.4°
to the grey celestial equator). A draggable 3-D perspective rotates the scene; a
yellow ray arrow connects Sun and Earth. The **upper-right panel** shows the
Earth globe with its day/night terminator, latitude circles, polar axis and a
draggable red latitude circle / stick figure that sets the observer's latitude,
plus parallel sunlight rays (*view from side*) or the fully-lit disc (*view from
sun*). The **lower-right panel** shows, for that latitude and day, either the
*sunlight angle* (blue-sky/green-ground side view with beams at the Sun's
altitude) or the *sunbeam spread* (a grid with an elliptical beam footprint that
stretches as the Sun gets lower). The **timeline** sets the day of year (a month
slider) and can animate the year. Readouts: the Sun's declination and right
ascension, the observer's latitude, and the Sun's altitude.

## Source of truth

* **Behaviour** — the decompiled ActionScript (AS1) under `scripts/`
  (`CelestialSphere.as` + the eight `N CS *.as` engine modules, `GlobeComponent.as`,
  `Sun Icon.as`, `Ray Component.as`, `Sunbeam Component.as`,
  `Side View Sunbeam Component.as`, `Latitude Selector*.as`,
  `Modified Year Slider.as`, and the main controller in
  `DefineSprite_292_Symbol 1/frame_1/DoAction.as`).
* **Layout reference** — `Screenshot 2026-06-17 220935.png` (the running Flash sim).
* **Chrome / style** — the KL-UNL foundation files + the accessibility rules.

## Key constants & formulas (verbatim from the AS)

* Sun ecliptic parameter: `loc1 = 270 + daysSinceVE * 360 / 365`.
* `daysSinceVE = dayOfYear + 286`; `animateRate = 0.005` ms⁻¹.
* RA readout: `((-6 - az/15) mod 24)`, clamped to ≤ 23.94, formatted `toFixed(1)+"h"`.
* Dec readout: horizon altitude of `{dec:0, ra:12 + loc1/15}`, `toFixed(1)+"°"`.
* Sun's altitude: `90 - latitude + sunAlt`, folded above 90° with N/S direction.
* Earth obliquity baked into the globe rotation matrix: `cos 23.4° = 0.91706`,
  `sin 23.4° = 0.39875`.
* Orbit-view sphere sizes: Sun-centred `450` px diameter, Earth-centred `510`.
* Month boundaries `[0,31,59,90,120,151,181,212,243,273,304,334,365]`.

These were verified live: e.g. day 40 → "10 February", dec −14.3°, RA 21.6h,
altitude 65.7° at 10° N (matches the screenshot exactly); day 172 → "22 June",
dec 23.4°, altitude 76.6° at 10° N (= 90 − |10 − 23.4|).

## AS → HTML5 mapping

| ActionScript | HTML5 |
|---|---|
| `CelestialSphereClass` projection (`doA`/`doM`/`doB`, `WtoSz`/`CtoSz`, `parsePointInput`, `StoMH`, `MHtoC`, `pointToHorizon`) | Ported verbatim into the `CSphere` class in `simulation.js` |
| `8 CS Circles` great/small-circle drawing (orientation `doW`, projection `v`-matrix, front/back arc split) | `makeCircle` / `circDoW` / `circV` / `drawCircle`, sampling each circle and splitting front (z≥0) / back (z<0) |
| `9 CS Lines` sphere-clipped segments | `drawLine` (used for the globe polar axes) |
| `6 CS Shading` mask/region depth bands | Reproduced with canvas painter ordering (back circles → globe → front circles) rather than Flash depth swaps |
| `GlobeComponent` (water disc + shore polygons masking land + night side + axes; `_shoreData`) | `GlobeComponent.draw`; `_shoreData` extracted verbatim to `assets/shoredata.js` |
| `Sun Icon`, `Ray Component`, `Sunbeam Component`, `Side View Sunbeam Component`, `Latitude Selector`, `Modified Year Slider`, `CS Label` | Code-drawn leaf graphics + native controls |
| `Latitude Selector Stickfigure` (the observer) | **Reused exported bitmaps** `1.png`–`4.png` (the four state frames) copied to `assets/stickfigure/observer1-4.png` and drawn with `drawImage` at the AS position (radius-75 circle, rotation `90 + atan2(y,x)`). Frame 1 rests; frame 2 shows while dragging; 4/3 at the pole limits. |
| `onEnterFrame` + `getTimer()` | one `requestAnimationFrame` loop + `performance.now()`, same `animateRate` and elapsed-time logic |
| pointer drag (`_xmouse`, offset, snapping) | Pointer Events with the same inverse-projection math, **plus** a keyboard path |
| `FRadioButton/FCheckBox/FPushButton/SliderV3` components | native `<input>`/`<button>` accessible controls |

## contents.json entry

The sim's masthead entry (`eclipticsimulator`) **already existed** in the shared
`contents.json` with the correct title, version and full Help/About text
(verbatim NAAP wording). No new entry needed to be authored.

### ⚠️ Necessary repair to the shared `contents.json`

The shipped `foundation/contents.json` is **not valid JSON** — independent of
this sim. It contains, in *other* sims' entries:

* a literal newline inside the `ce_hc` help string (an unescaped control char), and
* unescaped `"` characters inside HTML attributes (e.g. `<a href="../venusphases">`)
  in the Phases-of-Venus entries.

`JSON.parse` (and therefore the masthead's `await response.json()`) rejects the
file, so the masthead fails for **every** sim, not just this one. Because the
masthead code may not be modified and the sim cannot load without it, the
**copied** `html5/foundation/contents.json` was normalised to valid JSON:
stray control characters inside strings were replaced with spaces and stray
`"` inside string values were escaped, then the file was re-serialised. All 108
entries and their text content are preserved; this sim's `eclipticsimulator`
entry is byte-for-content identical to the original. **Recommendation:** fix the
defect upstream in the shared foundation file; the `.js`/`.css` foundation files
are copied in completely unchanged.

## MathJax

The foundation ships no MathJax bundle (and there is no demo file), yet
`kl-unl.js` expects `window.MathJax`. Rule 8/8a require all math symbols to be
MathJax-typeset and right-clickable, and rule 5 forbids a runtime CDN. MathJax
**`tex-svg.js`** (self-contained SVG output, no external font files, context menu
intact) is therefore bundled locally at `assets/mathjax/tex-svg.js` and loaded
from `index.html`. All numeric readouts that carry units (declination, right
ascension, latitude, altitude) are typeset via MathJax; right-clicking any of
them opens MathJax's "Show Math As" menu.

## Visual-layout replication (Goal C)

Layout mirrors the screenshot: large orbit panel at left; upper-right Earth panel
with overlaid latitude readout and a `labels` checkbox; the two radio-group boxes
(*sunbeam spread / sunlight angle* and *view from sun / view from side*);
lower-right sunlight panel with its boxed altitude/latitude readout and N/S
direction labels; and the bottom month timeline with the day display and the
*start animation* button.

## Deviations from the original

* **Globe fills.** The original calls `setFills("Side View","Side View")` (and
  `("GlobeComponentWater","GlobeComponentWater")`) for the Earth-view globe.
  Because the visible screenshot clearly shows continents in every globe, and the
  continents are produced by the shared `_shoreData` coastlines masking the land
  fill, the port always renders land (tan `#cdb49c`) over water (blue `#c9d8f5`)
  using the exported fill colours, in all modes. This is faithful to the rendered
  screenshot and pedagogically clearer than a single flat fill.
* **Depth ordering.** Flash's per-clip `swapDepths` band system is replaced by an
  explicit canvas painter's-order pass (back circles/lines → globe → front
  circles/lines → markers/labels). Object front/back is decided by projected
  screen-z, matching the AS sign tests; pixel-exact band ordering is not
  reproduced but the visible result matches.
* **Canvas labels upright.** In-scene text labels (NCP, SCP, ecliptic, "to VE",
  RA/Dec values, …) are drawn screen-upright instead of using the AS
  `"absolute"` 3-D label orientation, which keeps them legible and is friendlier
  to zoom; their projected positions still track the geometry.
* **Keyboard equivalents added** for every drag (see ACCESSIBILITY.md). These are
  additions, not behaviour changes — both paths mutate the same state.
* **Orbit-view drag (original dual behaviour, restored).** Matching the original:
  pressing ON the draggable body (the earth in orbit view, the sun in the
  celestial-sphere view) drags it around its path (the "earth revolves" action,
  via the AS globe-drag / Sun-Icon-drag inverses); pressing empty space rotates
  the 3-D perspective (AS background-drag). Keyboard on the orbit canvas: arrows
  rotate the perspective, Shift+arrows step the earth around the orbit (the day is
  also fully settable from the timeline slider). (An interim build had removed the
  perspective rotation on one reviewer's request; a later review asked for it back,
  so the faithful dual behaviour is what ships.)
