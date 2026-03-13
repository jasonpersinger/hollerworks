# Location Hierarchy + Social Icons Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text location field with a structured state/region/city hierarchy and add social icon links to the rail.

**Architecture:** All changes are in `index.html` (single-file SPA, no build step) plus `functions/index.js` (Algolia sync). Location data is hardcoded as JS constants. Board filtering adds new URL params `st` and `rgn`. Old posts with free-text `location` display as-is; new posts write structured fields.

**Tech Stack:** Vanilla JS, Firebase Firestore v9 (CDN), Algolia, no build step.

---

## Files

- Modify: `index.html` — all UI, state, routing, form, display, and rail changes
- Modify: `functions/index.js` — add locationState/locationRegion to Algolia record

---

## Chunk 1: Data constants + social icons + CSS

### Task 1: Add LOCATIONS and LOCATION_CITIES constants

Find the CATEGORIES array (around line 713) and add after its closing `];`:

- [ ] **Step 1: Add LOCATIONS constant**

```js
const LOCATIONS = {
  'Alabama':        ['Northeast Alabama', 'Northern Alabama'],
  'Georgia':        ['North Georgia', 'Northwest Georgia', 'Northeast Georgia'],
  'Kentucky':       ['Eastern Kentucky', 'Southeast Kentucky'],
  'Maryland':       ['Western Maryland'],
  'Mississippi':    ['Northeast Mississippi'],
  'New York':       ['Southern Tier'],
  'North Carolina': ['Western NC', 'High Country', 'Foothills', 'Southwest NC'],
  'Ohio':           ['Southeastern Ohio', 'Northeast Ohio'],
  'Pennsylvania':   ['Western PA', 'Southwest PA', 'North Central PA'],
  'South Carolina': ['Upstate South Carolina'],
  'Tennessee':      ['East Tennessee', 'Tri-Cities', 'Southeast Tennessee'],
  'Virginia':       ['Southwest Virginia', 'Southside Virginia'],
  'West Virginia':  ['Northern WV', 'Central WV', 'Southern WV'],
};

const LOCATION_CITIES = {
  'Alabama':        ['Anniston', 'Gadsden', 'Huntsville'],
  'Georgia':        ['Rome'],
  'Kentucky':       ['Ashland'],
  'Maryland':       ['Cumberland'],
  'Mississippi':    ['Tupelo'],
  'New York':       ['Binghamton'],
  'North Carolina': ['Asheville'],
  'Ohio':           ['Youngstown'],
  'Pennsylvania':   ['Pittsburgh', 'Scranton', 'Altoona'],
  'South Carolina': ['Greenville', 'Spartanburg'],
  'Tennessee':      ['Knoxville', 'Chattanooga', 'Johnson City', 'Kingsport', 'Bristol'],
  'Virginia':       ['Roanoke', 'Blacksburg'],
  'West Virginia':  ['Charleston', 'Huntington', 'Morgantown', 'Wheeling', 'Beckley'],
};
```

- [ ] **Step 2: Verify in browser console**

Open `index.html` in browser, open console, type `Object.keys(LOCATIONS).length` — should return `13`.

---

### Task 2: Add CSS for location filter bar and social icons

Find `.empty { color: #444; font-size: 13px; padding: 40px 0; }` and add after it:

- [ ] **Step 1: Add CSS**

```css
.loc-filter-bar { display: flex; gap: 8px; margin-bottom: 16px; }
.loc-filter-select { background: #111; border: 1px solid #2a2a2a; color: var(--gray); font-family: inherit; font-size: 11px; padding: 4px 6px; outline: 0; flex: 1; }
.loc-filter-select:focus { border-color: var(--rust); }
.loc-filter-select option { background: #111; }
.rail-socials { display: flex; gap: 8px; }
.social-link { color: #444; font-size: 11px; font-family: inherit; text-decoration: none; }
.social-link:hover { color: var(--rust); text-decoration: none; }
```

---

### Task 3: Add social icons to the rail HTML

- [ ] **Step 1: Find the post button**

Look for: `<button class="post-btn" id="postBtn">[+ post]</button>`

