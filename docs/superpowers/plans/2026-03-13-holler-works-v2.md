# holler.works v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand holler.works beyond tech into all skilled work, add full-text search via Algolia, featured/urgent monetization via Stripe Payment Links, auto-expiry, deep-linked filters, admin improvements, and refreshed identity.

**Architecture:** Single `index.html` SPA (no build step). All frontend changes go directly into `index.html`. Backend changes live in `functions/index.js`. No frameworks — vanilla JS, Firebase v9 CDN, Algolia search client CDN.

**Tech Stack:** Vanilla JS / HTML / CSS, Firebase Firestore v9 (CDN), Firebase Cloud Functions v2 (Node 20), Firebase Trigger Email extension, Algolia JS Search Client (CDN), Stripe Payment Links (no code — just URLs).

**Spec:** `docs/superpowers/specs/2026-03-13-holler-works-v2-design.md`

---

## File Map

| File | Changes |
|------|---------|
| `index.html` | All frontend: identity, routing, board, admin, submit, search |
| `firestore.rules` | Relax update/delete rules; add read: if true |
| `functions/index.js` | Add onPostStatusChange + dailyExpiry; refactor onNewPost to use env var |
| `functions/package.json` | Add `algoliasearch` dependency |
| `functions/.env` | New file: ADMIN_EMAIL, ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY |

---

## Chunk 1: Foundation

### Task 1: Firestore Rules Update

**Files:**
- Modify: `firestore.rules`

- [x] **Step 1: Update rules to allow open read/update/delete**

Replace the contents of `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.resource.data.keys().hasAll([
                        "type","title","category","location",
                        "compensation","contact","status","createdAt"
                      ])
                    && request.resource.data.status == "pending"
                    && request.resource.data.type in ["need","offer"]
                    && request.resource.data.title.size() <= 80
                    && (!request.resource.data.keys().hasAll(["description"])
                        || request.resource.data.description.size() <= 500);
      allow update: if true;
      allow delete: if true;
    }
    match /mail/{docId} {
      allow read, write: if false;
    }
  }
}
```

- [x] **Step 2: Deploy rules via Firebase Console** — MANUAL ACTION REQUIRED: Go to Firestore Console → Rules, paste the updated rules, click Publish.

- [x] **Step 3: Commit**

---

### Task 2: Identity — STAY. BUILD. Tagline

**Files:**
- Modify: `index.html` (rail section, ~line 111–115)

- [x] **Step 1: Replace tagline in rail**

In `index.html`, find the `.rail-logo` div:

```html
      <div class="rail-logo">
        <img src="assets/logo.png" alt="" class="rail-logo-img">
        HOLLER.WORKS
        <div class="tagline">// appalachia</div>
      </div>
```

Replace with:

```html
      <div class="rail-logo">
        <img src="assets/logo.png" alt="" class="rail-logo-img">
        HOLLER.WORKS
      </div>
      <div class="rail-tagline">
        <div class="tagline-line">STAY.</div>
        <div class="tagline-line">BUILD.</div>
      </div>
```

- [x] **Step 2: Replace `.rail-logo .tagline` CSS rule with tagline styles**

Find this CSS rule and replace it (this removes the old rule and adds the new ones in one step):

Old:
```css
    .rail-logo .tagline { color: var(--brown); font-size: 11px; }
```

New:
```css
    .rail-tagline { display: flex; flex-direction: column; gap: 1px; }
    .tagline-line { color: var(--lgray); font-size: 13px; font-weight: bold; letter-spacing: 0.05em; }
```

- [x] **Step 4: Verify in browser**

- [x] **Step 5: Commit**

---

## Chunk 2: Deep Links + Routing Refactor

### Task 3: Refactor Routing to URL-Encoded State

**Files:**
- Modify: `index.html` (router + rail wiring, ~lines 173–250)

`★ Insight ─────────────────────────────────────`
Currently state lives in a JS object and rails call `navigate('/')` which may not trigger `hashchange` if already on `#/`. The fix: encode filter+cat in the hash query string (`#/?filter=need&cat=...`) so every state change produces a unique URL. This also makes filters shareable/bookmarkable for free.
`─────────────────────────────────────────────────`

- [x] **Step 1: Replace `getRoute()` with URL-parsing version**

Find and replace the entire `getRoute()` function:

```js
    function getRoute() {
      const raw = window.location.hash.replace('#', '') || '/';
      const [path, qs] = raw.split('?');
      const params = new URLSearchParams(qs || '');
      if (path === '/' || path === '') {
        return {
          view:   'board',
          filter: params.get('filter') || 'all',
          cat:    params.get('cat')    || null
        };
      }
      if (path.startsWith('/post/')) {
        const id = path.replace('/post/', '').trim();
        if (!id) return { view: 'board', filter: 'all', cat: null };
        return { view: 'post', id };
      }
      if (path === '/submit') return { view: 'submit' };
      if (path === '/admin')  return { view: 'admin' };
      return { view: 'board', filter: 'all', cat: null };
    }
```

- [x] **Step 2: Add `navigateBoard()` helper**

After the updated `getRoute()`, replace the existing `navigate()` function with:

```js
    function navigate(path) {
      window.location.hash = path;
    }

    function navigateBoard() {
      const params = new URLSearchParams();
      if (state.filter !== 'all') params.set('filter', state.filter);
      if (state.cat) params.set('cat', state.cat);
      const qs = params.toString();
      const newHash = '#/' + (qs ? '?' + qs : '');
      if (window.location.hash === newHash) render();
      else window.location.hash = newHash;
    }
```

- [x] **Step 3: Update `render()` to sync state from URL**

Find the `render()` function and add state sync at the top:

```js
    async function render() {
      const route = getRoute();
      if (route.view === 'board') {
        // Reset pagination when filter/cat changes via direct URL navigation
        if (state.filter !== route.filter || state.cat !== route.cat) {
          state.page = 1; state.pageCursors = [null];
        }
        state.filter = route.filter;
        state.cat    = route.cat;
      }
      updateRailActive(route);
      const content = document.getElementById('content');
      content.textContent = 'loading...';

      if (route.view === 'board')  await renderBoard(content);
      if (route.view === 'post')   await renderPost(content, route.id);
      if (route.view === 'submit') renderSubmit(content);
      if (route.view === 'admin')  await renderAdmin(content);
    }
```

- [x] **Step 4: Replace rail button handlers**

Find and replace the entire rail wiring section (the two `querySelectorAll` blocks for `[data-filter]` and `[data-cat]`):

```js
    document.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', () => {
        state.filter = el.dataset.filter;
        state.cat = null; state.page = 1; state.pageCursors = [null];
        navigateBoard();
      });
    });

    document.querySelectorAll('[data-cat]').forEach(el => {
      el.addEventListener('click', () => {
        state.cat = el.dataset.cat;
        state.filter = 'all'; state.page = 1; state.pageCursors = [null];
        navigateBoard();
      });
    });
```

- [x] **Step 5: Verify in browser**

- [x] **Step 6: Commit**

---

## Chunk 3: Board Improvements

### Task 4: Expanded Categories + Rail

**Files:**
- Modify: `index.html` (CATEGORIES constant + rail HTML + rail icons)

- [x] **Step 1: Update `CATEGORIES` constant**

Find and replace the `CATEGORIES` array near the renderSubmit function:

```js
    const CATEGORIES = [
      'Software & Dev', 'IT & Support', 'Data & AI', 'Design & UX',
      'Admin & Operations', 'Finance & Accounting', 'HR & Recruiting',
      'Marketing & Content', 'Writing & Editorial', 'Photography & Video',
      'Music & Audio', 'Trades & Skilled Labor', 'Healthcare & Wellness',
      'Remote-Friendly', 'Other'
    ];
```

- [x] **Step 2: Update rail category buttons in HTML**

Find the entire `<div class="rail-section">` that contains category buttons and replace with:

```html
      <div class="rail-section">
        <img src="assets/icon-mountain.png" alt="" class="rail-mountain">
        <div class="rail-label">category</div>
        <button class="rail-link" data-cat="Software &amp; Dev"><img src="assets/icon-dev.png" class="cat-icon" alt="">dev</button>
        <button class="rail-link" data-cat="IT &amp; Support"><img src="assets/icon-it-support.png" class="cat-icon" alt="">IT &amp; support</button>
        <button class="rail-link" data-cat="Data &amp; AI"><img src="assets/icon-data-ai.png" class="cat-icon" alt="">data &amp; AI</button>
        <button class="rail-link" data-cat="Design &amp; UX"><img src="assets/icon-design.png" class="cat-icon" alt="">design &amp; UX</button>
        <button class="rail-link" data-cat="Admin &amp; Operations"><img src="assets/icon-admin.png" class="cat-icon" alt="">admin &amp; ops</button>
        <button class="rail-link" data-cat="Finance &amp; Accounting"><img src="assets/icon-finance.png" class="cat-icon" alt="">finance</button>
        <button class="rail-link" data-cat="HR &amp; Recruiting"><img src="assets/icon-hr.png" class="cat-icon" alt="">HR</button>
        <button class="rail-link" data-cat="Marketing &amp; Content"><img src="assets/icon-marketing.png" class="cat-icon" alt="">marketing</button>
        <button class="rail-link" data-cat="Writing &amp; Editorial">writing</button>
        <button class="rail-link" data-cat="Photography &amp; Video">photo &amp; video</button>
        <button class="rail-link" data-cat="Music &amp; Audio">music &amp; audio</button>
        <button class="rail-link" data-cat="Trades &amp; Skilled Labor">trades</button>
        <button class="rail-link" data-cat="Healthcare &amp; Wellness">healthcare</button>
        <button class="rail-link" data-cat="Remote-Friendly"><img src="assets/icon-remote.png" class="cat-icon" alt="">remote-friendly</button>
        <button class="rail-link" data-cat="Other"><img src="assets/icon-other.png" class="cat-icon" alt="">other</button>
      </div>
```

- [x] **Step 3: Verify in browser**

- [x] **Step 4: Commit**

---

### Task 5: Post Age + Urgent Badge + Featured Posts

**Files:**
- Modify: `index.html` (utilities section + renderBoard)

- [x] **Step 1: Add `timeAgo()` utility**

In the utilities section (after `showMsg()`), add:

```js
    function timeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60)  return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60)  return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24)    return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30)     return `${days}d ago`;
      const months = Math.floor(days / 30);
      return `${months}mo ago`;
    }
```

- [x] **Step 2: Add CSS for featured and urgent styles**

In the `<style>` block, after `.badge-offer` rule, add:

```css
    .badge-urgent { color: var(--rust); border-color: var(--rust); }
    .post-row-featured { border-left: 3px solid var(--rust); background: #110d08; padding-left: 10px; }
    .featured-label { font-size: 9px; color: var(--rust); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3px; }
```

- [x] **Step 3: Replace `renderBoard()` with featured-aware version**

Replace the entire `renderBoard()` function with:

```js
    async function renderBoard(el) {
      try {
        // ── Featured posts (separate query, prepended) ────────────────────
        const now = new Date();
        const featSnap = await getDocs(query(
          collection(db, 'posts'),
          where('status',   '==', 'approved'),
          where('featured', '==', true)
        ));
        const featuredDocs = featSnap.docs.filter(d => {
          const until = d.data().featuredUntil?.toDate?.();
          return until && until > now;
        });

        // ── Main board query ──────────────────────────────────────────────
        let constraints = [
          collection(db, 'posts'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc')
        ];
        if (state.filter !== 'all') constraints.push(where('type',     '==', state.filter));
        if (state.cat)              constraints.push(where('category', '==', state.cat));
        constraints.push(limit(PAGE_SIZE + 1));

        let q = query(...constraints);
        const cursor = state.pageCursors[state.page - 1];
        if (cursor) q = query(q, startAfter(cursor));

        const snap     = await getDocs(q);
        const docs     = snap.docs;
        const hasNext  = docs.length > PAGE_SIZE;
        const posts    = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

        if (hasNext) state.pageCursors[state.page] = posts[posts.length - 1];

        el.textContent = '';

        if (featuredDocs.length === 0 && posts.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'no posts found.';
          el.appendChild(empty);
          return;
        }

        const fragment = document.createDocumentFragment();

        // Render featured first
        featuredDocs.forEach(d => appendPostRow(fragment, d, true));
        // Then regular posts (skip any already shown as featured)
        const featuredIds = new Set(featuredDocs.map(d => d.id));
        posts.forEach(d => { if (!featuredIds.has(d.id)) appendPostRow(fragment, d, false); });

        el.appendChild(fragment);

        // Pagination
        if (state.page > 1 || hasNext) {
          const pag = document.createElement('div');
          pag.className = 'pagination';
          if (state.page > 1) {
            const prev = document.createElement('button');
            prev.className = 'page-btn';
            prev.textContent = '← prev';
            prev.addEventListener('click', () => { state.page--; render(); });
            pag.appendChild(prev);
          }
          const lbl = document.createElement('span');
          lbl.textContent = `page ${state.page}`;
          pag.appendChild(lbl);
          if (hasNext) {
            const next = document.createElement('button');
            next.className = 'page-btn';
            next.textContent = 'next →';
            next.addEventListener('click', () => { state.page++; render(); });
            pag.appendChild(next);
          }
          el.appendChild(pag);
        }
      } catch (err) {
        console.error(err);
        el.textContent = `error loading posts: ${err.message}`;
      }
    }

    function appendPostRow(fragment, d, isFeatured) {
      const p   = d.data();
      const row = document.createElement('div');
      row.className = 'post-row' + (isFeatured ? ' post-row-featured' : '');
      row.dataset.id = d.id;

      if (isFeatured) {
        const fl = document.createElement('div');
        fl.className = 'featured-label';
        fl.textContent = '★ featured';
        row.appendChild(fl);
      }

      const title = document.createElement('div');
      title.className = 'post-title';
      title.textContent = p.title;

      const meta = document.createElement('div');
      meta.className = 'post-meta';

      const badge = document.createElement('span');
      badge.className = `badge badge-${p.type === 'need' ? 'need' : 'offer'}`;
      badge.textContent = p.type === 'need' ? 'need' : 'offer';
      meta.appendChild(badge);

      if (p.urgent) {
        const ub = document.createElement('span');
        ub.className = 'badge badge-urgent';
        ub.textContent = 'urgent';
        meta.appendChild(ub);
      }

      const age = p.createdAt?.toDate ? timeAgo(p.createdAt.toDate()) : '';
      meta.appendChild(document.createTextNode(
        `${p.category || ''}${p.location ? ' · ' + p.location : ''}${age ? ' · ' + age : ''}`
      ));

      row.appendChild(title);
      row.appendChild(meta);
      row.addEventListener('click', () => navigate(`/post/${d.id}`));
      fragment.appendChild(row);
    }
```

- [x] **Step 4: Add urgent badge to post detail view**

In `renderPost()`, find the entire `metaItems` array definition and the `metaItems.forEach` loop that follows it. Replace both with:

```js
        const metaItems = [
          { label: 'type',     value: p.type,     isBadge: true },
          ...(p.urgent ? [{ label: 'urgency', isUrgent: true }] : []),
          { label: 'category', value: p.category },
          { label: 'location', value: p.location },
          { label: 'comp',     value: p.compensation },
          ...(date ? [{ label: 'posted', value: date }] : [])
        ];

        metaItems.forEach(({ label, value, isBadge, isUrgent }) => {
          if (!value && !isUrgent) return;
          const row = document.createElement('div');
          row.className = 'meta-row';
          const lbl = document.createElement('span');
          lbl.className = 'meta-label';
          lbl.textContent = label;
          row.appendChild(lbl);
          if (isBadge) {
            const badge = document.createElement('span');
            badge.className = `badge badge-${value === 'need' ? 'need' : 'offer'}`;
            badge.textContent = value === 'need' ? 'need' : 'offer';
            row.appendChild(badge);
          } else if (isUrgent) {
            const ub = document.createElement('span');
            ub.className = 'badge badge-urgent';
            ub.textContent = 'urgent';
            row.appendChild(ub);
          } else {
            row.appendChild(document.createTextNode(value || ''));
          }
          metaEl.appendChild(row);
        });
```

- [x] **Step 5: Verify in browser**

- [x] **Step 6: Commit**

---

## Chunk 4: Admin Panel v2

### Task 6: Admin — Expired Tab + Re-open + Expire Button

**Files:**
- Modify: `index.html` (admin section, ~lines 635–760)

- [x] **Step 1: Add `expired` to admin tabs**

Find the tabs rendering in `renderPendingQueue()`:

```js
        ['pending','approved','rejected'].forEach(s => {
```

Replace with:

```js
        ['pending','approved','rejected','expired'].forEach(s => {
```

- [x] **Step 2: Update empty state message for expired tab**

The empty message already uses the `adminFilter` template literal — no change needed.

- [x] **Step 3: Add context-aware action buttons per tab**

Find the `['approve', 'reject'].forEach(action => {` block in `renderPendingQueue()` and replace the entire actions section (from `const actions = ...` through `actions.appendChild(delBtn)`) with:

