# holler.works Polishing -- Label Rename and About Page
**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Two small UI improvements: rename the need/offer labels in the UI to be clearer, and add an About page accessible from the rail.

---

## 1. Label Rename (display only)

The underlying Firestore data values (`"need"` and `"offer"`) are unchanged. Only display labels change.

| Location | Old | New |
|----------|-----|-----|
| Rail filter buttons | `[need]` | `[have a job]` |
| Rail filter buttons | `[offer]` | `[need a job]` |
| Post badges (board, post detail, admin) | `need` | `have a job` |
| Post badges (board, post detail, admin) | `offer` | `need a job` |
| Submit form radio labels | `need` | `have a job` |
| Submit form radio labels | `offer` | `need a job` |

All changes are in `index.html` only. No Firestore migration required.

---

## 2. About Page

### Route

`#/about` -- new hash route wired into `getRoute()` and `render()`.

### Rail link

Added at the bottom of the rail, near the existing social links, styled as a rail-link button: `[about]`

### Content

```
holler.works is a community job and skills board built for Appalachia.

No recruiter middlemen. No ghost posts. Compensation is required on every listing. Posts are moderated before they go live.

Post for free. If you want more visibility, featured placement runs $10 for 7 days. Urgent badge is $5.

STAY.
BUILD.
```

### Styling

- Matches existing monospace aesthetic
- Body text in `var(--gray)`
- "STAY." and "BUILD." stacked, in `var(--rust)`, same style as the rail tagline
- No new CSS classes needed beyond what exists

### Implementation

Single file change: `index.html`

1. Add `[about]` button to rail HTML
2. Add `if (path === '/about') return { view: 'about' };` to `getRoute()`
3. Add `if (route.view === 'about') renderAbout(content);` to `render()`
4. Add `renderAbout(el)` function

---

## Out of Scope

- Search indexing of About page
- Any animation or transitions
- Multi-language support