- [ ] **Step 2: Add social links above it**

Replace with:
```html
      <div class="rail-socials">
        <a href="https://x.com/holler_works" target="_blank" rel="noopener noreferrer" class="social-link">[x]</a>
        <a href="https://www.instagram.com/holler.works/" target="_blank" rel="noopener noreferrer" class="social-link">[ig]</a>
        <a href="https://www.reddit.com/r/hollerworks/" target="_blank" rel="noopener noreferrer" class="social-link">[rd]</a>
      </div>
      <button class="post-btn" id="postBtn">[+ post]</button>
```

- [ ] **Step 3: Verify in browser**

Social links appear at the bottom of the rail above [+ post]. Hovering turns them rust.

- [ ] **Step 4: Commit**

```bash
git add index.html
git -c commit.gpgsign=false commit -m "feat: add LOCATIONS data constants and social icons to rail"
```

---

## Chunk 2: State + routing + board filter bar

### Task 4: Add locationState and locationRegion to app state and routing

- [ ] **Step 1: Update state object**

Find the `let state = {` block and add two new fields:

```js
let state = {
  filter:         'all',
  cat:            null,
  remote:         false,
  locationState:  null,
  locationRegion: null,
  page:           1,
  pageCursors:    [null]
};
```

- [ ] **Step 2: Update getRoute() to parse st and rgn params**

In getRoute(), find the board return object and add two fields:

```js
return {
  view:           'board',
  filter:         params.get('filter') || 'all',
  cat:            params.get('cat')    || null,
  remote:         params.get('remote') === '1',
  locationState:  params.get('st')     || null,
  locationRegion: params.get('rgn')    || null,
};
```

- [ ] **Step 3: Update render() to sync location state**

In the render() board sync block, expand the change-detection check and assignment:

```js
if (state.filter !== route.filter || state.cat !== route.cat ||
    state.remote !== route.remote ||
    state.locationState !== route.locationState ||
    state.locationRegion !== route.locationRegion) {
  state.page = 1; state.pageCursors = [null];
}
state.filter         = route.filter;
state.cat            = route.cat;
state.remote         = route.remote;
state.locationState  = route.locationState;
state.locationRegion = route.locationRegion;
```

- [ ] **Step 4: Update navigateBoard() to encode st and rgn**

After the existing params.set calls, add:

```js
if (state.locationState)  params.set('st', state.locationState);
if (state.locationRegion) params.set('rgn', state.locationRegion);
```

---

### Task 5: Add location filter bar above board results

- [ ] **Step 1: Add renderLocationFilterBar() helper**

Add this function right before `async function renderBoardResults(el) {`:

```js
function renderLocationFilterBar(container) {
  const bar = document.createElement('div');
  bar.className = 'loc-filter-bar';

  const stateSel = document.createElement('select');
  stateSel.className = 'loc-filter-select';
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = 'all states';
  stateSel.appendChild(blankOpt);
  Object.keys(LOCATIONS).sort().forEach(s => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    if (s === state.locationState) o.selected = true;
    stateSel.appendChild(o);
  });

  const regionSel = document.createElement('select');
  regionSel.className = 'loc-filter-select';
  regionSel.style.display = state.locationState ? '' : 'none';

  function populateRegions(st) {
    regionSel.textContent = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'all regions';
    regionSel.appendChild(blank);
    if (st && LOCATIONS[st]) {
      LOCATIONS[st].forEach(r => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = r;
        if (r === state.locationRegion) o.selected = true;
        regionSel.appendChild(o);
      });
    }
  }
  populateRegions(state.locationState);

  stateSel.addEventListener('change', () => {
    state.locationState  = stateSel.value || null;
    state.locationRegion = null;
    regionSel.style.display = state.locationState ? '' : 'none';
    populateRegions(state.locationState);
    state.page = 1; state.pageCursors = [null];
    navigateBoard();
  });

  regionSel.addEventListener('change', () => {
    state.locationRegion = regionSel.value || null;
    state.page = 1; state.pageCursors = [null];
    navigateBoard();
  });

  bar.appendChild(stateSel);
  bar.appendChild(regionSel);
  container.appendChild(bar);
}
```

