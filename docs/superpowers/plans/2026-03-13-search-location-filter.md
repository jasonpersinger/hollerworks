# Search Location Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make location, type, and category filters persist and apply during Algolia keyword search.

**Architecture:** Three targeted edits to `index.html` -- move filter bar rendering to `renderBoard()` as a sibling of `resultsEl` (so it survives result clears), then wire `state` filters into `doSearch()` as Algolia `facetFilters`. Also requires a one-time manual Algolia dashboard change.

**Tech Stack:** Vanilla JS, Algolia `algoliasearch` v4 (`searchIndex.search()`), Firestore (unchanged).

---

## Chunk 1: Algolia Dashboard Setup (manual prerequisite)

**Files:**
- No code changes -- manual step in Algolia dashboard

**Spec:** `docs/superpowers/specs/2026-03-13-search-location-filter-design.md`

---

- [ ] **Step 1: Set attributesForFaceting in Algolia dashboard**

Log in to the Algolia dashboard. Navigate to the `holler_works_posts` index > Configuration > Facets.

Add the following as `attributesForFaceting`:
- `locationState`
- `locationRegion`
- `type`
- `category`

Save and deploy. This is required before facet filters will work in search queries. Without this, Algolia silently ignores `facetFilters`.

---

## Chunk 2: Move Filter Bar to renderBoard()

**Files:**
- Modify: `index.html:432-435` (renderBoard -- insert filterBarEl between searchBar and resultsEl)
- Modify: `index.html:570-571` (renderBoardResults -- remove renderLocationFilterBar call)

---

- [ ] **Step 2: Remove renderLocationFilterBar from renderBoardResults()**

In `index.html`, find lines 570-571:

```js
        el.textContent = '';
        renderLocationFilterBar(el);
```

Change to:

```js
        el.textContent = '';
```

The filter bar is now rendered once by `renderBoard()` and lives outside `resultsEl`, so it no longer needs to be re-rendered on every Firestore query.

- [ ] **Step 3: Add filterBarEl as sibling of resultsEl in renderBoard()**

In `index.html`, find lines 432-435:

```js
        el.appendChild(searchBar);

        const resultsEl = document.createElement('div');
        el.appendChild(resultsEl);
```

Change to:

```js
        el.appendChild(searchBar);

        const filterBarEl = document.createElement('div');
        el.appendChild(filterBarEl);
        renderLocationFilterBar(filterBarEl);

        const resultsEl = document.createElement('div');
        el.appendChild(resultsEl);
```

`filterBarEl` is appended before `resultsEl`. Since `renderBoardResults()` and `doSearch()` only clear `resultsEl` (their `el` parameter), `filterBarEl` is never touched and persists across search keystrokes.

- [ ] **Step 4: Verify filter bar stays visible during search**

Open the app. Type in the search box. Confirm the location/type/category filter bar stays visible while search results update. Previously it disappeared on the first keystroke.

---

## Chunk 3: Wire Filters into doSearch()

**Files:**
- Modify: `index.html:615-618` (doSearch -- add facetFilters to Algolia search call)

---

- [ ] **Step 5: Add facetFilters to doSearch()**

In `index.html`, find line 618:

```js
        const { hits, nbHits } = await searchIndex.search(queryStr, { hitsPerPage: 40 });
```

Replace with:

```js
        const facetFilters = [];
        if (state.locationState)  facetFilters.push(`locationState:${state.locationState}`);
        if (state.locationRegion) facetFilters.push(`locationRegion:${state.locationRegion}`);
        if (state.filter !== 'all') facetFilters.push(`type:${state.filter}`);
        if (state.cat)            facetFilters.push(`category:${state.cat}`);

        const { hits, nbHits } = await searchIndex.search(queryStr, {
          hitsPerPage: 40,
          facetFilters: facetFilters.length ? facetFilters : undefined,
        });
```

- [ ] **Step 6: Verify filters apply during search**

Open the app. Set a location filter (e.g., select a state). Type a search query. Confirm results are scoped to that state. Clear the filter and confirm all-state results come back. Repeat with type and category filters.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: persist filter bar and apply filters during search"
```
