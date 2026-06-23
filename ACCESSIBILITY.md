# Accessibility Notes — Seasons and Ecliptic Simulator

Target: **WCAG 2.1 AA** (AAA where reasonable). Human screen-reader QA with NVDA
(Windows) and VoiceOver (macOS/iOS) is still required before sign-off — the notes
below describe what was built in.

## Structure & landmarks

* Single `<h1>` is rendered by the `<kl-unl-masthead>` component (the sim adds no
  competing `h1`). Each panel has its own `<h2>` (visually hidden where the panel
  is self-evident).
* `<main class="sim-layout">` wraps the panels; each panel is a `<section>` with
  `aria-labelledby`.
* `<html lang="en">`.

## Text alternatives for the canvases (1.1.1)

The three `<canvas>` elements are the *visual* layer only; the accessibility layer
is HTML:

* Each canvas has `aria-describedby` pointing at its on-screen instruction text
  and a live region.
* A polite `aria-live` status region (`#status-live`) continuously describes what
  the diagram shows, units included, e.g.
  *"Day 10 February. Sun's declination −14.3 degrees, right ascension 21.6 hours.
  Observer latitude 10.0 degrees north. Sun's altitude 65.7 degrees toward the
  south."* Per-canvas live regions (`#orbit-live`, `#earth-live`) announce the
  result of keyboard interactions.

## Color & contrast (1.4.x)

* UI text and controls use the KL-UNL palette variables and meet ≥ 4.5:1.
* **No state is encoded by colour alone.** The Sun's direction is given as the
  word *N*/*S* and spoken as "north"/"south"; latitude carries an explicit
  "N"/"S"; physically-meaningful colours (blue ocean, green ground, the
  red/blue polar axis) are always accompanied by text or numeric readouts.

## Keyboard operability (2.1.1, 2.1.2, 2.4.7)

Everything is reachable and operable by keyboard, with the foundation's visible
`:focus-visible` ring. No keyboard traps; the masthead dialog manages its own
focus.

| Control | Keys |
|---|---|
| **Day of year** (`#daySlider`, native range, month timeline) | ←/↓ −1 day, →/↑ +1, Home/End = Jan 1 / Dec 31; `aria-valuetext` speaks "Day of year, 10 February" |
| **Observer latitude** (`#latSlider`, native range −90…90) | arrows ±0.1°, Home/End = ±90°; `aria-valuetext` = "Observer latitude 10.0 degrees north" |
| **Earth on its orbit** (`#orbitCanvas`, `role="application"`) | ←/↓ −1 day, →/↑ +1 day, PageUp/PageDown ±7 days; moves the earth around its orbital path (the plane stays fixed); result announced via live region |
| **Latitude on the globe** (`#earthCanvas`, `role="application"`) | ↑/→ +1° (Shift +10°), ↓/← −1°; mirrors the red-latitude-circle / stick-figure drag |
| Radios, checkboxes, *start animation*, Reset/Help/About | native controls / the masthead component |

Every slider is a **native `<input type="range">`** (so it gets arrow + Page +
Home/End for free), with a real `<label>`, a sensible `step`, and a
units-complete `aria-valuetext`. Tab always moves away cleanly; the canvas
keyboard handlers `preventDefault` only on the arrow keys they consume.

## Pointer / touch (2.5, plus iOS)

Pointer Events drive both mouse and touch on one path; the draggable canvases set
`touch-action: none` so dragging doesn't scroll the page. Pointer coordinates are
mapped back through the live CSS scale so hit-testing and the drag math operate in
the original Flash stage coordinates at any display size. No hover-only
affordances; interactive targets meet the ≥ 44 px minimum from the KL-UNL control
styles.

## Always speak units with numbers (supervisor requirement)

Every value with a unit is announced with its quantity **and** unit, never a bare
number:

* Readouts (declination, right ascension, latitude, altitude) are MathJax-typeset
  on screen *and* mirrored into the live-region narration with full words —
  "degrees", "hours", "north"/"south".
* Slider `aria-valuetext` includes the quantity name and unit.

## Equations / math (1.1.1, 4.1.2)

All numeric readouts carrying math notation (the `°` and `h` units, the minus
sign) are typeset with **MathJax** via the foundation's `kl-unl.js` pipeline and a
locally-bundled `tex-svg.js`. Right-clicking any readout opens MathJax's own
context menu ("Show Math As → TeX / MathML"); the menu is not disabled or
overridden. MathJax also exposes the math to assistive technology, and the same
units-complete description is duplicated in the live region for screen readers.

No math is painted onto the `<canvas>` (which could not expose the MathJax menu);
the canvases carry only diagram geometry, with their meaning provided in the HTML
live regions.

## Timing / motion (2.2.2, 2.3.3)

The only motion is the user-initiated *start animation* (the year playing
forward); it has an explicit **stop** toggle, so it satisfies 2.2.2. Nothing
auto-plays and nothing flashes more than 3×/second. (Because the animation is
opt-in and stoppable, `prefers-reduced-motion` users are not exposed to
unexpected motion; the diagram's end state for any day is always reachable
instantly via the day slider.)

## Zoom & reflow (1.4.4, 1.4.10)

Body text is ≥ 1.125 rem and everything is sized in rem/em, so it tracks the
browser font setting. The layout uses CSS grid/flex with relative units and
reflows to a single stacked column at narrow / 200 %-zoom widths without clipping
or horizontal scrolling. The canvases keep their original internal coordinate
system and are scaled by CSS (`width:100%; height:auto`), so they shrink to fit
without distorting the ported physics.

## Items needing human QA

* Confirm NVDA and VoiceOver read each control as *name + value + unit* and that
  the live region is not too chatty during animation (announcements are
  throttled to meaningful state changes / commit, not every animation tick).
* Confirm the canvas `role="application"` arrow-key handlers feel natural with a
  screen reader's own arrow-key navigation.
* Confirm MathJax's context menu and assistive MathML behave on Safari/VoiceOver.