```js
          const actions = document.createElement('div');
          actions.className = 'admin-actions';

          // ── Approve (pending only) ──────────────────────────────────────
          if (adminFilter === 'pending') {
            const approveBtn = makeStatusBtn('approve', 'approved', d.id, card, el);
            actions.appendChild(approveBtn);
          }

          // ── Reject (pending only) ───────────────────────────────────────
          if (adminFilter === 'pending') {
            const rejectBtn = makeStatusBtn('reject', 'rejected', d.id, card, el);
            actions.appendChild(rejectBtn);
          }

          // ── Expire (approved only) ──────────────────────────────────────
          if (adminFilter === 'approved') {
            const expireBtn = makeStatusBtn('expire', 'expired', d.id, card, el);
            actions.appendChild(expireBtn);
          }

          // ── Re-open (rejected + expired only) ──────────────────────────
          if (adminFilter === 'rejected' || adminFilter === 'expired') {
            const reopenBtn = makeStatusBtn('re-open', 'pending', d.id, card, el);
            actions.appendChild(reopenBtn);
          }

          // ── Edit (approved only) ────────────────────────────────────────
          if (adminFilter === 'approved') {
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-approve';
            editBtn.textContent = 'edit';
            editBtn.addEventListener('click', () => renderEditForm(card, d.id, p));
            actions.appendChild(editBtn);
          }

          // ── Featured toggle (approved only) ─────────────────────────────
          if (adminFilter === 'approved') {
            const now = new Date();
            const isFeatured = p.featured && p.featuredUntil?.toDate?.() > now;
            const featBtn = document.createElement('button');
            featBtn.className = 'btn btn-approve';
            featBtn.textContent = isFeatured ? 'unfeature' : 'feature';
            featBtn.addEventListener('click', async () => {
              featBtn.disabled = true;
              try {
                if (isFeatured) {
                  await updateDoc(doc(db, 'posts', d.id), { featured: false, featuredUntil: null });
                } else {
                  const until = new Date();
                  until.setDate(until.getDate() + 7);
                  await updateDoc(doc(db, 'posts', d.id), { featured: true, featuredUntil: until });
                }
                renderPendingQueue(el);
              } catch (err) {
                console.error(err);
                featBtn.disabled = false;
              }
            });
            actions.appendChild(featBtn);
          }

          // ── Urgent toggle (approved only) ────────────────────────────────
          if (adminFilter === 'approved') {
            const urgBtn = document.createElement('button');
            urgBtn.className = 'btn btn-approve';
            urgBtn.textContent = p.urgent ? 'unurgent' : 'urgent';
            urgBtn.addEventListener('click', async () => {
              urgBtn.disabled = true;
              try {
                await updateDoc(doc(db, 'posts', d.id), { urgent: !p.urgent });
                renderPendingQueue(el);
              } catch (err) {
                console.error(err);
                urgBtn.disabled = false;
              }
            });
            actions.appendChild(urgBtn);
          }

          // ── Delete (all tabs) ────────────────────────────────────────────
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-reject';
          delBtn.style.marginLeft = 'auto';
          delBtn.textContent = 'delete';
          delBtn.addEventListener('click', async () => {
            if (!confirm(`Delete "${p.title}"?`)) return;
            delBtn.disabled = true;
            delBtn.textContent = 'deleting...';
            try {
              await deleteDoc(doc(db, 'posts', d.id));
              card.remove();
              const remaining = el.querySelectorAll('.admin-card');
              if (remaining.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = `no ${adminFilter} posts.`;
                el.appendChild(empty);
                heading.textContent = `// admin — ${adminFilter} (0)`;
              }
            } catch (err) {
              console.error(err);
              delBtn.disabled = false;
              delBtn.textContent = 'delete';
            }
          });
          actions.appendChild(delBtn);

          card.appendChild(actions);
          el.appendChild(card);
```

- [x] **Step 4: Add `makeStatusBtn()` helper**

Add this function just above `renderAdmin`:

```js
    function makeStatusBtn(label, targetStatus, postId, card, el) {
      const btn = document.createElement('button');
      btn.className = label === 'approve' || label === 're-open' ? 'btn btn-approve' : 'btn btn-reject';
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = label + '...';
        try {
          await updateDoc(doc(db, 'posts', postId), { status: targetStatus });
          card.remove();
          const remaining = el.querySelectorAll('.admin-card');
          if (remaining.length === 0) {
            // Re-render to update heading count and show empty state correctly
            renderPendingQueue(el);
          }
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          btn.textContent = label;
          const errDiv = document.createElement('div');
          errDiv.className = 'msg msg-err';
          errDiv.style.marginTop = '8px';
          errDiv.textContent = `error: ${err.message}`;
          card.appendChild(errDiv);
        }
      });
      return btn;
    }
```

- [x] **Step 5: Add duplicate contact warning**

In `renderPendingQueue()`, after `const snap = await getDocs(q);`, add:

```js
        // Build dup map: contact → count across loaded results
        const contactCount = {};
        snap.docs.forEach(d => {
          const c = d.data().contact;
          if (c) contactCount[c] = (contactCount[c] || 0) + 1;
        });
```

Then in the card-building section, after creating `titleEl` and appending the badge, add:

```js
          if (contactCount[p.contact] > 1) {
            const dup = document.createElement('span');
            dup.className = 'badge badge-need';
            dup.style.marginLeft = '6px';
            dup.textContent = 'dup';
            titleEl.appendChild(dup);
          }
