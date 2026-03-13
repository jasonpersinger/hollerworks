# holler.works — Salamander Footer
**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Add a decorative full-width footer to the page featuring four pixel art salamanders in different colors. The salamanders are recolored variants of the existing `assets/logo.png` using CSS filters and `mix-blend-mode: screen`.

---

## Visual Design

- Four salamanders in a row, centered horizontally
- Order left to right: yellow, blue, orange, red
- Colors achieved via CSS `hue-rotate` + `saturate` filters on the original logo PNG
- `mix-blend-mode: screen` drops the solid black background of the PNG, leaving only the salamander pixels visible against the dark page
- No new image assets required

### Filter values

| Salamander | Filter |
|------------|--------|
| yellow | none (original) |
| blue | `hue-rotate(180deg) saturate(1.4)` |
| orange | `hue-rotate(315deg) saturate(1.6)` |
| red | `hue-rotate(300deg) saturate(1.8)` |

---

## Layout

- New `<footer>` element inserted between `#layout` div and `</body>`
- Full page width, `background: #0e0e0e` (matches page background, no visible seam)
- Salamanders centered with `display: flex; justify-content: center`
- Padding: `24px 0 12px`
- Gap between salamanders: `24px`
- Image size: `64px` wide, height auto
- `image-rendering: pixelated` to preserve pixel art crispness

---

## Implementation

Single file change: `index.html`

1. Add CSS for `.sal-footer` and `.sal-footer img` to the `<style>` block
2. Add `<footer class="sal-footer">` with four `<img>` tags before `</body>`

---

## Out of Scope

- Animation or hover effects
- Responsive size changes
- Any new image assets
