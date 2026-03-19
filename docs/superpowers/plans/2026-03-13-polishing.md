# Polishing -- Label Rename and About Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename need/offer UI labels to "have a job"/"need a job" and add an About page accessible from the rail.

**Architecture:** Single file change to `index.html` throughout. Label changes are pure text swaps. The About page adds one CSS class, one HTML button in the rail, one route case in `getRoute()`, one render dispatch in `render()`, and one `renderAbout()` function.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no dependencies.

---

## Chunk 1: Label Rename

**Files:**
- Modify: `index.html` (lines 150-151, 611-612, 663-664, 753-754, 872-873, 1358-1359)

**Spec:** `docs/superpowers/specs/2026-03-13-polishing-design.md`

---

- [ ] **Step 1: Update rail filter buttons (line 150-151)**

Find:
```html
        <button class="rail-link" data-filter="need">[need]</button>
        <button class="rail-link" data-filter="offer">[offer]</button>
```

Replace with:
```html
        <button class="rail-link" data-filter="need">[have a job]</button>
        <button class="rail-link" data-filter="offer">[need a job]</button>
```

- [ ] **Step 2: Update search results badges (line ~611-612)**

Find:
```js
          badge.className = `badge badge-${hit.type === 'need' ? 'need' : 'offer'}`;
          badge.textContent = hit.type === 'need' ? 'need' : 'offer';
```

Replace with:
```js
          badge.className = `badge badge-${hit.type === 'need' ? 'need' : 'offer'}`;
          badge.textContent = hit.type === 'need' ? 'have a job' : 'need a job';
```

- [ ] **Step 3: Update board view badges (line ~663-664)**

Find:
```js
      badge.className = `badge badge-${p.type === 'need' ? 'need' : 'offer'}`;
      badge.textContent = p.type === 'need' ? 'need' : 'offer';
```

Replace with:
```js
      badge.className = `badge badge-${p.type === 'need' ? 'need' : 'offer'}`;
      badge.textContent = p.type === 'need' ? 'have a job' : 'need a job';
```

- [ ] **Step 4: Update post detail badges (line ~753-754)**

Find:
```js
            badge.className = `badge badge-${value === 'need' ? 'need' : 'offer'}`;
            badge.textContent = value === 'need' ? 'need' : 'offer';
```

Replace with:
```js
            badge.className = `badge badge-${value === 'need' ? 'need' : 'offer'}`;
            badge.textContent = value === 'need' ? 'have a job' : 'need a job';
```

- [ ] **Step 5: Update submit form radio labels (line ~872-873)**

Find:
```html
            <label class="radio-label"><input type="radio" name="type" value="need" required> need</label>
            <label class="radio-label"><input type="radio" name="type" value="offer"> offer</label>
```

Replace with:
```html
            <label class="radio-label"><input type="radio" name="type" value="need" required> have a job</label>
            <label class="radio-label"><input type="radio" name="type" value="offer"> need a job</label>
```

- [ ] **Step 6: Update admin queue badges (line ~1358-1359)**

Find:
```js
          badge.className = `badge badge-${p.type === 'need' ? 'need' : 'offer'}`;
          badge.textContent = p.type === 'need' ? 'need' : 'offer';
```

Replace with:
```js
          badge.className = `badge badge-${p.type === 'need' ? 'need' : 'offer'}`;
          badge.textContent = p.type === 'need' ? 'have a job' : 'need a job';
```

- [ ] **Step 7: Verify visually**

Open the site. Confirm:
- Rail shows `[have a job]` and `[need a job]` filter buttons
- Post badges on listings show the new labels
- Submit form shows new radio labels
- Admin queue shows new badge labels
- Filtering by need/offer still works (data values unchanged)

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: rename need/offer labels to have a job/need a job"
```

---

## Chunk 2: About Page

**Files:**
- Modify: `index.html` (CSS block, rail HTML, getRoute(), render(), new renderAbout() function)

---

- [ ] **Step 1: Add CSS**

Find `.site-footer { ... }` (line ~126) and insert before it:

```css
    .about-body { color: var(--gray); font-size: 13px; line-height: 1.8; margin-bottom: 14px; max-width: 560px; }
```

- [ ] **Step 2: Add About link to rail HTML**

Find (line ~178):
```html
      </div>
      <button class="post-btn" id="postBtn">[+ post]</button>
```

Replace with:
```html
      </div>
      <button class="rail-link" onclick="navigate('/about')">[about]</button>
      <button class="post-btn" id="postBtn">[+ post]</button>
```

- [ ] **Step 3: Add route to getRoute()**

Find (line ~247-248):
```js
      if (path === '/submit') return { view: 'submit' };
      if (path === '/admin')  return { view: 'admin' };
```

Replace with:
```js
      if (path === '/submit') return { view: 'submit' };
      if (path === '/admin')  return { view: 'admin' };
      if (path === '/about')  return { view: 'about' };
```

- [ ] **Step 4: Add render dispatch**

Find (line ~291-292):
```js
      if (route.view === 'submit') renderSubmit(content);
      if (route.view === 'admin')  await renderAdmin(content);
```

Replace with:
```js
      if (route.view === 'submit') renderSubmit(content);
      if (route.view === 'admin')  await renderAdmin(content);
      if (route.view === 'about')  renderAbout(content);
```

- [ ] **Step 5: Add renderAbout() function**

Place this function near the other render functions (before the render() function):

```js
    function renderAbout(el) {
      el.textContent = '';

      const heading = document.createElement('div');
      heading.className = 'page-heading';
      heading.textContent = '[about]';
      el.appendChild(heading);

      const paras = [
        'holler.works is a community job and skills board built for Appalachia.',
        'No recruiter middlemen. No ghost posts. Compensation is required on every listing. Posts are moderated before they go live.',
        'Post for free. If you want more visibility, featured placement runs $10 for 7 days. Urgent badge is $5.',
      ];
      paras.forEach(text => {
        const p = document.createElement('p');
        p.className = 'about-body';
        p.textContent = text;
        el.appendChild(p);
      });

      const tagline = document.createElement('div');
      tagline.className = 'rail-tagline';
      tagline.style.marginTop = '28px';
      ['STAY.', 'BUILD.'].forEach(line => {
        const d = document.createElement('div');
        d.className = 'tagline-line';
        d.textContent = line;
        tagline.appendChild(d);
      });
      el.appendChild(tagline);
    }
```

- [ ] **Step 6: Verify visually**

Navigate to `#/about`. Confirm:
- Page heading shows `[about]`
- Three paragraphs of body text in gray
- STAY. / BUILD. stacked in rust below
- `[about]` button appears in rail between socials and `[+ post]`
- Clicking `[about]` navigates to the page
- Browser back button returns to previous view

- [ ] **Step 7: Commit and push**

```bash
git add index.html
git commit -m "feat: add about page and rail link"
git push
```
