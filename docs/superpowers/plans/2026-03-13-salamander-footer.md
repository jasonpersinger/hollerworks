# Salamander Footer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width footer to index.html displaying four pixel art salamanders (yellow, blue, orange, red) across the bottom of every page.

**Architecture:** Single file change to `index.html` — add CSS in the `<style>` block and a `<footer>` element before `</body>`. Color variants are achieved with CSS `hue-rotate` + `saturate` filters. `mix-blend-mode: screen` makes the PNG's solid black background disappear against the dark page.

**Tech Stack:** Vanilla HTML/CSS, no build step, no dependencies.

---

## Chunk 1: Salamander Footer

**Files:**
- Modify: `index.html:131` (end of `<style>` block, before `</style>`)
- Modify: `index.html:180` (after closing `</div>` of `#app`, before `<script type="module">`)

**Spec:** `docs/superpowers/specs/2026-03-13-salamander-footer-design.md`

---

- [ ] **Step 1: Add footer CSS**

Inside `index.html`, find the closing `</style>` tag (line 131) and insert before it:

```css
    .sal-footer {
      width: 100%;
      background: var(--black);
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 24px 0 12px;
    }
    .sal-footer img {
      width: 64px;
      height: auto;
      display: block;
      image-rendering: pixelated;
      mix-blend-mode: screen;
    }
    .sal-footer .s-blue   { filter: hue-rotate(180deg) saturate(1.4); }
    .sal-footer .s-orange { filter: hue-rotate(315deg) saturate(1.6); }
    .sal-footer .s-red    { filter: hue-rotate(300deg) saturate(1.8); }
```

- [ ] **Step 2: Add footer HTML**

Find the closing `</div>` that closes `#app` (line ~180) and insert after it, before the `<script type="module">` tag:

```html
  <footer class="sal-footer">
    <img src="assets/logo.png" alt="">
    <img src="assets/logo.png" alt="" class="s-blue">
    <img src="assets/logo.png" alt="" class="s-orange">
    <img src="assets/logo.png" alt="" class="s-red">
  </footer>
```

- [ ] **Step 3: Verify visually**

Open `index.html` in a browser (or check the Netlify preview). Confirm:
- Four salamanders appear across the bottom of the page
- Order left to right: yellow, blue, orange, red
- Black PNG background is invisible against the page (blend mode working)
- Colors are clearly distinct from each other

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add salamander footer with four color variants"
```
