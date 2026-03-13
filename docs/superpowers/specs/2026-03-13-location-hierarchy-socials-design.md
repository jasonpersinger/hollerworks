# holler.works Location Hierarchy + Social Icons Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Two features in one implementation:
1. Replace the free-text location field with a structured state → region → city hierarchy based on the Appalachian Regional Commission (ARC) map
2. Add social icon links (X, Instagram, Reddit) to the bottom of the left rail

---

## Location Hierarchy

### Data Structure

Two hardcoded JS constants in `index.html`:

- `LOCATIONS` — maps each of the 13 ARC states to an array of region names
- `LOCATION_CITIES` — maps states that have top-25 Appalachian cities to an array of city names

Pittsburgh is included as a manual exception for Pennsylvania despite Allegheny County being outside the ARC boundary.

**States and regions:**

| State | Regions |
|---|---|
| Alabama | Northeast Alabama, Northern Alabama |
| Georgia | North Georgia, Northwest Georgia, Northeast Georgia |
| Kentucky | Eastern Kentucky, Southeast Kentucky |
| Maryland | Western Maryland |
| Mississippi | Northeast Mississippi |
| New York | Southern Tier |
| North Carolina | Western NC, High Country, Foothills, Southwest NC |
| Ohio | Southeastern Ohio, Northeast Ohio |
| Pennsylvania | Western PA, Southwest PA, North Central PA |
| South Carolina | Upstate South Carolina |
| Tennessee | East Tennessee, Tri-Cities, Southeast Tennessee |
| Virginia | Southwest Virginia, Southside Virginia |
| West Virginia | Northern WV, Central WV, Southern WV |

**Cities by state (top-25 Appalachian cities, ARC + Pittsburgh exception):**

| State | Cities |
|---|---|
| Alabama | Anniston, Gadsden, Huntsville |
| Georgia | Rome |
| Kentucky | Ashland |
| Maryland | Cumberland |
| Mississippi | Tupelo |
| New York | Binghamton |
| North Carolina | Asheville |
| Ohio | Youngstown |
| Pennsylvania | Pittsburgh, Scranton, Altoona |
| South Carolina | Greenville, Spartanburg |
| Tennessee | Knoxville, Chattanooga, Johnson City, Kingsport, Bristol |
| Virginia | Roanoke, Blacksburg |
| West Virginia | Charleston, Huntington, Morgantown, Wheeling, Beckley |

### Firestore Fields (new posts only)

- `locationState: string` — required
- `locationRegion: string` — required
- `locationCity: string | null` — optional
- `locationNotes: string | null` — optional freeform ("remote, based in Harlan County")

The existing `location` free-text field is preserved on old posts and displayed as-is. New posts do not write `location`.

### Submit Form

Free-text location field replaced with:
1. **State** dropdown (required)
2. **Region** dropdown (required, populates on state selection)
3. **City** dropdown (optional, only rendered if selected state has cities in `LOCATION_CITIES`)
4. **Location notes** text input (optional, placeholder: "e.g. remote, based in Harlan County")

### Board Filtering

A compact filter bar rendered above the board results, below the search bar. Contains:
- State dropdown (all states option + 13 ARC states)
- Region dropdown (populates when state selected, hidden when no state selected)

Filtering is additive with existing category/type/remote filters.

**URL state:** adds `st` (state) and `rgn` (region) params to the hash query string.

**Firestore query:** when state/region filters active, adds `where('locationState', '==', ...)` and/or `where('locationRegion', '==', ...)` constraints.

**New Firestore composite index required:** `status + locationState + createdAt DESC`

### Post Display

- Board listings: show structured location as `City, Region, State` or `Region, State` (no city) or fall back to legacy `location` field for old posts
- Post detail: same, with full structured display

### Admin

- Card meta: show structured location fields for new posts, legacy `location` for old
- Edit form: add state/region/city/notes fields

### Algolia

Add `locationState` and `locationRegion` to Algolia records in `functions/index.js` `onPostStatusChange`.

---

## Social Icons

Three small icon links at the bottom of the left rail, above the `[+ post]` button:
- X: `https://x.com/holler_works`
- Instagram: `https://www.instagram.com/holler.works/`
- Reddit: `https://www.reddit.com/r/hollerworks/`

Rendered as text labels (`[x]`, `[ig]`, `[rd]`) in the site's monospace style. Rust on hover. Open in new tab.

---

## Out of Scope

- Migrating existing posts to structured location fields
- Location search via Algolia (locationState/locationRegion are stored but not searchable in this version)
- County-level filtering
