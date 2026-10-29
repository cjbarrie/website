# Design system

Small, white and quiet. All values are tokens at the top of `assets/style.css`.

## Colour
- **White page** (`--c-bg`) with warm neutral greys for text: `--c-ink` (primary), `--c-ink-2` (secondary), `--c-ink-3` (metadata).
- **Hairlines** (`--c-line`) separate sections. There are no boxes, cards or shadows.
- **One accent**, the saffron "seed" (`--c-accent`). It appears only in the brand mark, the active nav dot, hover states. Never use it for large areas.
- Dark mode swaps the neutrals and keeps the accent.

## Type
- **Inter** for interface and body text. **Newsreader** (serif) for the headline, section titles and journal names only.
- Scale: 12 / 13 / 15 / 17 / 22 / 44 px. Body text is 15px, metadata 13px.
- Two weights only: 400 and 500.

## Research-area pills
- Each paper carries one or two research areas in its `.bib` (`topics = {ai, methods}`). The areas, their labels and colours live in `content/topics.json`.
- Six muted colours, one per area, each with a lighter dark-mode version. Pills are always tinted (about 9% of the colour) with the colour as text and a small dot; they are never solid.
- The pill row above Publications filters both Publications and Working papers. Clicking a pill on a paper, or an area under Research, applies the same filter. Clicking the active pill again clears it.

## Space and shape
- 4px grid (`--s-1` … `--s-9`). Sections are 48px apart.
- Radius 6px on the photo and the search field; pills are fully rounded.

## Motion
- 240ms with one easing curve (`--ease`). Colour changes on hover, nothing moves.
- The hero simulation is the only animation. It sits directly on the page with no frame, fades out at its edges, and stops when it's off screen or the visitor has reduced motion turned on.
- The hero is a Schelling segregation model (`assets/schelling.js`) on a grid of small squares, one colour per research area, sized by paper count. Solid squares are content with their neighbours, outlined ones are restless. Each step of about a second, a few restless squares glide a short way to a spot that suits them, and tolerance rises until the board sorts into patches; then it holds and the colours cross-fade back to a mix. There are no labels or readouts. When a research-area filter is active, that area's squares stay bright and the rest fade. The older network animation is still in `site.js` and comes back if `data-sim` is removed from the hero canvas.
- Hidden game: keep scrolling past the bottom of the page (or open `#play`) and the Grand Theory Prix opens full screen over the blurred page (`assets/game.js` for the overlay, `assets/kart.js` for the race). It is an arcade kart race with seven social scientists as drivers, items named after their concepts, and touch controls on phones and tablets. While a race runs, the page behind is hidden rather than blurred, to keep the frame rate up.

## Brand mark
Four nodes, one of them the saffron seed (`assets/mark.svg`). It's used at 20px in the sidebar and as the favicon.