- [ ] **Step 2: Call renderLocationFilterBar at start of renderBoardResults**

In `renderBoardResults`, find the `el.textContent = '';` line that clears the results area (after the featured + main query blocks). Add immediately after it:

```js
renderLocationFilterBar(el);
```

- [ ] **Step 3: Add Firestore constraints for location**

In the constraints array block, add after the existing remote constraint:

```js
if (state.locationState)  constraints.push(where('locationState',  '==', state.locationState));
if (state.locationRegion) constraints.push(where('locationRegion', '==', state.locationRegion));
```

- [ ] **Step 4: Verify in browser**

Two small dropdowns appear above listings. Selecting a state reveals the region dropdown and updates the URL. No posts match yet — that's expected.

- [ ] **Step 5: Commit**

```bash
git add index.html
git -c commit.gpgsign=false commit -m "feat: location state/region filter bar on board"
```

---

## Chunk 3: Submit form + post display

### Task 6: Replace location field in submit form

- [ ] **Step 1: Find and replace the location field in the form template**

Find this in the form.innerHTML template:
```html
        <div class="form-group">
          <label class="form-label" for="f-loc">location *</label>
          <input class="form-input" id="f-loc" type="text" required placeholder='e.g. roanoke, va / "remote"'>
        </div>
```

Replace with:
```html
        <div class="form-group">
          <label class="form-label" for="f-loc-state">state *</label>
          <select class="form-select" id="f-loc-state" required>
            <option value="">— select state —</option>
            ${Object.keys(LOCATIONS).sort().map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="f-loc-region-group" style="display:none">
          <label class="form-label" for="f-loc-region">region *</label>
          <select class="form-select" id="f-loc-region">
            <option value="">— select region —</option>
          </select>
        </div>
        <div class="form-group" id="f-loc-city-group" style="display:none">
          <label class="form-label" for="f-loc-city">city</label>
          <select class="form-select" id="f-loc-city">
            <option value="">— select city (optional) —</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-loc-notes">location notes</label>
          <input class="form-input" id="f-loc-notes" type="text" maxlength="100" placeholder="e.g. remote, based in Harlan County">
        </div>
```

- [ ] **Step 2: Add cascading dropdown wiring after el.appendChild(form)**

After `el.appendChild(form);` in renderSubmit, add:

```js
const stateSel    = form.querySelector('#f-loc-state');
const regionGroup = form.querySelector('#f-loc-region-group');
const regionSel   = form.querySelector('#f-loc-region');
const cityGroup   = form.querySelector('#f-loc-city-group');
const citySel     = form.querySelector('#f-loc-city');

stateSel.addEventListener('change', () => {
  const st = stateSel.value;
  regionSel.textContent = '';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = '— select region —';
  regionSel.appendChild(blank);
  regionGroup.style.display = st ? '' : 'none';
  cityGroup.style.display = 'none';
  citySel.textContent = '';
  const cblank = document.createElement('option');
  cblank.value = ''; cblank.textContent = '— select city (optional) —';
  citySel.appendChild(cblank);
  if (st && LOCATIONS[st]) {
    LOCATIONS[st].forEach(r => {
      const o = document.createElement('option');
      o.value = r; o.textContent = r;
      regionSel.appendChild(o);
    });
  }
});

regionSel.addEventListener('change', () => {
  const st = stateSel.value;
  citySel.textContent = '';
  const cblank = document.createElement('option');
  cblank.value = ''; cblank.textContent = '— select city (optional) —';
  citySel.appendChild(cblank);
  if (st && LOCATION_CITIES[st]) {
    cityGroup.style.display = '';
    LOCATION_CITIES[st].forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      citySel.appendChild(o);
    });
  } else {
    cityGroup.style.display = 'none';
  }
});
```

- [ ] **Step 3: Update form submit handler**

Replace:
```js
const loc = form.querySelector('#f-loc').value.trim();
```
With:
```js
const locState  = form.querySelector('#f-loc-state').value;
const locRegion = form.querySelector('#f-loc-region').value;
const locCity   = form.querySelector('#f-loc-city').value;
const locNotes  = form.querySelector('#f-loc-notes').value.trim();
```

