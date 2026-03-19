# Conversion and Usability Boost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve conversion and usability by adding a post preview, a sticky mobile action bar, and visual company recognition.

**Architecture:** 
- Implement client-side logic for "Post Preview" in the submit view.
- Add responsive "Sticky Action Bar" for mobile ergonomics.
- Use CSS-only "Logo Placeholders" to enhance the directory aesthetic.
- Highlight "Direct Apply" opportunities.

**Tech Stack:** Vanilla JS, CSS.

---

### Task 1: CSS Placeholders & Direct Apply Badges

**Files:**
- Modify: `index.html` (CSS + `appendPostRow` + `doSearch` + `getStateAbbr` area)

- [ ] **Step 1: Add CSS for Placeholders and Direct Badges**
  Add to `<style>`:
  ```css
  .company-placeholder { width: 24px; height: 24px; background: #222; border: 1px solid #333; color: var(--brown); font-size: 10px; display: flex; align-items: center; justify-content: center; margin-right: 8px; flex-shrink: 0; }
  .direct-badge { color: var(--brown); border: 1px solid var(--brown); font-size: 9px; padding: 0 4px; margin-left: 6px; text-transform: uppercase; }
  .post-header-row { display: flex; align-items: center; margin-bottom: 4px; }
  ```

- [ ] **Step 2: Implement `renderPlaceholder` helper**
  Add after `getStateAbbr`:
  ```javascript
  function renderPlaceholder(name) {
    if (!name) return '';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const div = document.createElement('div');
    div.className = 'company-placeholder';
    div.textContent = initials;
    return div;
  }
  ```

- [ ] **Step 3: Update row rendering logic**
  In `appendPostRow` and `doSearch`, wrap the company name and placeholder in a `post-header-row`. Add the `[DIRECT]` chip if `isLikelyEmail(p.contact)`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add company placeholders and direct apply badges"
```

---

### Task 2: Sticky Mobile Action Bar

**Files:**
- Modify: `index.html` (CSS + HTML + JS)

- [ ] **Step 1: Add CSS for Mobile Action Bar**
  Add to the media query:
  ```css
  .mobile-action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--black); border-top: 1px solid #222; padding: 12px; display: none; z-index: 100; }
  @media (max-width: 600px) {
    .mobile-action-bar { display: flex; justify-content: center; }
    body { padding-bottom: 60px; } /* Space for the bar */
  }
  ```

- [ ] **Step 2: Add HTML structure**
  Add `<div class="mobile-action-bar"><button class="submit-btn" style="width:100%" id="stickyPostBtn">[+ post a job]</button></div>` after `#app`.

- [ ] **Step 3: Add event listener**
  In the initialization script, add a listener for `stickyPostBtn` to navigate to `/submit`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "ui: add sticky mobile action bar"
```

---

### Task 3: Submission Preview

**Files:**
- Modify: `index.html` (`renderSubmit` + CSS)

- [ ] **Step 1: Add CSS for Preview Section**
  ```css
  .preview-section { margin-top: 32px; border: 1px solid #222; background: #0a0a0a; padding: 20px; }
  .preview-label { color: var(--rust); font-size: 11px; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid #222; padding-bottom: 4px; }
  ```

- [ ] **Step 2: Update `renderSubmit` to include Preview button**
  Add a button `[PREVIEW_POST]` before the submit button. Add a `previewContainer` div at the bottom of the form.

- [ ] **Step 3: Implement Preview Logic**
  When the preview button is clicked, gather form values and call `appendPostRow` (or a simplified version) to render into the `previewContainer`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add job post preview to submission form"
```

---

### Task 4: Final Polish & Verification

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Run smoke tests**
  Run: `npm run test:smoke`

- [ ] **Step 2: Manual Visual Check**
  Verify the sticky bar on mobile breakpoints and the preview on the submit page.
