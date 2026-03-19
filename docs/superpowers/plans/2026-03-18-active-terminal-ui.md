# Active Terminal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the holler.works UI to feel more like a living, moderated "Active Terminal" while improving trust and regional discovery.

**Architecture:** 
- Implement client-side aggregation for category counts (initially on load, potentially cached).
- Add "System Pulse" and "Human Reviewed" visual indicators to reinforce moderation.
- Introduce "Regional Chips" for faster geographic scanning in the main feed.
- Refine existing CSS to tighten the terminal aesthetic (borders, spacing, typography).

**Tech Stack:** Vanilla JS, CSS, Firestore, Algolia.

---

### Task 1: Category Counts & Sidebar Refinement

**Files:**
- Modify: `index.html` (CSS + `renderBoard` + `updateRailActive`)

- [ ] **Step 1: Add CSS for category counts**
  Add `.rail-link span { color: var(--brown); font-size: 10px; margin-left: 6px; opacity: 0.8; }` to the `<style>` block.

- [ ] **Step 2: Implement category count fetching**
  In the `renderBoard` function, before rendering the sidebar links, perform a query to count approved posts per category. 
  *Optimization:* Since we already fetch posts for the board, we can either use a separate `getDocs` on approved posts (limited fields) or rely on a new `categoryCounts` field if we were to implement a cloud function (let's stick to client-side for now for simplicity, or use Algolia facets if available).
  *Preferred:* Use Algolia's `search` with `facets: ['category']` and `hitsPerPage: 0` to get counts for ALL categories regardless of current filter.

- [ ] **Step 3: Update sidebar rendering**
  Update the `rail-link` buttons in `index.html` to include a `<span>` for the count.
  ```javascript
  // Example update in the static HTML or dynamic rendering logic
  <button class="rail-link" data-cat="Software & Dev">dev <span id="count-dev">(0)</span></button>
  ```

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "feat: add dynamic category counts to sidebar"
```

---

### Task 2: System Pulse & Header Snapshot

**Files:**
- Modify: `index.html` (CSS + `renderBoard`)

- [ ] **Step 1: Add "System Pulse" CSS**
  Add `.pulse` animation and `.system-status` styling.
  ```css
  .pulse { display: inline-block; width: 6px; height: 6px; background: var(--brown); border-radius: 50%; margin-right: 8px; animation: pulse-blink 2s infinite; }
  @keyframes pulse-blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
  .system-status { font-size: 10px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #1e1e1e; padding-bottom: 6px; letter-spacing: 0.05em; }
  ```

- [ ] **Step 2: Inject System Status into Board**
  In `renderBoard`, add the status line at the very top of the content area.
  ```html
  <div class="system-status"><span class="pulse"></span>SYSTEM_PULSE: OK // LAST_SYNC: [Current Time]</div>
  ```

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "ui: add system pulse indicator to board header"
```

---

### Task 3: Regional Chips & Human-Reviewed Badges

**Files:**
- Modify: `index.html` (`appendPostRow` + `doSearch`)

- [ ] **Step 1: Add CSS for Regional Chips**
  ```css
  .region-chip { color: var(--rust); font-size: 10px; font-weight: bold; margin-right: 8px; border: 1px solid #333; padding: 0 4px; }
  .reviewed-badge { color: var(--brown); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 8px; opacity: 0.7; }
  ```

- [ ] **Step 2: Update `appendPostRow` for Regional Chips**
  Prepend the regional code to the title.
  ```javascript
  const regCode = p.locationState ? `[${p.locationState.slice(0,2).toUpperCase()}]` : '';
  title.innerHTML = `<span class="region-chip">${regCode}</span>${escHtml(p.title)}`;
  ```

- [ ] **Step 3: Add "Human Reviewed" badge**
  Append the badge to the `post-meta` or next to the title.
  ```javascript
  const reviewed = document.createElement('span');
  reviewed.className = 'reviewed-badge';
  reviewed.textContent = '// HUMAN_REVIEWED: OK';
  meta.appendChild(reviewed);
  ```

- [ ] **Step 4: Update `doSearch` to match**
  Ensure Algolia search results also show the new chips and badges.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat: add regional chips and human-reviewed badges to post rows"
```

---

### Task 4: UI Polish & Spacing (80% Approach 1)

**Files:**
- Modify: `index.html` (CSS)

- [ ] **Step 1: Tighten layout spacing**
  Reduce padding in `#rail` and `#content`. Adjust `post-row` padding for a denser "terminal" feel.
  ```css
  #rail { padding: 18px 14px; }
  #content { padding: 24px 30px; }
  .post-row { padding: 10px 8px; }
  ```

- [ ] **Step 2: Refine borders**
  Use slightly brighter borders (`#222`) for the `mini-panel` and `trust-panel` to make the "grid" feel more intentional.

- [ ] **Step 3: Final Verification**
  Run smoke tests to ensure no regressions in navigation or filtering.
  Run: `npm run test:smoke`

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "ui: polish terminal aesthetics and spacing"
```
