# SANTAI design direction

Written from the site as it stands. Edit any line that is not what you mean and the site should follow.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 3

Reading this as: a one-shirt-at-a-time clothing storefront for people who want to own the shirt, in a quiet monochrome editorial style, dial ENERGY 2 / RHYTHM 3 / MOTION 3.

## Idea

SANTAI sells shirts as **memorabilia**: each one is catalogued like an object in an archive. A catalogue number, a name set large, a plate that holds the shirt, and a short museum-label of facts. The page exists to make one shirt feel worth owning, then make ordering it take seconds.

## Palette

| Role | Value | Reason |
|---|---|---|
| Paper | `#f5f5f0` | Warm off-white reads as print, not as a screen. |
| Plate | `#e8e4d9` | A darker paper the shirt photo sits on, so a white shirt still shows its edges. |
| Ink | `#0a0a0a` | Near-black, never pure black. |
| Secondary text | `#5c5c58` | Darkest grey that still looks quiet. 6.1:1 on paper. |
| Band | `#0d0d0c` with `#b8b8b0` text | The order section is the one dark room on the page, so the end of the scroll feels like a decision. |
| Status | `#0a0a0a` / `#b4530a` / `#b3261e` | Only on the availability dot, with the words beside it. The one accent, used where it carries meaning. |

Theme: light, with one dark band. The garment photos are shot on light grounds and the brand is paper-like.

## Type

- **Bebas Neue** for the wordmark, shirt names, prices and size buttons. Names are set very large and tight; the wordmark is small and widely tracked, like a label.
- **Cormorant Garamond** italic for the story. A literary serif gives the one piece of real copy a human voice.
- **Courier Prime** for labels, specs, controls and the catalogue numbers. The typewriter voice of a tag on the garment.
- Small utility text is uppercase, widely tracked, never below 11px.

## Layout and rhythm

- The first screen holds only the deer, grazing in a small meadow. No header, no words.
- Scrolling sends the deer running down the page. It keeps pace with the scroll, swings across the page, and lands on the next shirt. Scrolling up sends it back.
- Each shirt fills one screen, large, on no plate. No name, number or price on the page; the cursor reads "Details" over a shirt, and a click opens the details panel (photos, price, story, sizes, order).
- Behind each shirt, the painting it comes from fades in softly while that shirt is in the middle of the screen (at most 32% strength), and fades out as you leave it.
- The footer is the painted hills: SANTAI and "shirt & memorabilia" with links to each shirt, the size chart and How to order, and the name set huge where the land meets the page.

## Motifs

- **The deer.** The painted deer from Deer Comes the Sun, cut out and rigged: the painting gives the body, head and tail; drawn legs in the painting's own texture let it stand, graze and run in bounds. Each shirt sets how it lands, in the editor:
  - **Into the print** (Deer Comes the Sun): it leaps, turns into the painting's exact pose over the printed deer, and fades into it.
  - **Herd** (How Deer Is Your Love): it slips behind the shirt, cut out by the photo's own outline, while the three deer of that painting come in from the screen edges, shrink to print size and settle onto their places in the oval.
  - **Stand**: it stands on the shirt.
- **Hold and turn.** Press and hold a shirt and the page falls away to the shirt's own colour while it turns. A quick click opens the details instead.
- **Grain.** A faint film grain (3.5% opacity) keeps flat paper tones from looking like a default screen.
- **Dot cursor** on desktop only. Over a shirt it becomes a dark disc reading "Details".

## Motion

- The deer is the one orchestrated motion. Everything else enters once: a short rise and fade, and shirt names reveal word by word.
- Under `prefers-reduced-motion` the deer does not run: it appears at the nearest stop, still.
- The grazing loop and the availability pulse stop under `prefers-reduced-motion`.
- The order button fills from below on hover. No parallax, no scroll hijacking.

## Buying

- Ordering is by message. WhatsApp if a number is set in the editor, otherwise Instagram with the message copied to the clipboard.
- The message is written for the visitor: shirt name, size and price. Sold-out shirts offer a restock question instead.
- A size must be chosen first. If the price is not set the page says "Message us for the price" and does not guess.

## Content rules

- No invented products, prices, fabric claims, quotes or taglines. Anything not entered in the editor is left out of the page.
- Copy is plain and short. No em dashes.
- Every control does something. Optional links without a destination are not shown.
