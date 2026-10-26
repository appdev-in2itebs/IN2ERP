---
name: in2it-brand-ui
description: In2IT EBS branded app and website UI - the AURA Premium UI design system (glossy, cinematic, Keka-style motion) locked to the In2IT EBS "Converged Intelligence" brand (navy/blue palette, Newsreader + IBM Plex Sans, official logo) with the In2IT post-login splash animations. Use for ANY In2IT EBS product, internal tool, dashboard, mobile app or website so every screen looks premium AND on-brand. Requires ../aura-design-system.
version: 1.0.0
author: In2IT EBS App Dev
---

# In2IT EBS brand UI (AURA + In2IT brand)

This skill = **AURA Premium UI** (all layout, components and motion rules) + **In2IT EBS brand overrides** (palette, fonts, logo, splash).
Read `../aura-design-system/SKILL.md` first, then this file. Where the two disagree, THIS file wins.

## Files
| File | What it is |
|---|---|
| `SKILL.md` | This file - brand rules on top of AURA |
| `brand/tokens.in2it.css` | Token overrides: load after `aura-design-system/foundations/tokens.css` |
| `brand/palette.json` | The eight official colours + RAG exceptions + font names |
| `brand/logo-navy.png`, `logo-paleblue.png`, `logo-lightblue.png` | Official raster logos (navy on light, pale-blue on navy, light-blue variant) |
| `brand/in2it-mark.svg` | Vector mark (four right triangles, geometry measured from the official file) for icons and loaders |
| `preview/splash-in2it.html` | Live post-login splash, self-contained (official logo embedded, open the file anywhere), built from the official PNG sliced per letter (pixel-exact), two variants (Converge, Wash), white and navy backgrounds |
| `preview/splash-in2it.template.html`, `preview/build-splash.py`, `preview/_pale_small.png` | Source template and build script (`python -I build-splash.py` rebuilds the page after editing the template or tokens) |
| `reference/README.md`, `reference/keka-login-reveal-frames.jpg` | The two Keka recordings the splash motion was taken from (frame sheet of the first) |

**The logo is never redrawn.** The splash cuts the official PNG into pieces (mark, each letter, tagline) with `background-position` using the slice table below, so what the user sees is the real logo file. Reuse the table on any platform (crop the PNG, or an SVG export of the logo, at these pixel boxes):

| Piece | `logo-navy.png` (1809x421) x0,y0 - x1,y1 | `logo-paleblue.png` (4092x1274) x0,y0 - x1,y1 |
|---|---|---|
| Mark | 20,20 - 401,400 | 0,194 - 883,1079 |
| I n 2 I T E B S (columns) | 483-523, 559-720, 741-902, 926-966, 987-1158, 1247-1400, 1424-1600, 1608-1788; rows 59-290 | 1070-1164, 1247-1621, 1667-2041, 2095-2190, 2235-2634, 2836-3192, 3247-3655, 3674-4091; rows 288-823 |
| Tagline | 483,337 - 1636,373 | 1071,931 - 3739,1017 |
| Mark shards | each cell of the 2x2 mark = triangle (cell top-left, cell top-right, cell bottom-right); clip-path per shard: TL `0 0, 50% 0, 50% 50%` · TR `50% 0, 100% 0, 100% 50%` · BL `0 50%, 50% 50%, 50% 100%` · BR `50% 50%, 100% 50%, 100% 100%` | same |

## 1. Palette (eight colours only - from the In2IT brand skill)
| Role in AURA | In2IT colour | Hex |
|---|---|---|
| Brand / header gradient / headlines / ink-900 | Navy | `#121E3B` |
| Primary CTA, accent word, links, section labels | Accent Blue | `#3F75A3` |
| Glossy tile highlight, secondary cards, second chart series | Light Blue | `#94B8D0` |
| Soft fills, icon backgrounds, "New" badges, third series | Pale Blue | `#A3CBE6` |
| Body copy, captions, footers | Muted Grey | `#5A6478` |
| Canvas, callouts, table banding | Off-White | `#F7F8FA` |
| Thin dividers only | Sand | `#C1BC9C` |
| Surfaces | White | `#FFFFFF` |

Rules: navy carries 60-70% of visual weight. **No orange, green, purple or red anywhere** except RAG status cells (`palette.json` → `rag`). AURA's orange CTA becomes the Accent Blue gradient; AURA's gold coin becomes Light/Pale Blue; the benefit line ("Up to 25% Off") is Accent Blue, not green. Need more chart series? Use another blue, never a new hue.

## 2. Typography
- Display / headlines: **Newsreader** bold; the one accent word *italic* in Accent Blue ("Good morning, *Elisaya*"). This replaces AURA's Fraunces.
- Everything else: **IBM Plex Sans** (replaces Inter). Body 15-17px, labels 13-14px, captions Muted Grey.
- The logo wordmark is an image, never typed text. Do not try to reproduce it with a font.
- Fallbacks: Cambria/Georgia for Newsreader, Calibri/Arial for IBM Plex Sans.

## 3. Logo
- Light surfaces: `brand/logo-navy.png`. Navy surfaces (header, navy splash, section dividers): `brand/logo-paleblue.png`.
- App header: logo 22px tall, top-left, 20px gutter, above the greeting. Web nav: 28px tall, left. Never recolour, stretch, crop or add effects; never place on busy imagery.
- The mark (four triangles) may be used alone as app icon, favicon, loader and the splash "shards". Geometry (measured from the file) is in `brand/in2it-mark.svg`: every cell of the 2x2 grid holds the triangle (cell top-left, cell top-right, cell bottom-right), viewBox 100: TL `0,0 50,0 50,50` · TR `50,0 100,0 100,50` · BL `0,50 50,50 50,100` · BR `50,50 100,50 100,100`.
- Corner mark on decks (two overlapping triangles) is a document rule, not an app rule.

