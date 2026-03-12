# holler.works Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build holler.works — a community-driven tech job/skills board for Appalachia as a single `index.html` SPA with Firebase Firestore backend and email notifications on new submissions.

**Architecture:** Single `index.html` file with vanilla JS, hash-based routing (`#/`, `#/post/:id`, `#/submit`, `#/admin`), Firebase v9 modular SDK loaded from CDN, and a Firestore-triggered Cloud Function that writes to the Trigger Email extension's `mail` collection on each new post submission.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules via CDN), Firebase Firestore v9 (CDN), Firebase Cloud Functions v2 (Node 20), Firebase Trigger Email extension, Netlify hosting.

**Note on innerHTML:** All dynamic content uses `escHtml()` to escape user-supplied strings before DOM insertion. Raw HTML strings are only used for structural template literals where all variable content is escaped.

---

## Chunk 1: Project Config Files

### Task 1: Firebase & Netlify Config

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`
- Create: `netlify.toml`
- Create: `functions/package.json`

- [ ] **Step 0: Verify Firebase project exists**

Run `firebase projects:list` to confirm you have an existing Firebase project. If not, create one:
- Go to [console.firebase.google.com](https://console.firebase.google.com) → "Add project"
- Copy the **Project ID** (shown under the project name) — you will need it in Step 2
- Enable Firestore: Firebase Console → Build → Firestore Database → Create database (start in production mode)

- [ ] **Step 1: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

- [ ] **Step 2: Create `.firebaserc`**

Replace `YOUR_PROJECT_ID` with the actual Firebase project ID.

```json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
```

- [ ] **Step 3: Create `firestore.rules`**

Rules: anyone can read approved posts and create pending posts; only status-field updates are allowed from client (admin approve/reject); Cloud Function has admin SDK access and bypasses rules.

**Security note on `allow update`:** The update rule allows any unauthenticated client to set `status` to `"approved"` or `"rejected"`. This is intentional — the admin uses a hardcoded JS password (per spec), not Firebase Auth, so no Firebase identity exists to check. This is an accepted tradeoff for v1; the admin JS password provides the only gate.

**Description field note:** `description` is optional (not in `hasAll`). The size check is guarded to only apply when the field is present.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if resource.data.status == "approved";
      allow create: if request.resource.data.keys().hasAll([
                        "type","title","category","location",
                        "compensation","contact","status","createdAt"
                      ])
                    && request.resource.data.status == "pending"
                    && request.resource.data.type in ["need","offer"]
                    && request.resource.data.title.size() <= 80
                    && (!request.resource.data.keys().hasAll(["description"])
                        || request.resource.data.description.size() <= 500);
      allow update: if request.resource.data.diff(resource.data)
                        .affectedKeys().hasOnly(["status"])
                    && request.resource.data.status in ["approved","rejected"];
    }
    match /mail/{docId} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Create `netlify.toml`**

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 5: Create `functions/package.json`**

```json
{
  "name": "holler-works-functions",
  "version": "1.0.0",
  "engines": { "node": "20" },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

- [ ] **Step 6: Create `functions/.gitignore`**

```
node_modules/
```

- [ ] **Step 7: Install functions dependencies**

```bash
(cd functions && npm install)
```

Expected: `node_modules` created in `functions/`

- [ ] **Step 8: Commit**

```bash
git add firebase.json .firebaserc firestore.rules netlify.toml functions/package.json functions/package-lock.json functions/.gitignore
git commit -m "chore: add Firebase and Netlify config files"
```

---

## Chunk 2: Single-File Frontend (`index.html`)

### Task 2: HTML Shell & CSS

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write `index.html` — full HTML structure and CSS**

Write the complete static HTML and CSS. The `<main id="content">` will be empty — JS fills it in Tasks 3–7.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>holler.works // tech jobs & skills — appalachia</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --black:  #0e0e0e;
      --rust:   #C1440E;
      --brown:  #5C3D2E;
      --gray:   #888888;
      --lgray:  #cccccc;
    }
    body {
      background: var(--black);
      color: var(--gray);
      font-family: 'Courier New', Courier, monospace;
      font-size: 14px;
      line-height: 1.6;
      min-height: 100vh;
    }
    a { color: var(--rust); text-decoration: none; cursor: pointer; }
    a:hover { text-decoration: underline; }
    #app { display: flex; min-height: 100vh; }
    #rail {
      width: 196px; min-width: 196px;
      border-right: 1px solid #1e1e1e;
      padding: 24px 16px;
      display: flex; flex-direction: column; gap: 24px;
    }
    #content { flex: 1; padding: 28px 36px; max-width: 820px; }
    .rail-logo { color: var(--lgray); font-size: 14px; line-height: 1.4; }
    .rail-logo .tagline { color: var(--brown); font-size: 11px; }
    .rail-section { display: flex; flex-direction: column; gap: 3px; }
    .rail-label { color: var(--brown); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .rail-link { color: var(--gray); cursor: pointer; font-size: 12px; display: block; padding: 1px 0; background: none; border: none; font-family: inherit; text-align: left; }
    .rail-link::before { content: '> '; color: #444; }
    .rail-link:hover { color: var(--rust); }
    .rail-link:hover::before { color: var(--rust); }
    .rail-link.active { color: var(--rust); }
    .rail-link.active::before { color: var(--rust); }
    .post-btn { display: block; border: 1px solid var(--rust); color: var(--rust); padding: 7px 12px; font-family: inherit; font-size: 12px; cursor: pointer; background: transparent; text-align: center; width: 100%; }
    .post-btn:hover { background: var(--rust); color: var(--black); }
    .post-row { border-bottom: 1px solid #161616; padding: 13px 8px; cursor: pointer; }
    .post-row:hover { background: #111; }
    .post-title { color: var(--lgray); font-size: 13px; margin-bottom: 5px; }
    .post-title::before { content: '> '; color: var(--rust); }
    .post-meta { color: var(--gray); font-size: 11px; }
    .badge { font-size: 10px; padding: 1px 5px; border: 1px solid; margin-right: 6px; }
    .badge-need  { color: var(--rust);  border-color: var(--rust); }
    .badge-offer { color: var(--brown); border-color: var(--brown); }
    .post-detail-title { color: var(--lgray); font-size: 17px; margin-bottom: 14px; }
    .detail-meta { margin-bottom: 20px; display: flex; flex-direction: column; gap: 5px; }
    .meta-row { font-size: 12px; }
    .meta-label { color: var(--brown); display: inline-block; width: 110px; }
    .detail-desc { border-top: 1px solid #1e1e1e; padding-top: 16px; margin-top: 8px; font-size: 13px; line-height: 1.9; white-space: pre-wrap; }
    .back-link { color: var(--gray); font-size: 11px; margin-bottom: 22px; display: inline-block; }
    .back-link:hover { color: var(--rust); }
    .page-heading { color: var(--lgray); font-size: 14px; border-bottom: 1px solid #1e1e1e; padding-bottom: 10px; margin-bottom: 22px; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; color: var(--brown); font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .form-input, .form-select, .form-textarea { width: 100%; background: #111; border: 1px solid #2a2a2a; color: var(--lgray); font-family: inherit; font-size: 13px; padding: 8px 10px; outline: none; }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--rust); }
    .form-textarea { resize: vertical; min-height: 110px; }
    .form-select option { background: #111; }
    .radio-group { display: flex; gap: 24px; }
    .radio-label { display: flex; align-items: center; gap: 7px; cursor: pointer; color: var(--gray); font-size: 13px; }
    .radio-label input { accent-color: var(--rust); }
    .char-count { font-size: 11px; color: var(--gray); text-align: right; margin-top: 3px; }
    .submit-btn { background: var(--rust); color: var(--black); border: none; padding: 10px 26px; font-family: inherit; font-size: 13px; cursor: pointer; font-weight: bold; }
    .submit-btn:hover { background: #d14510; }
    .submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .admin-card { border: 1px solid #1e1e1e; padding: 16px; margin-bottom: 14px; }
    .admin-card-title { color: var(--lgray); font-size: 13px; margin-bottom: 8px; }
    .admin-card-meta { font-size: 11px; margin-bottom: 12px; line-height: 1.8; }
    .admin-card-desc { font-size: 12px; color: var(--gray); border-top: 1px solid #1e1e1e; padding-top: 10px; margin-top: 8px; white-space: pre-wrap; }
    .admin-actions { display: flex; gap: 10px; margin-top: 14px; }
    .btn { background: transparent; border: 1px solid; padding: 4px 14px; font-family: inherit; font-size: 11px; cursor: pointer; }
    .btn-approve { border-color: var(--brown); color: var(--brown); }
    .btn-approve:hover { background: var(--brown); color: var(--black); }
    .btn-reject { border-color: #333; color: #555; }
    .btn-reject:hover { background: #222; color: var(--gray); }
    .msg { padding: 10px 12px; font-size: 12px; margin-bottom: 18px; }
    .msg-ok  { border: 1px solid var(--brown); color: var(--brown); }
    .msg-err { border: 1px solid var(--rust);  color: var(--rust); }
    .empty { color: #444; font-size: 13px; padding: 40px 0; }
    .pagination { display: flex; gap: 14px; margin-top: 24px; font-size: 11px; align-items: center; color: var(--gray); }
    .page-btn { color: var(--gray); cursor: pointer; background: none; border: none; font-family: inherit; font-size: 11px; padding: 0; }
    .page-btn:hover { color: var(--rust); }
    .page-btn.active { color: var(--rust); }
    .pw-gate { max-width: 300px; }
    @media (max-width: 600px) {
      #app { flex-direction: column; }
      #rail { width: 100%; min-width: unset; border-right: none; border-bottom: 1px solid #1e1e1e; padding: 14px 16px; flex-direction: row; flex-wrap: wrap; gap: 16px; }
      #content { padding: 16px; }
    }
  </style>
</head>
<body>
  <div id="app">
    <nav id="rail">
      <div class="rail-logo">
        HOLLER.WORKS
        <div class="tagline">// appalachia</div>
      </div>
      <div class="rail-section">
        <div class="rail-label">browse</div>
        <button class="rail-link" data-filter="all">all posts</button>
        <button class="rail-link" data-filter="need">[need]</button>
        <button class="rail-link" data-filter="offer">[offer]</button>
      </div>
      <div class="rail-section">
        <div class="rail-label">category</div>
        <button class="rail-link" data-cat="Software & Dev">dev</button>
        <button class="rail-link" data-cat="IT & Support">IT &amp; support</button>
        <button class="rail-link" data-cat="Data & AI">data &amp; AI</button>
        <button class="rail-link" data-cat="Design & UX">design &amp; UX</button>
        <button class="rail-link" data-cat="Admin & Operations">admin &amp; ops</button>
        <button class="rail-link" data-cat="Finance & Accounting">finance</button>
        <button class="rail-link" data-cat="HR & Recruiting">HR</button>
        <button class="rail-link" data-cat="Marketing & Content">marketing</button>
        <button class="rail-link" data-cat="Remote-Friendly">remote-friendly</button>
        <button class="rail-link" data-cat="Other">other</button>
      </div>
      <button class="post-btn" id="postBtn">[+ post]</button>
    </nav>
    <main id="content"></main>
  </div>
  <script type="module">
    /* Firebase init + JS router added in Task 3 */
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify layout**

Open `index.html` directly in browser. Verify:
- Dark `#0e0e0e` background fills the page
- Left rail (196px) visible with faint right border
- "HOLLER.WORKS" in light gray, `// appalachia` in brown
- Rail links render with `>` prefix
- `[+ post]` button at bottom in rust outline style
- `<main>` is empty — expected

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML shell with full CSS layout and color palette"
```

---

### Task 3: Firebase Init + Hash Router + State

**Files:**
- Modify: `index.html` — replace the `<script type="module">` placeholder

- [ ] **Step 1: Replace script block with Firebase init, state, and router**

Replace the placeholder `<script type="module">` block with:

```html
  <script type="module">
    import { initializeApp }
      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
    import { getFirestore, collection, getDocs, getDoc, doc,
             addDoc, updateDoc, query, where, orderBy, limit,
             startAfter, serverTimestamp }
      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

    // ── CONFIG — replace with your Firebase project values ────────────────
    const FIREBASE_CONFIG = {
      apiKey:            "YOUR_API_KEY",
      authDomain:        "YOUR_PROJECT.firebaseapp.com",
      projectId:         "YOUR_PROJECT_ID",
      storageBucket:     "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId:             "YOUR_APP_ID"
    };
    const ADMIN_PASSWORD = "YOUR_ADMIN_PASSWORD"; // change before deploy
    const PAGE_SIZE = 20;
    // ─────────────────────────────────────────────────────────────────────

    const app = initializeApp(FIREBASE_CONFIG);
    const db  = getFirestore(app);

    // ── State ─────────────────────────────────────────────────────────────
    let state = {
      filter:      'all',  // 'all' | 'need' | 'offer'
      cat:         null,   // null | category string
      page:        1,
      pageCursors: [null]  // pageCursors[0]=null (page 1), pageCursors[n]=startAfter doc
    };

    // ── Router ────────────────────────────────────────────────────────────
    function getRoute() {
      const hash = window.location.hash.replace('#', '') || '/';
      if (hash === '/' || hash === '') return { view: 'board' };
      if (hash.startsWith('/post/'))   return { view: 'post', id: hash.replace('/post/', '') };
      if (hash === '/submit')          return { view: 'submit' };
      if (hash === '/admin')           return { view: 'admin' };
      return { view: 'board' };
    }

    function navigate(path) {
      window.location.hash = path;
    }

    async function render() {
      const route = getRoute();
      updateRailActive(route);
      const content = document.getElementById('content');
      content.textContent = 'loading...';

      if (route.view === 'board')  await renderBoard(content);
      if (route.view === 'post')   await renderPost(content, route.id);
      if (route.view === 'submit') renderSubmit(content);
      if (route.view === 'admin')  await renderAdmin(content);
    }

    function updateRailActive(route) {
      document.querySelectorAll('[data-filter]').forEach(el => {
        el.classList.toggle('active',
          el.dataset.filter === state.filter && route.view === 'board');
      });
      document.querySelectorAll('[data-cat]').forEach(el => {
        el.classList.toggle('active',
          el.dataset.cat === state.cat && route.view === 'board');
      });
    }

    // ── Utility ───────────────────────────────────────────────────────────
    function escHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function isEmail(str) {
      return str && str.includes('@') && !str.startsWith('http');
    }

    function showMsg(el, type, text) {
      // type is always a safe constant string ('ok'/'err'); text is escaped
      el.innerHTML = `<div class="msg msg-${type}">${escHtml(text)}</div>`;
    }

    // ── Rail wiring ───────────────────────────────────────────────────────
    document.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', () => {
        state.filter = el.dataset.filter;
        state.cat = null; state.page = 1; state.pageCursors = [null];
        navigate('/');
      });
    });

    document.querySelectorAll('[data-cat]').forEach(el => {
      el.addEventListener('click', () => {
        state.cat = el.dataset.cat;
        state.filter = 'all'; state.page = 1; state.pageCursors = [null];
        navigate('/');
      });
    });

    document.getElementById('postBtn').addEventListener('click', () => navigate('/submit'));
    window.addEventListener('hashchange', render);

    /* View renderers added in Tasks 4-7 — render() call at bottom of script */
  </script>
```

Note: The final `render()` call will be added in Task 4 after all view renderers are defined.

- [ ] **Step 2: Fill in Firebase config values**

Go to Firebase Console → Project Settings → Your apps → SDK setup and configuration. Copy the config object values into `FIREBASE_CONFIG` in `index.html`.

- [ ] **Step 3: Open in browser — verify no console errors**

Open DevTools → Console. Reload. Expected: no errors (the page shows "loading..." since `renderBoard` isn't defined yet — that's fine).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Firebase init, app state, hash router, and utility functions"
```

---

### Task 4: Board View

**Files:**
- Modify: `index.html` — add `renderBoard` + `buildPagination` before the final `</script>` tag

- [ ] **Step 1: Add `renderBoard` and `buildPagination` functions**

Add before the closing `</script>` tag, replacing the placeholder comment:

```js
    // ── Board View ────────────────────────────────────────────────────────
    async function renderBoard(el) {
      try {
        let constraints = [
          collection(db, 'posts'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc')
        ];
        if (state.filter !== 'all') constraints.push(where('type', '==', state.filter));
        if (state.cat)              constraints.push(where('category', '==', state.cat));
        constraints.push(limit(PAGE_SIZE + 1));

        let q = query(...constraints);
        const cursor = state.pageCursors[state.page - 1];
        if (cursor) q = query(q, startAfter(cursor));

        const snap  = await getDocs(q);
        const docs  = snap.docs;
        const hasNext = docs.length > PAGE_SIZE;
        const posts = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

        if (hasNext) state.pageCursors[state.page] = posts[posts.length - 1];

        if (posts.length === 0) {
          el.textContent = 'no posts found.';
          return;
        }

        // Build rows using safe DOM construction
        el.innerHTML = '';
        const fragment = document.createDocumentFragment();

        posts.forEach(d => {
          const p = d.data();
          const row = document.createElement('div');
          row.className = 'post-row';
          row.dataset.id = d.id;

          const title = document.createElement('div');
          title.className = 'post-title';
          title.textContent = p.title;

          const meta = document.createElement('div');
          meta.className = 'post-meta';

          const badge = document.createElement('span');
          badge.className = `badge badge-${p.type}`;
          badge.textContent = p.type;

          const metaText = document.createTextNode(
            `${p.category}${p.location ? ' · ' + p.location : ''}${p.compensation ? ' · ' + p.compensation : ''}`
          );

          meta.appendChild(badge);
          meta.appendChild(metaText);
          row.appendChild(title);
          row.appendChild(meta);
          row.addEventListener('click', () => navigate(`/post/${d.id}`));
          fragment.appendChild(row);
        });

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

    render(); // ← initial render call — must come after all view functions are defined
```

Note: This uses `document.createElement` + `textContent` for user data (XSS-safe), avoiding innerHTML for dynamic content.

- [ ] **Step 2: Enable Firestore composite indexes**

The query uses `status + orderBy(createdAt)` and potentially `type` or `category`. When you first run a filtered query, Firestore will log a URL in the browser console to create the needed composite index. Click those URLs to create the indexes.

Indexes needed:
- `status ASC, createdAt DESC` (for base board query)
- `status ASC, type ASC, createdAt DESC` (for type filter)
- `status ASC, category ASC, createdAt DESC` (for category filter)

- [ ] **Step 3: Seed test data in Firebase Console**

Add 2-3 test documents to `posts` collection:
```
type: "need", title: "wordpress dev for small biz", category: "Software & Dev",
location: "roanoke, va", compensation: "$50/hr", status: "approved",
createdAt: <timestamp>, contact: "test@example.com", description: "need wp help"

type: "offer", title: "IT support / home network setup", category: "IT & Support",
location: "morgantown, wv", compensation: "negotiate", status: "approved",
createdAt: <timestamp>, contact: "offer@example.com", description: ""
```

- [ ] **Step 4: Verify in browser**

Reload. Board should show test posts. Verify:
- Post rows render with title, type badge, category, location, compensation
- Clicking [need] filter re-renders with only need posts
- Clicking a category filters correctly
- Clicking a post row navigates to `#/post/:id`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add board view with Firestore query, filters, and pagination"
```

---

### Task 5: Post Detail View

**Files:**
- Modify: `index.html` — add `renderPost` function before `render()` call

- [ ] **Step 1: Add `renderPost` function**

Add before the `render()` call at the bottom:

```js
    // ── Post Detail ───────────────────────────────────────────────────────
    async function renderPost(el, id) {
      try {
        const snap = await getDoc(doc(db, 'posts', id));

        if (!snap.exists() || snap.data().status !== 'approved') {
          el.innerHTML = '';
          const back = document.createElement('a');
          back.className = 'back-link';
          back.href = '#/';
          back.textContent = '← back to board';
          const err = document.createElement('div');
          err.className = 'msg msg-err';
          err.textContent = 'post not found.';
          el.appendChild(back);
          el.appendChild(err);
          return;
        }

        const p = snap.data();
        const date = p.createdAt?.toDate
          ? p.createdAt.toDate().toLocaleDateString('en-US',
              { year: 'numeric', month: 'short', day: 'numeric' })
          : '';

        el.innerHTML = '';

        const back = document.createElement('a');
        back.className = 'back-link';
        back.href = '#/';
        back.textContent = '← back to board';

        const titleEl = document.createElement('div');
        titleEl.className = 'post-detail-title';
        titleEl.textContent = p.title;

        const metaEl = document.createElement('div');
        metaEl.className = 'detail-meta';

        const rows = [
          ['type',     null, p.type, `badge badge-${p.type}`],
          ['category', p.category],
          ['location', p.location],
          ['comp',     p.compensation],
          ...(date ? [['posted', date]] : [])
        ];

        rows.forEach(([label, text, badgeText, badgeClass]) => {
          const row = document.createElement('div');
          row.className = 'meta-row';
          const lbl = document.createElement('span');
          lbl.className = 'meta-label';
          lbl.textContent = label;
          row.appendChild(lbl);
          if (badgeText) {
            const badge = document.createElement('span');
            badge.className = badgeClass;
            badge.textContent = badgeText;
            row.appendChild(badge);
          } else {
            row.appendChild(document.createTextNode(text || ''));
          }
          metaEl.appendChild(row);
        });

        el.appendChild(back);
        el.appendChild(titleEl);
        el.appendChild(metaEl);

        if (p.description) {
          const desc = document.createElement('div');
          desc.className = 'detail-desc';
          desc.textContent = p.description;
          el.appendChild(desc);
        }

        const contactRow = document.createElement('div');
        contactRow.className = 'meta-row';
        contactRow.style.marginTop = '20px';
        contactRow.style.fontSize = '12px';
        const contactLbl = document.createElement('span');
        contactLbl.className = 'meta-label';
        contactLbl.textContent = 'contact';
        const contactLink = document.createElement('a');
        // Guard against javascript: URLs — only allow mailto: and http(s):
        if (isEmail(p.contact)) {
          contactLink.href = `mailto:${p.contact}`;
        } else if (p.contact && (p.contact.startsWith('https://') || p.contact.startsWith('http://'))) {
          contactLink.href = p.contact;
          contactLink.target = '_blank';
          contactLink.rel = 'noopener noreferrer';
        } else {
          // Unknown scheme — render as text, not a link
          contactLink.removeAttribute('href');
        }
        contactLink.textContent = p.contact;
        contactRow.appendChild(contactLbl);
        contactRow.appendChild(contactLink);
        el.appendChild(contactRow);

      } catch (err) {
        console.error(err);
        el.textContent = `error: ${err.message}`;
      }
    }
```

- [ ] **Step 2: Verify in browser**

Click a post from the board. Verify:
- Title in light gray, type badge correct color
- All meta fields render (category, location, compensation, date)
- Description shows if present
- Contact renders as `mailto:` link for email, external link for URL
- `← back to board` returns to `#/`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add post detail view"
```

---

### Task 6: Submit Form

**Files:**
- Modify: `index.html` — add `renderSubmit` function before `render()` call

- [ ] **Step 1: Add `renderSubmit` function**

```js
    // ── Submit View ───────────────────────────────────────────────────────
    const CATEGORIES = [
      'Software & Dev', 'IT & Support', 'Data & AI', 'Design & UX',
      'Admin & Operations', 'Finance & Accounting', 'HR & Recruiting',
      'Marketing & Content', 'Remote-Friendly', 'Other'
    ];

    function renderSubmit(el) {
      el.innerHTML = '';

      const heading = document.createElement('div');
      heading.className = 'page-heading';
      heading.textContent = '// submit a post';

      const msgEl = document.createElement('div');
      msgEl.id = 'formMsg';

      const form = document.createElement('form');
      form.id = 'submitForm';
      form.autocomplete = 'off';

      form.innerHTML = `
        <div class="form-group">
          <label class="form-label">type *</label>
          <div class="radio-group">
            <label class="radio-label"><input type="radio" name="type" value="need" required> need</label>
            <label class="radio-label"><input type="radio" name="type" value="offer"> offer</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-title">title * <span id="titleCount" class="char-count" style="float:right">0/80</span></label>
          <input class="form-input" id="f-title" type="text" maxlength="80" required placeholder="e.g. wordpress dev needed for small biz site">
        </div>
        <div class="form-group">
          <label class="form-label" for="f-cat">category *</label>
          <select class="form-select" id="f-cat" required>
            <option value="">— select —</option>
            ${CATEGORIES.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-loc">location *</label>
          <input class="form-input" id="f-loc" type="text" required placeholder='e.g. roanoke, va / "remote"'>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-comp">compensation * — no ghost posts</label>
          <input class="form-input" id="f-comp" type="text" required placeholder="e.g. $25/hr · trade · negotiate">
        </div>
        <div class="form-group">
          <label class="form-label" for="f-desc">description <span id="descCount" class="char-count" style="float:right">0/500</span></label>
          <textarea class="form-textarea" id="f-desc" maxlength="500" placeholder="optional — more detail"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-contact">contact * (email or URL)</label>
          <input class="form-input" id="f-contact" type="text" required placeholder="you@example.com or https://...">
        </div>
        <button type="submit" class="submit-btn" id="submitBtn">submit post</button>`;

      el.appendChild(heading);
      el.appendChild(msgEl);
      el.appendChild(form);

      form.querySelector('#f-title').addEventListener('input', function() {
        form.querySelector('#titleCount').textContent = `${this.value.length}/80`;
      });
      form.querySelector('#f-desc').addEventListener('input', function() {
        form.querySelector('#descCount').textContent = `${this.value.length}/500`;
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('#submitBtn');
        msgEl.innerHTML = '';
        btn.disabled = true;
        btn.textContent = 'submitting...';

        const type    = form.querySelector('input[name="type"]:checked')?.value;
        const title   = form.querySelector('#f-title').value.trim();
        const cat     = form.querySelector('#f-cat').value;
        const loc     = form.querySelector('#f-loc').value.trim();
        const comp    = form.querySelector('#f-comp').value.trim();
        const desc    = form.querySelector('#f-desc').value.trim();
        const contact = form.querySelector('#f-contact').value.trim();

        if (!type || !title || !cat || !loc || !comp || !contact) {
          const errDiv = document.createElement('div');
          errDiv.className = 'msg msg-err';
          errDiv.textContent = 'all required fields must be filled in.';
          msgEl.appendChild(errDiv);
          btn.disabled = false;
          btn.textContent = 'submit post';
          return;
        }

        try {
          await addDoc(collection(db, 'posts'), {
            type, title, category: cat, location: loc,
            compensation: comp, description: desc, contact,
            status: 'pending', createdAt: serverTimestamp()
          });

          el.innerHTML = '';
          const ok = document.createElement('div');
          ok.className = 'msg msg-ok';
          ok.textContent = 'post submitted — it will appear on the board after review. thanks.';
          const backLink = document.createElement('a');
          backLink.href = '#/';
          backLink.style.fontSize = '12px';
          backLink.textContent = '← back to board';
          el.appendChild(ok);
          el.appendChild(backLink);
        } catch (err) {
          console.error(err);
          const errDiv = document.createElement('div');
          errDiv.className = 'msg msg-err';
          errDiv.textContent = `submit failed: ${err.message}`;
          msgEl.appendChild(errDiv);
          btn.disabled = false;
          btn.textContent = 'submit post';
        }
      });
    }
```

- [ ] **Step 2: Verify in browser**

Navigate to `#/submit`. Verify:
- All fields render, char counters update
- Submit with missing fields shows error, button re-enables
- Valid submit: check Firebase Console → `posts` for new doc with `status: "pending"`
- Success message appears

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add submit form with validation and Firestore write"
```

---

### Task 7: Admin View

**Files:**
- Modify: `index.html` — add `renderAdmin`, `renderPasswordGate`, `renderPendingQueue` before `render()` call

- [ ] **Step 1: Add admin view functions**

```js
    // ── Admin View ────────────────────────────────────────────────────────
    let adminAuthed = false;

    async function renderAdmin(el) {
      if (!adminAuthed) { renderPasswordGate(el); return; }
      await renderPendingQueue(el);
    }

    function renderPasswordGate(el) {
      el.innerHTML = '';

      const heading = document.createElement('div');
      heading.className = 'page-heading';
      heading.textContent = '// admin';

      const gate = document.createElement('div');
      gate.className = 'pw-gate';

      const pwInput = document.createElement('input');
      pwInput.className = 'form-input';
      pwInput.type = 'password';
      pwInput.placeholder = 'password';
      pwInput.autocomplete = 'current-password';

      const spacer = document.createElement('div');
      spacer.style.height = '10px';

      const pwBtn = document.createElement('button');
      pwBtn.className = 'submit-btn';
      pwBtn.style.width = '100%';
      pwBtn.textContent = 'enter';

      const pwMsg = document.createElement('div');
      pwMsg.style.marginTop = '10px';

      gate.appendChild(pwInput);
      gate.appendChild(spacer);
      gate.appendChild(pwBtn);
      gate.appendChild(pwMsg);
      el.appendChild(heading);
      el.appendChild(gate);

      const check = () => {
        if (pwInput.value === ADMIN_PASSWORD) {
          adminAuthed = true;
          renderPendingQueue(el);
        } else {
          pwMsg.innerHTML = '';
          const err = document.createElement('div');
          err.className = 'msg msg-err';
          err.textContent = 'incorrect password';
          pwMsg.appendChild(err);
        }
      };

      pwBtn.addEventListener('click', check);
      pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      pwInput.focus();
    }

    async function renderPendingQueue(el) {
      try {
        const q = query(
          collection(db, 'posts'),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);

        el.innerHTML = '';
        const heading = document.createElement('div');
        heading.className = 'page-heading';
        heading.textContent = `// admin — pending queue (${snap.size})`;
        el.appendChild(heading);

        if (snap.empty) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.textContent = 'no pending posts.';
          el.appendChild(empty);
          return;
        }

        snap.docs.forEach(d => {
          const p = d.data();
          const date = p.createdAt?.toDate
            ? p.createdAt.toDate().toLocaleDateString('en-US',
                { year: 'numeric', month: 'short', day: 'numeric' })
            : 'unknown date';

          const card = document.createElement('div');
          card.className = 'admin-card';
          card.dataset.id = d.id;

          const titleEl = document.createElement('div');
          titleEl.className = 'admin-card-title';
          const badge = document.createElement('span');
          badge.className = `badge badge-${p.type}`;
          badge.textContent = p.type;
          titleEl.appendChild(badge);
          titleEl.appendChild(document.createTextNode(p.title));

          const metaEl = document.createElement('div');
          metaEl.className = 'admin-card-meta';
          metaEl.innerHTML =
            `<span class="meta-label">category</span>${escHtml(p.category)}<br>` +
            `<span class="meta-label">location</span>${escHtml(p.location)}<br>` +
            `<span class="meta-label">comp</span>${escHtml(p.compensation)}<br>` +
            `<span class="meta-label">contact</span>${escHtml(p.contact)}<br>` +
            `<span class="meta-label">submitted</span>${escHtml(date)}`;

          card.appendChild(titleEl);
          card.appendChild(metaEl);

          if (p.description) {
            const desc = document.createElement('div');
            desc.className = 'admin-card-desc';
            desc.textContent = p.description;
            card.appendChild(desc);
          }

          const actions = document.createElement('div');
          actions.className = 'admin-actions';

          ['approve', 'reject'].forEach(action => {
            const btn = document.createElement('button');
            btn.className = `btn btn-${action}`;
            btn.textContent = action;
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              btn.textContent = action + 'ing...';
              const status = action === 'approve' ? 'approved' : 'rejected';
              try {
                await updateDoc(doc(db, 'posts', d.id), { status });
                card.remove();
                const remaining = el.querySelectorAll('.admin-card');
                if (remaining.length === 0) {
                  const empty = document.createElement('div');
                  empty.className = 'empty';
                  empty.textContent = 'no pending posts.';
                  el.appendChild(empty);
                  heading.textContent = '// admin — pending queue (0)';
                }
              } catch (err) {
                console.error(err);
                btn.disabled = false;
                btn.textContent = action;
                const errDiv = document.createElement('div');
                errDiv.className = 'msg msg-err';
                errDiv.style.marginTop = '8px';
                errDiv.textContent = `error: ${err.message}`;
                card.appendChild(errDiv);
              }
            });
            actions.appendChild(btn);
          });

          card.appendChild(actions);
          el.appendChild(card);
        });
      } catch (err) {
        console.error(err);
        el.textContent = `error loading queue: ${err.message}`;
      }
    }
```

Note on metaEl.innerHTML: the `escHtml()` function is called on all user data. The only static strings are class names and `<br>` tags which are safe constants.

- [ ] **Step 2: Verify end-to-end flow**

1. Submit a test post via `#/submit`
2. Navigate to `#/admin`
3. Enter the `ADMIN_PASSWORD` value
4. Test post appears in queue
5. Click "approve" — card disappears, Firestore doc updates to `approved`
6. Navigate to `#/` — approved post now shows on board
7. Submit another post, reject it — card disappears, Firestore doc updates to `rejected`

- [ ] **Step 3: Deploy Firestore rules**

```bash
firebase deploy --only firestore:rules
```

Expected: `Deploy complete!`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add admin view with password gate and approve/reject queue"
```

---

## Chunk 3: Cloud Function (Email)

### Task 8: Email Notification on New Submission

**Files:**
- Create: `functions/index.js`

**Prerequisite:** Firebase Trigger Email extension must be installed in your Firebase project before deploying this function. Install it in Firebase Console → Extensions → "Trigger Email from Firestore". Configure your SMTP/SendGrid/Mailgun credentials. Note the collection name it watches (default: `mail`).

- [ ] **Step 1: Create `functions/index.js`**

```js
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');

initializeApp();

exports.notifyAdminOnNewPost = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending') return;

  const db = getFirestore();

  await db.collection('mail').add({
    to: 'YOUR_ADMIN_EMAIL',   // ← replace with real admin email before deploy
    message: {
      subject: '[holler.works] new post pending approval',
      text: [
        'New post submitted to holler.works and is pending your approval.',
        '',
        `Title:    ${post.title}`,
        `Type:     ${post.type}`,
        `Category: ${post.category}`,
        `Location: ${post.location}`,
        '',
        'Review it at: https://holler.works/#/admin',
      ].join('\n'),
    },
  });
});
```

- [ ] **Step 2: Replace `YOUR_ADMIN_EMAIL` with the real admin email**

Edit `functions/index.js` before deploying.

- [ ] **Step 3: Upgrade Firebase project to Blaze plan if needed**

Cloud Functions require the Blaze (pay-as-you-go) plan. Check Firebase Console → bottom-left → plan. Upgrade if still on Spark.

- [ ] **Step 4: Deploy the function**

```bash
firebase deploy --only functions
```

Expected: `Deploy complete!` and `notifyAdminOnNewPost` listed in functions.

- [ ] **Step 5: End-to-end test**

1. Submit a test post via the board submit form
2. Firebase Console → Firestore → `posts`: verify `status: "pending"` doc
3. Firebase Console → Firestore → `mail`: verify email document written by function
4. Check admin email inbox — notification email should arrive within ~30 seconds
5. `#/admin` → approve the post → verify it appears on `#/`

- [ ] **Step 6: Commit**

```bash
git add functions/index.js
git commit -m "feat: add Cloud Function to email admin on new post submission"
```

---

### Task 9: Netlify Deploy & Domain

**Files:**
- No new files

- [ ] **Step 1: Push repo to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Connect to Netlify**

In [app.netlify.com](https://app.netlify.com):
- "Add new site" → "Import an existing project" → connect GitHub
- Select the `HOLLERWORKS` repo
- Build command: (leave blank)
- Publish directory: `.` (root)
- Click "Deploy site"

Expected: Netlify deploys and gives you a `*.netlify.app` preview URL.

- [ ] **Step 3: Smoke test on preview URL**

Open the Netlify preview URL. Verify:
- Board loads
- `#/submit` works
- `#/admin` password gate works
- Navigating directly to `https://preview.netlify.app/#/post/some-id` doesn't 404

- [ ] **Step 4: Add custom domain**

In Netlify → Site settings → Domain management:
- "Add a custom domain" → enter `holler.works`
- Follow DNS configuration instructions
- Enable HTTPS (automatic via Let's Encrypt)

- [ ] **Step 5: Final smoke test on production**

1. `https://holler.works` — board loads
2. `https://holler.works/#/submit` — form renders
3. `https://holler.works/#/admin` — password gate
4. Submit a live post, approve it, verify it appears on board

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Config files: `firebase.json`, `.firebaserc`, `firestore.rules`, `netlify.toml`, `functions/package.json` |
| 2 | HTML shell + full CSS (`index.html`) |
| 3 | Firebase init, state, hash router, utilities (`index.html`) |
| 4 | Board view — post list, filters, pagination (`index.html`) |
| 5 | Post detail view (`index.html`) |
| 6 | Submit form (`index.html`) |
| 7 | Admin view — password gate, approve/reject (`index.html`) |
| 8 | Cloud Function — email on new submission (`functions/index.js`) |
| 9 | Netlify deploy + holler.works domain |
