# holler.works -- Search Location Filter
**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Location, type, and category filters currently only apply to Firestore queries. When a user performs a keyword search, all active filters are silently ignored and the filter bar disappears. This spec covers making all filters persist and apply during search.

---

## Problem

`renderLocationFilterBar()` is called inside `renderBoardResults()`, which is only invoked for Firestore (non-search) queries. `doSearch()` renders its own result list with no filter bar and passes no filters to Algolia.

---

## Solution

### 1. Move filter bar to renderBoard()

Remove the `renderLocationFilterBar(el)` call from `renderBoardResults()`. In `renderBoard()`, create a dedicated `filterBarEl` div and call `renderLocationFilterBar(filterBarEl)`, appending it to the board container between the search bar and `resultsEl`.

The filter bar must be a **sibling** of `resultsEl`, not a child. Both `renderBoardResults()` and `doSearch()` clear `resultsEl` with `el.textContent = ''` on every update -- if the filter bar lived inside `resultsEl` it would be destroyed on every search keystroke. As a sibling it is untouched.

Since `renderBoard()` is only called on route changes (not on each keystroke), the filter bar is rendered once and persists across search updates naturally.

### 2. Wire filters into doSearch()

Update `doSearch()` to pass `facetFilters` to Algolia based on active state:

```js
const facetFilters = [];
if (state.locationState) facetFilters.push(`locationState:${state.locationState}`);
if (state.locationRegion) facetFilters.push(`locationRegion:${state.locationRegion}`);
if (state.filter !== 'all') facetFilters.push(`type:${state.filter}`);
if (state.cat) facetFilters.push(`category:${state.cat}`);

const { hits, nbHits } = await searchIndex.search(queryStr, {
  hitsPerPage: 40,
  facetFilters: facetFilters.length ? facetFilters : undefined,
});
```

### 3. Algolia index configuration (manual step)

The following attributes must be set as `attributesForFaceting` in the Algolia dashboard for the `holler_works_posts` index:

- `locationState`
- `locationRegion`
- `type`
- `category`

This is a one-time change in the Algolia dashboard, not in code.

---

## Files Changed

- `index.html` only

## Changes

| Location | Change |
|----------|--------|
| `renderBoardResults()` | Remove `renderLocationFilterBar(el)` call |
| `renderBoard()` | Create `filterBarEl` div as sibling of `resultsEl`, call `renderLocationFilterBar(filterBarEl)` after search bar is appended, before `resultsEl` is appended |
| `doSearch()` | Add `facetFilters` to Algolia search call |

---

## Out of Scope

- Filtering remote-friendly posts during search (remoteFriendly facet not yet stored consistently)
- Showing active filter state visually in the filter bar during search