- [ ] **Step 4: Update validation**

Replace:
```js
if (!type || !title || !cat || !loc || !comp || !contact) {
```
With:
```js
if (!type || !title || !cat || !locState || !locRegion || !comp || !contact) {
```

- [ ] **Step 5: Update addDoc call**

Replace:
```js
await addDoc(collection(db, 'posts'), {
  type, title, category: cat, location: loc,
  compensation: comp, description: desc, contact,
  remoteFriendly, status: 'pending', createdAt: serverTimestamp()
});
```
With:
```js
await addDoc(collection(db, 'posts'), {
  type, title, category: cat,
  locationState: locState, locationRegion: locRegion,
  locationCity:  locCity  || null,
  locationNotes: locNotes || null,
  compensation: comp, description: desc, contact,
  remoteFriendly, status: 'pending', createdAt: serverTimestamp()
});
```

- [ ] **Step 6: Verify in browser**

Go to /#/submit. State dropdown appears. Selecting a state reveals region. Selecting a region reveals city for states that have them. Submit a test post to Alabama / Northeast Alabama / Anniston. Check Firestore — document has locationState, locationRegion, locationCity fields and no location field.

- [ ] **Step 7: Commit**

```bash
git add index.html
git -c commit.gpgsign=false commit -m "feat: structured location fields on submit form"
```

---

### Task 7: Update post display with formatLocation() helper

- [ ] **Step 1: Add formatLocation() helper near other utilities (after escHtml)**

```js
function formatLocation(p) {
  if (p.locationState) {
    const parts = [];
    if (p.locationCity)   parts.push(p.locationCity);
    if (p.locationRegion) parts.push(p.locationRegion);
    parts.push(p.locationState);
    return parts.join(', ');
  }
  return p.location || '';
}
```

- [ ] **Step 2: Update appendPostRow() meta text**

Find:
```js
meta.appendChild(document.createTextNode(
  `${p.category || ''}${p.location ? ' · ' + p.location : ''}${age ? ' · ' + age : ''}`
));
```
Replace with:
```js
const locStr = formatLocation(p);
meta.appendChild(document.createTextNode(
  `${p.category || ''}${locStr ? ' · ' + locStr : ''}${age ? ' · ' + age : ''}`
));
```

- [ ] **Step 3: Update renderPost() metaItems**

Replace:
```js
{ label: 'location', value: p.location },
```
With:
```js
{ label: 'location', value: formatLocation(p) },
...(p.locationNotes ? [{ label: 'loc notes', value: p.locationNotes }] : []),
```

- [ ] **Step 4: Verify in browser**

Old posts show free-text location. New test post (from Task 6) shows "Anniston, Northeast Alabama, Alabama".

- [ ] **Step 5: Commit**

```bash
git add index.html
git -c commit.gpgsign=false commit -m "feat: formatLocation helper, structured location on board and detail"
```

---

## Chunk 4: Admin + Algolia + deploy

### Task 8: Update admin card meta and edit form

- [ ] **Step 1: Update admin card meta location line**

In renderPendingQueue, find the metaEl block that sets location. Change:
```js
`<span class="meta-label">location</span>${escHtml(p.location)}<br>` +
```
To:
```js
`<span class="meta-label">location</span>${escHtml(formatLocation(p))}<br>` +
```

- [ ] **Step 2: Add structured location fields to renderEditForm**

In renderEditForm, after `card.appendChild(catGroup);`, add the following block. It only renders structured fields if the post has locationState (new posts), otherwise the existing legacy location input already handles old posts:

