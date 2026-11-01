# SANTAI design direction

Written from the site as it stands (October 2026). Everything here describes choices already in the code, so treat it as a draft to edit: change any line that is not what you mean, and the site should follow.

Dial: ENERGY 2 / RHYTHM 1 / MOTION 2

Reading this as: a one-shirt-at-a-time clothing lookbook for people who follow the label, in a quiet monochrome editorial style, dial ENERGY 2 / RHYTHM 1 / MOTION 2.

## Identity

SANTAI shows one piece at a time, full height, and lets you turn it over in your hands. The page is a stage for the garment, so the interface stays out of its way.

## Palette

| Role | Value | Reason |
|---|---|---|
| Paper | `#f5f5f0` | A warm off-white reads as paper and print, not as a screen. |
| Ink | `#0a0a0a` | Near-black, never pure black, for the same reason. |
| Secondary text | `#5c5c58` | Darkest grey that still looks quiet. 6.1:1 on paper, so it passes WCAG AA. |
| Status red / amber | `#e74c3c` / `#e67e22` | Only on the availability dot, for Sold Out and Running Low. This is the one accent, used where it carries meaning. |

Theme: light only. The garment photos are shot on light grounds and the brand is paper-like. No toggle is shipped, so there is no second mode to keep working.

## Type

- **Bebas Neue**, wide tracking (about .38em), for the wordmark and product names. A tall condensed capital with generous spacing reads as a label stitched into a collar.
- **Cormorant Garamond** for product descriptions and the size chart values. A literary serif gives the copy a human voice against the capitals.
- **Courier Prime** for small utility text: availability, counters, ticker, controls. A typewriter face is the "tag on the garment" voice.
- Small utility text is uppercase with wide tracking and never below 10px.

## Motifs

- **Hold and rotate.** Pressing and holding the shirt turns it, reveals its details and plays its sound. It is the signature gesture of the site. Details and Flip buttons give the same content to keyboard and touch users.
- **Grain.** A very faint film grain (3% opacity) sits over the page, so flat paper tones do not look like a default screen.
- **Custom dot cursor** on desktop only. It turns into a ring over the shirt to say "you can drag this". It steps aside over real controls so the system pointer shows.

## Motion

- Entry fade on load, one slide transition between pieces, one ticker, one availability blink.
- Looping motion (ticker, blink, hint) has a Pause control and stops under `prefers-reduced-motion`.
- No parallax, no scroll choreography. Motion either answers a gesture or shows status.

## Rhythm

One piece per screen, always the same composition. Uniform on purpose: sameness lets the garments differ.

## Content rules

- No invented products, numbers, quotes or taglines. If the collection cannot be loaded, say so.
- Copy is plain and short. No em dashes.
- Every control does something. If an optional link has no destination, it is not shown.