```

- [x] **Step 6: Verify in browser**

- [x] **Step 7: Commit**

---

### Task 7: Admin — Inline Post Edit

**Files:**
- Modify: `index.html`

- [x] **Step 1: Add `renderEditForm()` function**

Add the following function just above `render()`:

```js
    function renderEditForm(card, postId, p) {
      card.textContent = '';

      const heading = document.createElement('div');
      heading.className = 'admin-card-title';
      heading.textContent = 'editing post';
      card.appendChild(heading);

      const fields = [
        { id: 'e-title', label: 'title',        value: p.title,        type: 'input',    max: 80 },
        { id: 'e-loc',   label: 'location',     value: p.location,     type: 'input'         },
        { id: 'e-comp',  label: 'compensation', value: p.compensation, type: 'input'         },
        { id: 'e-desc',  label: 'description',  value: p.description,  type: 'textarea', max: 500 },
        { id: 'e-cont',  label: 'contact',      value: p.contact,      type: 'input'         },
      ];

      fields.forEach(f => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const lbl = document.createElement('label');
        lbl.className = 'form-label';
        lbl.htmlFor = f.id;
        lbl.textContent = f.label;
        const inp = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
        inp.className = f.type === 'textarea' ? 'form-textarea' : 'form-input';
        inp.id = f.id;
        if (f.max) inp.maxLength = f.max;
        inp.value = f.value || '';
        group.appendChild(lbl);
        group.appendChild(inp);
        card.appendChild(group);
      });

      // Category select
      const catGroup = document.createElement('div');
      catGroup.className = 'form-group';
      const catLbl = document.createElement('label');
      catLbl.className = 'form-label';
      catLbl.htmlFor = 'e-cat';
      catLbl.textContent = 'category';
      const catSel = document.createElement('select');
      catSel.className = 'form-select';
      catSel.id = 'e-cat';
      CATEGORIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === p.category) opt.selected = true;
        catSel.appendChild(opt);
      });
      catGroup.appendChild(catLbl);
      catGroup.appendChild(catSel);
      card.appendChild(catGroup);

      const actions = document.createElement('div');
      actions.className = 'admin-actions';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-approve';
      saveBtn.textContent = 'save';
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = 'saving...';
        try {
          await updateDoc(doc(db, 'posts', postId), {
            title:        card.querySelector('#e-title').value.trim(),
            location:     card.querySelector('#e-loc').value.trim(),
            compensation: card.querySelector('#e-comp').value.trim(),
            description:  card.querySelector('#e-desc').value.trim(),
            contact:      card.querySelector('#e-cont').value.trim(),
            category:     card.querySelector('#e-cat').value,
          });
          renderPendingQueue(card.closest('#content'));
        } catch (err) {
          console.error(err);
          saveBtn.disabled = false;
          saveBtn.textContent = 'save';
          const errDiv = document.createElement('div');
          errDiv.className = 'msg msg-err';
          errDiv.textContent = `error: ${err.message}`;
          card.appendChild(errDiv);
        }
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-reject';
      cancelBtn.textContent = 'cancel';
      cancelBtn.addEventListener('click', () => {
        renderPendingQueue(card.closest('#content'));
      });

      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
      card.appendChild(actions);
    }
```

- [x] **Step 2: Verify in browser**

- [x] **Step 3: Commit** — included in Task 6 commit

---

## Chunk 5: Submit Form v2

### Task 8: Submit Form — Expanded Categories + Stripe CTAs

**Files:**
- Modify: `index.html` (renderSubmit function)

- [x] **Step 1: Add Stripe URL constants to config section**

In the config section near `ADMIN_PASSWORD`, add:

```js
    const STRIPE_FEATURED_URL = "YOUR_STRIPE_FEATURED_LINK"; // replace after Stripe setup
    const STRIPE_URGENT_URL   = "YOUR_STRIPE_URGENT_LINK";   // replace after Stripe setup
```

- [x] **Step 2: Add Stripe CTA block after submit button in renderSubmit()**

Find the submit button line in the form template inside `renderSubmit()`:

```js
        <button type="submit" class="submit-btn" id="submitBtn">submit post</button>`;
```

Replace with:

```js
        <button type="submit" class="submit-btn" id="submitBtn">submit post</button>
        <div class="stripe-cta">
          <div class="stripe-cta-label">want more visibility?</div>
          <a href="${STRIPE_FEATURED_URL}" target="_blank" rel="noopener noreferrer" class="stripe-link">→ feature this post for 7 days — $10</a>
          <a href="${STRIPE_URGENT_URL}"   target="_blank" rel="noopener noreferrer" class="stripe-link">→ mark as urgent — $5</a>
          <div class="stripe-note">submit your post first, then pay separately. include your post title and contact email in the stripe order so we can find your post.</div>
        </div>`;