```js
if (p.locationState) {
  // State
  const stGrp = document.createElement('div');
  stGrp.className = 'form-group';
  const stLbl = document.createElement('label');
  stLbl.className = 'form-label'; stLbl.textContent = 'state';
  const stSel = document.createElement('select');
  stSel.className = 'form-select'; stSel.id = 'e-loc-state';
  Object.keys(LOCATIONS).sort().forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    if (s === p.locationState) o.selected = true;
    stSel.appendChild(o);
  });
  stGrp.appendChild(stLbl); stGrp.appendChild(stSel);
  card.appendChild(stGrp);

  // Region
  const rgGrp = document.createElement('div');
  rgGrp.className = 'form-group';
  const rgLbl = document.createElement('label');
  rgLbl.className = 'form-label'; rgLbl.textContent = 'region';
  const rgSel = document.createElement('select');
  rgSel.className = 'form-select'; rgSel.id = 'e-loc-region';
  (LOCATIONS[p.locationState] || []).forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r;
    if (r === p.locationRegion) o.selected = true;
    rgSel.appendChild(o);
  });
  rgGrp.appendChild(rgLbl); rgGrp.appendChild(rgSel);
  card.appendChild(rgGrp);

  // Notes
  const ntGrp = document.createElement('div');
  ntGrp.className = 'form-group';
  const ntLbl = document.createElement('label');
  ntLbl.className = 'form-label'; ntLbl.textContent = 'location notes';
  const ntInp = document.createElement('input');
  ntInp.className = 'form-input'; ntInp.id = 'e-loc-notes';
  ntInp.maxLength = 100; ntInp.value = p.locationNotes || '';
  ntGrp.appendChild(ntLbl); ntGrp.appendChild(ntInp);
  card.appendChild(ntGrp);
}
```

- [ ] **Step 3: Update admin save handler**

Replace the single updateDoc call in renderEditForm with:

```js
const updates = {
  title:          card.querySelector('#e-title').value.trim(),
  compensation:   card.querySelector('#e-comp').value.trim(),
  description:    card.querySelector('#e-desc').value.trim(),
  contact:        card.querySelector('#e-cont').value.trim(),
  category:       card.querySelector('#e-cat').value,
  remoteFriendly: card.querySelector('#e-remote').checked,
};
const legacyLoc = card.querySelector('#e-loc');
if (legacyLoc) updates.location = legacyLoc.value.trim();
const eState  = card.querySelector('#e-loc-state');
const eRegion = card.querySelector('#e-loc-region');
const eNotes  = card.querySelector('#e-loc-notes');
if (eState)  updates.locationState  = eState.value;
if (eRegion) updates.locationRegion = eRegion.value;
if (eNotes)  updates.locationNotes  = eNotes.value.trim() || null;
await updateDoc(doc(db, 'posts', postId), updates);
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git -c commit.gpgsign=false commit -m "feat: structured location in admin card and edit form"
```

---

### Task 9: Add locationState/locationRegion to Algolia and deploy

- [ ] **Step 1: Update functions/index.js saveObject call**

Add three new fields to the existing saveObject call:

```js
locationState:  after.locationState  || '',
locationRegion: after.locationRegion || '',
locationCity:   after.locationCity   || '',
```

- [ ] **Step 2: Deploy functions**

```bash
cd /home/jason/Desktop/HOLLERWORKS
npx firebase-tools deploy --only functions
```

- [ ] **Step 3: Push to GitHub**

```bash
git add functions/index.js
git -c commit.gpgsign=false commit -m "feat: add location fields to Algolia records"
git push origin main
```

---

### Task 10: Firestore indexes + end-to-end test

- [ ] **Step 1: Create Firestore composite indexes**

In Firebase Console → Firestore → Indexes → Composite, create:

| Collection | Fields |
|---|---|
| posts | status ASC, locationState ASC, createdAt DESC |
| posts | status ASC, locationRegion ASC, createdAt DESC |

Easiest method: filter the board by state, click the auto-create link in the browser console error.

- [ ] **Step 2: End-to-end test**

1. Go to holler.works/#/submit — structured dropdowns appear
2. Submit a post: Alabama → Northeast Alabama → Anniston
3. Admin: approve the post
4. Board: select Alabama in location filter → post appears
5. Select Northeast Alabama → post still appears
6. Click post → location shows "Anniston, Northeast Alabama, Alabama"
7. Rail: social links [x] [ig] [rd] appear and open correct URLs

- [ ] **Step 3: Done**
