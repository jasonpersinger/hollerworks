# holler.works -- SEO
**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Two-tier SEO improvement: switch from hash-based routing to History API routing so post URLs are real indexable paths, and add meta tags + JSON-LD structured data so Google can display rich job listing cards.

---

## Tier 1: History API Routing

### Problem

Hash-based URLs (`/#/post/abc123`) are not sent to the server and are poorly indexed by search engines. Google may eventually render JS and index them, but real path URLs (`/post/abc123`) are indexed reliably and immediately.

### Changes

All changes in `index.html`. Netlify is already configured with `/* → index.html` (200 rewrite), so no deployment config changes are needed.

| Location | Change |
|----------|--------|
| `getRoute()` | Parse `window.location.pathname + window.location.search` instead of `window.location.hash` |
| `navigate(path)` | `history.pushState({}, '', path); render();` instead of `window.location.hash = path` |
| `navigateBoard()` | Build `'/' + (qs ? '?' + qs : '')`, call `history.pushState({}, '', url); render();`. Remove the duplicate-hash guard -- pushState is harmless to call with the current URL, and render() is always called explicitly. |
| Event listener | `popstate` instead of `hashchange`. Note: `popstate` is not fired on initial page load, same as `hashchange` -- the existing direct `render()` call at startup handles that and needs no change. |
| Back link in `renderPost()` error branch | `href="/"` instead of `href="#/"` |
| Back link in `renderPost()` success branch | `href="/"` instead of `href="#/"` |
| Back link in submit success view | `href="/"` instead of `href="#/"` (in the DOM-built backLink element) |
| Back link in admin view | `href="/"` instead of `href="#/"` |

Board URLs change from `/#/?filter=need` to `/?filter=need`. Post URLs change from `/#/post/abc` to `/post/abc`.

---

## Tier 2: Meta Tags + JSON-LD

### Static defaults (in `<head>`)

```html
<meta name="description" content="holler.works -- tech jobs and skills board for Appalachia. No recruiters. Compensation required on every listing.">
<meta property="og:site_name" content="holler.works">
<meta property="og:type" content="website">
<meta property="og:title" content="holler.works // tech jobs &amp; skills -- appalachia">
<meta property="og:description" content="holler.works -- tech jobs and skills board for Appalachia. No recruiters. Compensation required on every listing.">
<meta name="twitter:card" content="summary">
```

### Dynamic updates in renderPost()

When a post is viewed, update the page title and OG tags to reflect the post:

- `document.title` -- `{post title} -- holler.works`
- `og:title` -- `{post title} -- holler.works`
- `og:description` -- first 160 characters of the post description
- `og:url` -- `https://holler.works/post/{id}` (only set dynamically for post pages; omitted from static defaults to avoid incorrect canonical URLs on other routes)

A `resetMeta()` helper resets all of the above to site defaults. It is called at the top of `render()` before every route so non-post pages always show the site defaults.

### JSON-LD JobPosting

Injected as a `<script type="application/ld+json">` tag inside `renderPost()`, only for posts where `type === 'need'` (employer listing a job). Posts where `type === 'offer'` (person seeking work) are not job postings and do not get this schema.

Schema fields:

| Schema field | Source |
|---|---|
| `@type` | `"JobPosting"` |
| `title` | `p.title` |
| `description` | `p.description` |
| `datePosted` | `p.createdAt.toDate().toISOString()` |
| `hiringOrganization.name` | `"holler.works community"` |
| `jobLocation.address` | Built from `locationCity`, `locationRegion`, `locationState` |
| `applicantLocationRequirements` | `{ "@type": "Country", "name": "US" }` if `remoteFriendly`, omitted otherwise |
| `jobLocationType` | `"TELECOMMUTE"` if `remoteFriendly`, omitted otherwise |
| *(baseSalary omitted)* | Compensation is free-text and cannot be parsed into a valid `MonetaryAmount`. Including it as free-text would fail Google Rich Results validation. The compensation value is already included in `description`. |
| `occupationalCategory` | `p.category` |
| `directApply` | `true` |
| `url` | `https://holler.works/post/{id}` |

The JSON-LD tag is injected into `<head>` when the post loads and removed when `resetMeta()` is called on route change.

---

## Implementation Notes

- All changes are in `index.html` only
- `resetMeta()` removes any injected `<script type="application/ld+json">` tag and resets title + meta content attributes
- Meta tags must exist in `<head>` at page load (static HTML) so `resetMeta()` can use `querySelector` to update their `content` attribute -- no dynamic tag creation needed for meta
- `og:url` has no static default -- `resetMeta()` removes it if present; `renderPost()` sets it dynamically
- The JSON-LD tag is the only dynamically created/removed tag (along with the `og:url` meta tag)

---

## Out of Scope

- Sitemap generation
- Server-side rendering
- `<link rel="canonical">` tags (a proper canonical implementation would require dynamic insertion per route; omitted for scope -- `og:url` handles social sharing context but does not substitute for canonical in search indexing)
- `type === 'offer'` structured data (no standard schema for job seekers)