## 4. Post-login / launch splash (In2IT version of AURA motion.md section 8)
Live: `preview/splash-in2it.html`. Minimum on-screen 3.6s (Converge) / 3.2s (Wash); exit only when data is ready.

**Variant A - Converge (default).** A one-to-one mapping of the Keka post-login reveal: Keka's lone "k" = the In2IT mark, Keka's
three sparks = the four shards of the mark, Keka's letters = the "In2IT EBS" letters.
```
t=0          The mark sits alone, centred (the whole logo is shifted right so the mark is at centre, like the lone "k").
t=300-540ms  Shards launch one by one (TL, TR, BL, BR) FROM the mark on curved orbits that loop around where the wordmark
             appears, spinning two full turns, each dragging a Light Blue trail (dash 120 units, 45% opacity, fades in the last 22%).
t=500ms      The logo slides left to re-centre (700ms expo-out) as the word grows - Keka's word re-centring.
t=520ms      Letters reveal left to right: opacity 0->1, translateX -6->0, scale .92->1, 380ms expo-out, 110ms stagger.
t=1780-2010  Shards land back exactly where they started and pop (scale 1 -> 1.22 -> 1, spring) - the mark re-forms.
t=2000ms     Pale Blue glow fades in behind the mark, then breathes (2.6s).
t=2100ms     "CONVERGED INTELLIGENCE" fades in.
t=2300ms     "Signing you in" + dots.
Hold         Only the glow breathes and the dots bounce.
Exit         Stack scales 1.12 + fades; app runs the AURA entrance choreography.
```
**Variant B - Wash.** Adapted from the Keka home-page loader (colour wave + petals), kept inside the palette:
```
t=100ms      Letters rise from a blur (translateY 14 -> 0, scale 1.08 -> 1, blur 8px -> 0, 900ms expo-out, 70ms stagger) while a tint
             masked to each real glyph sweeps Pale Blue -> Light Blue -> Accent Blue and fades to the navy pixels (1000ms).
t=300ms      Pale Blue glow blooms behind the mark position.
t=950-1310   Shards pop out of their outer corners (transform-origin at the right angle) TL, TR, BR, BL: scale 0 -> 1.2 -> 1, spring,
             120ms stagger; each pop sends a ripple ring (Light Blue, 2px, scale .2 -> 3.2, 800ms, fades).
t=1500ms     Tagline; t=1800 status line.
Hold (1.9s+) Glint: a soft white highlight masked to the wordmark + tagline pixels sweeps right-to-left every 2.6s.
             Shards shimmer in sequence (opacity 1 -> .7 -> 1 with brightness 1.25, 2.4s, 150ms stagger) - the petal flicker.
             A 2px Accent Blue line (34% of the tagline width) runs left-to-right under the tagline every 1.6s. Glow breathes.
```
Backgrounds: white (logo navy) for post-login; navy gradient (logo Pale Blue) for cold start. Reduced motion: letters and shards fade in 150ms, no flight, no shimmer.

## 5. Component adjustments (on top of AURA components.md)
- Header gradient: `#1A2B52 -> #121E3B -> #0B1328`; glass controls as AURA; the official pale-blue logo sits above the greeting.
- Bento cards: title Newsreader 600, benefit value Accent Blue 600, image as AURA. Section labels above titles: Accent Blue, IBM Plex Sans 12px uppercase, 0.06em.
- Glossy tiles: Accent Blue puck with Light Blue gloss (`--aura-gradient-tile`), Pale Blue halo.
- Primary CTA: Accent Blue gradient, white 18px semibold, same shape and motion as AURA.
- Badges: "New" = Pale Blue bg / Navy text. Success/Warning/Danger = RAG fills only.
- Tab bar, sheets, inputs, chips, lists, toasts: unchanged from AURA (colours flow from the tokens).
- Dashboards (HR/SaaS): stat tiles with Accent Blue overline, Newsreader values, deltas in RAG green/red; charts in `palette.json.chart_series_order`.
- Dark mode: navy canvas `#0B1328`, surfaces `#121E3B`, text white, accents Pale/Light Blue. Still only the eight colours.

## 6. Quality Gate (add to AURA's)
- [ ] Only the eight palette colours (+ RAG cells) appear. Grep for orange/green/purple/red hex values and remove them.
- [ ] Newsreader for display, IBM Plex Sans for everything else; Poppins only inside the logo.
- [ ] Official logo present on the header/nav at the right size and colour for its background; never modified.
- [ ] Splash plays after login and on cold start, minimum duration respected, reduced-motion fallback present.
- [ ] Footer/legal lines (web): "In2IT EBS | Converged Intelligence" left, "Confidential" right, Muted Grey.

## 7. How to use with an AI builder
```
Load ./aura-design-system/SKILL.md and then ./in2it-brand-ui/SKILL.md. Build <app/screen> for In2IT EBS.
Link aura-design-system/foundations/tokens.css then in2it-brand-ui/brand/tokens.in2it.css (or the equivalent native tokens).
Use the splash from in2it-brand-ui/preview/splash-in2it.html after login. Run both Quality Gates before finishing.
```
