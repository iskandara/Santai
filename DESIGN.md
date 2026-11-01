# SANTAI design direction

Written from the site as it stands. Edit any line that is not what you mean and the site should follow.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 2

Reading this as: a one-shirt-at-a-time clothing storefront for people who want to own the shirt, in a quiet monochrome editorial style, dial ENERGY 2 / RHYTHM 3 / MOTION 2.

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

- Opening piece fills the first screen, with the plate and the sell side by side. Nothing competes with the first shirt.
- Each piece uses a sticky plate beside scrolling facts, and the sides alternate. Spacing between pieces changes on purpose so the page does not read as a template.
- A photo strip appears under a piece only when the editor has added photos. A marquee of the CMS running text sits after the first piece.
- The page ends in the dark order band: a huge "Order", the ways to message, then shipping and returns.
- On phones the plate stacks above the facts and a slim order bar follows the reader until the real order button is in view.

## Motifs

- **Hold and turn.** Press and hold the plate and the page falls away to the shirt's own colour (or image) while it turns, with its sound if it has one. This is the signature gesture. A Flip button gives keyboard and touch users the same turn.
- **Grain.** A faint film grain (3.5% opacity) keeps flat paper tones from looking like a default screen.
- **Dot cursor** on desktop only. It becomes a ring over a plate, and steps aside over real controls.
- **Catalogue numbers.** "No. 01 / 03" on every piece.

## Motion

- One entrance per element: a short rise and fade, and shirt names reveal word by word.
- The marquee and the availability pulse loop. Both stop under the Pause control and under `prefers-reduced-motion`.
- The order button fills from below on hover. No parallax, no scroll hijacking.

## Buying

- Ordering is by message. WhatsApp if a number is set in the editor, otherwise Instagram with the message copied to the clipboard.
- The message is written for the visitor: shirt name, size and price. Sold-out shirts offer a restock question instead.
- A size must be chosen first. If the price is not set the page says "Message us for the price" and does not guess.

## Content rules

- No invented products, prices, fabric claims, quotes or taglines. Anything not entered in the editor is left out of the page.
- Copy is plain and short. No em dashes.
- Every control does something. Optional links without a destination are not shown.