```

- [x] **Step 3: Add CSS for Stripe CTA**

In the `<style>` block, add:

```css
    .stripe-cta { margin-top: 22px; border-top: 1px solid #1e1e1e; padding-top: 16px; }
    .stripe-cta-label { color: var(--brown); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .stripe-link { display: block; color: var(--rust); font-size: 12px; margin-bottom: 5px; }
    .stripe-link:hover { text-decoration: underline; }
    .stripe-note { color: #555; font-size: 10px; margin-top: 10px; line-height: 1.6; }
```

- [x] **Step 4: Set up Stripe Payment Links (manual)** — MANUAL ACTION REQUIRED: Create two Stripe Payment Links ($10 featured, $5 urgent), then replace YOUR_STRIPE_FEATURED_LINK and YOUR_STRIPE_URGENT_LINK in index.html.

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → **Payment Links** → **New**
2. Create first link: product name "Feature my post — 7 days", price $10.00 one-time
   - Under **After payment** → add custom field: label "Your post title + contact email"
   - Copy the link URL
3. Create second link: product name "Urgent listing", price $5.00 one-time
   - Same custom field
   - Copy the link URL
4. Replace `YOUR_STRIPE_FEATURED_LINK` and `YOUR_STRIPE_URGENT_LINK` in `index.html` with the real URLs

- [x] **Step 5: Verify in browser**

- [x] **Step 6: Commit**

---

## Chunk 6: Algolia Search

### Task 9: Algolia Setup + Frontend Integration

**Files:**
- Modify: `index.html`

> **Note:** Task 9 modifies `renderBoard()` again. The version produced here supersedes Task 5's version. Follow Task 5 first, then apply Task 9's changes on top.

**Prerequisites:**
1. Create a free Algolia account at [algolia.com](https://algolia.com)
2. Create an index named `holler_works_posts`
3. Go to **Settings → API Keys** — copy:
   - **Application ID**
   - **Search-Only API Key** (public, safe for frontend)
   - **Admin API Key** (private, goes in Cloud Functions only — do NOT put in index.html)

- [x] **Step 1: Add Algolia CDN to `<head>`**

In `index.html`, add before the closing `</head>`:

```html
  <script src="https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js"></script>
```

- [x] **Step 2: Add Algolia constants to config section**

In the config section, add:

```js
    const ALGOLIA_APP_ID    = "YOUR_ALGOLIA_APP_ID";    // replace after Algolia setup
    const ALGOLIA_SEARCH_KEY = "YOUR_ALGOLIA_SEARCH_KEY"; // search-only key — safe for frontend
```

- [x] **Step 3: Initialize Algolia client after Firebase init**

After `const db = getFirestore(app);`, add:

```js
    const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
    const searchIndex   = algoliaClient.initIndex('holler_works_posts');
    let   searchActive  = false;
    let   lastSearchQuery = '';
```

- [x] **Step 4: Add search bar CSS**

In the `<style>` block add:

```css
    .search-bar { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; }
    .search-input { flex: 1; background: #111; border: 1px solid #2a2a2a; color: var(--lgray); font-family: inherit; font-size: 13px; padding: 7px 10px; outline: 0; }
    .search-input:focus { border-color: var(--rust); outline: 2px solid var(--rust); outline-offset: 2px; }
    .search-clear { background: none; border: none; color: #555; font-family: inherit; font-size: 11px; cursor: pointer; padding: 0; white-space: nowrap; }
    .search-clear:hover { color: var(--rust); }
    .search-result-count { font-size: 11px; color: #555; margin-bottom: 14px; }
```

- [x] **Step 5: Add search bar to `renderBoard()`**

At the top of `renderBoard()`, before the featured posts query, add:

```js
      // ── Search bar ────────────────────────────────────────────────────
      el.textContent = '';
      const searchBar = document.createElement('div');
      searchBar.className = 'search-bar';
      const searchInput = document.createElement('input');
      searchInput.className = 'search-input';
      searchInput.type = 'text';
      searchInput.placeholder = 'search posts...';
      searchInput.autocomplete = 'off';
      searchInput.value = searchActive ? lastSearchQuery : '';
      const clearBtn = document.createElement('button');
      clearBtn.className = 'search-clear';
      clearBtn.textContent = 'clear';
      clearBtn.style.display = searchActive ? '' : 'none';
      searchBar.appendChild(searchInput);
      searchBar.appendChild(clearBtn);
      el.appendChild(searchBar);

      const resultsEl = document.createElement('div');
      el.appendChild(resultsEl);

      let searchTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = searchInput.value.trim();
        lastSearchQuery = q;
        clearBtn.style.display = q ? '' : 'none';
        if (!q) {
          searchActive = false;
          renderBoardResults(resultsEl);
          return;
        }
        searchActive = true;
        searchTimer = setTimeout(() => doSearch(resultsEl, q), 300);
      });
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        lastSearchQuery = '';
        clearBtn.style.display = 'none';
        searchActive = false;
        renderBoardResults(resultsEl);
      });

      if (searchActive) {
        await doSearch(resultsEl, lastSearchQuery);
      } else {
        await renderBoardResults(resultsEl);
      }
      return; // early return — renderBoardResults handles the rest
```

- [x] **Step 6: Add `renderBoardResults()` — the featured + main query logic**

After `renderBoard()`, add:

```js
    async function renderBoardResults(el) {
      try {
        const now = new Date();

        // ── Featured posts ─────────────────────────────────────────────────
        const featSnap = await getDocs(query(
          collection(db, 'posts'),
          where('status',   '==', 'approved'),
          where('featured', '==', true)
        ));
        const featuredDocs = featSnap.docs.filter(d => {
          const until = d.data().featuredUntil?.toDate?.();
          return until && until > now;
        });

        // ── Main board query ───────────────────────────────────────────────
        let constraints = [
          collection(db, 'posts'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc')
        ];
        if (state.filter !== 'all') constraints.push(where('type',     '==', state.filter));
        if (state.cat)              constraints.push(where('category', '==', state.cat));
        constraints.push(limit(PAGE_SIZE + 1));

        let q = query(...constraints);
        const cursor = state.pageCursors[state.page - 1];
        if (cursor) q = query(q, startAfter(cursor));

        const snap    = await getDocs(q);
        const docs    = snap.docs;
        const hasNext = docs.length > PAGE_SIZE;
        const posts   = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

        if (hasNext) state.pageCursors[state.page] = posts[posts.length - 1];

        el.textContent = '';

        if (featuredDocs.length === 0 && posts.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'no posts found.';
          el.appendChild(empty);
          return;
        }

        const fragment = document.createDocumentFragment();
        featuredDocs.forEach(d => appendPostRow(fragment, d, true));
        const featuredIds = new Set(featuredDocs.map(d => d.id));
        posts.forEach(d => { if (!featuredIds.has(d.id)) appendPostRow(fragment, d, false); });
        el.appendChild(fragment);

        if (state.page > 1 || hasNext) {
          const pag = document.createElement('div');
          pag.className = 'pagination';
          if (state.page > 1) {
            const prev = document.createElement('button');
            prev.className = 'page-btn';
            prev.textContent = '← prev';
            prev.addEventListener('click', () => { state.page--; render(); });
            pag.appendChild(prev);
          }
          const lbl = document.createElement('span');
          lbl.textContent = `page ${state.page}`;
          pag.appendChild(lbl);
          if (hasNext) {
            const next = document.createElement('button');
            next.className = 'page-btn';
            next.textContent = 'next →';
            next.addEventListener('click', () => { state.page++; render(); });
            pag.appendChild(next);
          }
          el.appendChild(pag);
        }
      } catch (err) {
        console.error(err);
        el.textContent = `error loading posts: ${err.message}`;
      }
    }
```

- [x] **Step 6b: Remove inline query logic from `renderBoard()`**

The `renderBoard()` function currently (after Task 5) contains the full featured-query + main-query + pagination logic inline (from `// ── Featured posts` through the closing `} catch (err)` block). Now that this logic lives in `renderBoardResults()`, **delete** everything inside `renderBoard()`'s `try` block from the `// ── Featured posts` comment through the end of the try block and the catch block. The resulting `renderBoard()` should contain only: the search bar setup (Step 5 of this task), the `resultsEl` div, the event listeners, and the final `if (searchActive) / else` branch — plus its own `try/catch` wrapper.

The final structure of `renderBoard()` after this step:

```js
    async function renderBoard(el) {
      try {
        // ── Search bar ─────────────────────────────────────────
        el.textContent = '';
        // ... search bar DOM setup ...
        // ... event listeners ...
        if (searchActive) {
          await doSearch(resultsEl, lastSearchQuery);
        } else {
          await renderBoardResults(resultsEl);
        }
        return;
      } catch (err) {
        console.error(err);
        el.textContent = `error loading posts: ${err.message}`;
      }
    }
```

- [x] **Step 7: Add `doSearch()` function**

Add after `renderBoardResults()`:

```js
    async function doSearch(el, queryStr) {
      el.textContent = 'searching...';
      try {
        const { hits, nbHits } = await searchIndex.search(queryStr, { hitsPerPage: 40 });
        el.textContent = '';

        const countEl = document.createElement('div');
        countEl.className = 'search-result-count';
        countEl.textContent = `${nbHits} result${nbHits !== 1 ? 's' : ''} for "${queryStr}"`;
        el.appendChild(countEl);

        if (hits.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'no results found.';
          el.appendChild(empty);
          return;
        }

        const fragment = document.createDocumentFragment();
        hits.forEach(hit => {
          const row = document.createElement('div');
          row.className = 'post-row';
          row.dataset.id = hit.objectID;

          const title = document.createElement('div');
          title.className = 'post-title';
          title.textContent = hit.title;

          const meta = document.createElement('div');
          meta.className = 'post-meta';
          const badge = document.createElement('span');
          badge.className = `badge badge-${hit.type === 'need' ? 'need' : 'offer'}`;
          badge.textContent = hit.type === 'need' ? 'need' : 'offer';
          meta.appendChild(badge);
          if (hit.urgent) {
            const ub = document.createElement('span');
            ub.className = 'badge badge-urgent';
            ub.textContent = 'urgent';
            meta.appendChild(ub);
          }
          meta.appendChild(document.createTextNode(
            `${hit.category || ''}${hit.location ? ' · ' + hit.location : ''}`
          ));

          row.appendChild(title);
          row.appendChild(meta);
          row.addEventListener('click', () => navigate(`/post/${hit.objectID}`));
          fragment.appendChild(row);
        });
        el.appendChild(fragment);
      } catch (err) {
        console.error(err);
        el.textContent = `search error: ${err.message}`;
      }
    }
```

- [x] **Step 8: Fill in Algolia credentials** — MANUAL ACTION REQUIRED: Create Algolia account, create index `holler_works_posts`, then replace YOUR_ALGOLIA_APP_ID and YOUR_ALGOLIA_SEARCH_KEY in index.html.

- [x] **Step 9: Verify in browser**

- [x] **Step 10: Commit**

---

## Chunk 7: Cloud Functions v2

### Task 10: Update functions — Algolia sync + auto-expiry

**Files:**
- Modify: `functions/index.js`
- Modify: `functions/package.json`
- Create: `functions/.env`

**Prerequisites:**
- Firebase project must be on **Blaze (pay-as-you-go) plan** for scheduled functions and outbound network calls. Upgrade at: Firebase Console → Project Overview → Spark → Upgrade.
- Firebase Trigger Email extension must be installed. If not: Firebase Console → Extensions → Install "Trigger Email" extension → configure with your email provider (SendGrid or Gmail SMTP).
- Algolia Admin API Key (from Algolia dashboard → Settings → API Keys → Admin API Key — keep private).

- [x] **Step 1: Add `algoliasearch` to functions dependencies**

Edit `functions/package.json`:

```json
{
  "name": "holler-works-functions",
  "version": "1.0.0",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0",
    "algoliasearch": "^4.23.0"
  }
}
```

- [x] **Step 2: Install dependencies**

```bash
cd /home/jason/Desktop/HOLLERWORKS/functions
npm install
```

Expected: `algoliasearch` added to `node_modules`.

- [x] **Step 3: Create `functions/.env`** — MANUAL ACTION REQUIRED: Fill in real values for ADMIN_EMAIL, ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY in functions/.env

Create `functions/.env` (this file must NOT be committed — add to `.gitignore`):

```
ADMIN_EMAIL=your-real-admin-email@example.com
ALGOLIA_APP_ID=your-algolia-app-id
ALGOLIA_ADMIN_KEY=your-algolia-admin-api-key
```

- [x] **Step 4: Add `functions/.env` to `.gitignore`**

Check if `.gitignore` exists at project root:

```bash
cat /home/jason/Desktop/HOLLERWORKS/.gitignore 2>/dev/null || echo "no .gitignore"
```

If it exists, add `functions/.env` to it. If not, create it:

```
functions/.env
functions/node_modules/
```

- [x] **Step 5: Rewrite `functions/index.js`**

Replace the entire file with:

```js
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const algoliasearch    = require('algoliasearch');

initializeApp();

function getAlgoliaIndex() {
  const client = algoliasearch(
    process.env.ALGOLIA_APP_ID,
    process.env.ALGOLIA_ADMIN_KEY
  );
  return client.initIndex('holler_works_posts');
}

// ── 1. Email admin on new post ─────────────────────────────────────────────
exports.onNewPost = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending') return;

  const db = getFirestore();
  await db.collection('mail').add({
    to: process.env.ADMIN_EMAIL,
    message: {
      subject: '[holler.works] new post pending approval',
      text: [
        'New post submitted to holler.works and is pending your approval.',
        '',
        `Title:    ${post.title}`,
        `Type:     ${post.type}`,
        `Category: ${post.category}`,
        `Location: ${post.location}`,
        `Comp:     ${post.compensation}`,
        `Contact:  ${post.contact}`,
        '',
        'Review it at: https://holler.works/#/admin',
      ].join('\n'),
    },
  });
});

// ── 2. Algolia sync on status change ──────────────────────────────────────
exports.onPostStatusChange = onDocumentUpdated('posts/{postId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Guard: only act on status changes
  if (before.status === after.status) return;

  const postId = event.params.postId;
  const db     = getFirestore();
  const index  = getAlgoliaIndex();

  if (after.status === 'approved') {
    // Set approvedAt. This update triggers onPostStatusChange again, but the
    // guard (before.status === after.status) will short-circuit that second
    // invocation. The double-trigger is expected and visible in function logs.
    await db.collection('posts').doc(postId).update({
      approvedAt: FieldValue.serverTimestamp(),
    });

    // Add to Algolia
    await index.saveObject({
      objectID:     postId,
      title:        after.title        || '',
      description:  after.description  || '',
      category:     after.category     || '',
      location:     after.location     || '',
      type:         after.type         || '',
      compensation: after.compensation || '',
      approvedAt:   Date.now(),
    });

  } else if (after.status === 'expired' || after.status === 'rejected') {
    // Remove from Algolia (idempotent — safe if record doesn't exist)
    await index.deleteObject(postId);
  }
});

// ── 3. Daily expiry + featured cleanup ────────────────────────────────────
exports.dailyExpiry = onSchedule({ schedule: '0 0 * * *', timeZone: 'America/New_York' }, async () => {
  const db    = getFirestore();
  const index = getAlgoliaIndex();
  const now   = new Date();

  // ── Expire posts approved > 28 days ago ─────────────────────────────
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);

  const expireSnap = await db.collection('posts')
    .where('status', '==', 'approved')
    .where('approvedAt', '<', cutoff)
    .get();

  if (!expireSnap.empty) {
    const batch = db.batch();
    expireSnap.docs.forEach(d => batch.update(d.ref, { status: 'expired' }));
    await batch.commit();
    await index.deleteObjects(expireSnap.docs.map(d => d.id));
  }

  // ── Clear stale featured flags ────────────────────────────────────────
  const staleSnap = await db.collection('posts')
    .where('featured', '==', true)
    .where('featuredUntil', '<', now)
    .get();

  if (!staleSnap.empty) {
    const batch2 = db.batch();
    staleSnap.docs.forEach(d => batch2.update(d.ref, {
      featured: false,
      featuredUntil: null,
    }));
    await batch2.commit();
  }
});
```

- [x] **Step 6: Deploy functions** — MANUAL ACTION REQUIRED: Run `firebase deploy --only functions` after filling in .env values. Requires Blaze plan.

```bash
cd /home/jason/Desktop/HOLLERWORKS
firebase deploy --only functions
```

Expected: all 3 functions deploy successfully. Note: requires Blaze plan.

- [x] **Step 7: Add required Firestore indexes** — MANUAL ACTION REQUIRED: Create composite indexes in Firestore Console (status+approvedAt, featured+featuredUntil, status+featured). See plan for details.

**New indexes needed for v2 queries:**

`dailyExpiry` — `status + approvedAt`:
- Collection: `posts`, Field 1: `status` (Ascending), Field 2: `approvedAt` (Ascending)

`dailyExpiry` stale featured — `featured + featuredUntil`:
- Collection: `posts`, Field 1: `featured` (Ascending), Field 2: `featuredUntil` (Ascending)

Featured board query — `status + featured`:
- Collection: `posts`, Field 1: `status` (Ascending), Field 2: `featured` (Ascending)

**Existing board indexes (from v1 — confirm still present):**

The board queries use these combinations which required composite indexes in v1. They should already exist, but verify in **Firestore → Indexes**:
- `status + createdAt` (for base board query)
- `status + type + createdAt` (for filter=need/offer)
- `status + category + createdAt` (for category filter)

If any are missing, they will surface as index errors with creation links when you click those filters on the live site.

Go to **Firestore → Indexes → Composite** and create any that are missing. Alternatively: trigger the queries on the live site and click the error links to auto-create them.

- [x] **Step 8: Test end-to-end** — MANUAL ACTION REQUIRED: Test after deploy.

1. Submit a post via the form → check Firebase Console → Functions → Logs for `onNewPost` execution and admin email send
2. Approve the post in admin → check Algolia dashboard for the record appearing in `holler_works_posts`
3. Reject a post → check Algolia dashboard for the record being removed
4. Search for the approved post title in the board search bar — should appear in results

- [x] **Step 9: Commit**

---

## Chunk 8: Final Polish + Deploy

### Task 11: Netlify Deploy

**Prerequisites:** Netlify account connected to the GitHub repo with `holler.works` domain pointed at it.

- [x] **Step 1: Push to GitHub** — MANUAL ACTION REQUIRED: `git push origin main`

- [x] **Step 2: Verify Netlify auto-deploys** — MANUAL ACTION REQUIRED: Check Netlify dashboard.

- [x] **Step 3: Smoke test on production** — MANUAL ACTION REQUIRED: Test all features on holler.works after deploy.

- [x] **Step 4: Seed required Firestore indexes** — MANUAL ACTION REQUIRED: Follow Firebase Console index links if errors appear.

- [x] **Step 5: Final commit** — All code committed. Push to GitHub to trigger deploy.
