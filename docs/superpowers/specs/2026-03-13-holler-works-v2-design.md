# holler.works v2 Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

holler.works is a community-driven skilled work board for Appalachia. v2 expands scope, adds full-text search, monetization via Stripe Payment Links, auto-expiry, admin improvements, and a refreshed identity.

**Tagline:** STAY. BUILD.

---

## Scope Expansion

Categories expand beyond tech to cover all skilled knowledge work rooted in the region. Each post has exactly one category. "Remote-Friendly" is a category option (not a boolean modifier) for v2 simplicity — a post that is remote-friendly picks this as its primary category if the remote nature is the defining characteristic, otherwise picks the skill domain.

- Software & Dev
- IT & Support
- Data & AI
- Design & UX
- Admin & Operations
- Finance & Accounting
- HR & Recruiting
- Marketing & Content
- Writing & Editorial
- Photography & Video
- Music & Audio
- Trades & Skilled Labor
- Healthcare & Wellness
- Remote-Friendly
- Other

No service industry / unskilled labor listings. The line is: skilled work, knowledge work, trades.

---

## Identity

**Tagline in rail:** Replace `// appalachia` tagline with:
```
STAY.
BUILD.
```
Positioned between the logo block and the BROWSE section in the left rail.

No about page. The tagline is the statement.

---

## Architecture

Single `index.html` SPA. Firebase Firestore backend. No build step.

**New dependencies:**
- **Algolia** — full-text search (free tier: 10k records, 10k searches/mo)
- **Stripe Payment Links** — hosted checkout, no webhook code needed
- **Firebase Cloud Functions v2** — 3 functions (see below)
- **Firebase Trigger Email extension** — used by `onNewPost` to send admin email

**New Firestore fields on `posts`:**
- `approvedAt: timestamp` — set when status flips to `approved`; used for 28-day expiry calculation
- `featured: boolean` — pinned to top of board with visual callout
- `featuredUntil: timestamp` — when featured status expires (7 days from toggle)
- `urgent: boolean` — shows urgent badge on listing

---

## Board

### Post Age
Replace full dates with relative time on listings: "just now", "2h ago", "3d ago", "2mo ago". Full date still shown on post detail view.

### Featured Posts
- Fetched with query: `status == 'approved' AND featured == true`, prepended to board listing
- Client-side: posts where `featuredUntil < now` are skipped (not rendered as featured) even if `featured: true` in Firestore — server cleanup by `dailyExpiry` may lag up to 24h
- Visual treatment: rust-colored left border, subtle background tint

### Urgent Badge
- Shown on board listing and post detail
- `[urgent]` badge in rust alongside `[need]`/`[offer]`

### Search
- Algolia search client loaded from CDN (search-only public API key in `index.html`)
- Search bar at top of board content area
- Searches across `title`, `description`, `category`, `location`
- Only `approved` posts are indexed in Algolia
- Results replace board listing while query is active; clearing search restores normal board
- Search state is **not** URL-encoded — it is transient UI state only. Refreshing or sharing a URL does not preserve an active search. This is intentional for v2 simplicity.
- Search **ignores** active URL filter/category state. An active search queries all approved posts in Algolia regardless of the current `#/?filter=` or `#/?cat=` in the URL. This is intentional — search is a global escape hatch.

### Deep Links
Hash encodes filter + category state:
- `#/` — all approved posts
- `#/?filter=need` — need posts only
- `#/?filter=offer` — offer posts only
- `#/?cat=Software+%26+Dev` — category filter
- `#/?filter=need&cat=Trades+%26+Skilled+Labor` — combined

State is read from URL on every render, not stored separately in JS state object. Rail buttons update the hash; `hashchange` triggers render which reads state from URL.

**Parsing:** `getRoute()` strips the leading `#` from `window.location.hash`, splits on `?` to get `[path, queryString]`, then uses `new URLSearchParams(queryString)` to extract `filter` and `cat` params.

---

## Submit Form

### Expanded Categories
Dropdown updated to include all new categories listed above.

### Monetization CTAs
After the submit button, two optional upsells:

```
Want more visibility?
  → Feature this post for 7 days — $10  [opens Stripe Payment Link, new tab]
  → Mark as Urgent — $5  [opens Stripe Payment Link, new tab]
```

Payment is separate from submission. User submits first, pays separately if desired.

**Payment matching:** Stripe Payment Links support a custom customer-facing text field added in the Payment Link settings ("Add a custom field"). Label it "Your post title + contact email". Instructions shown to user below the CTA: "Include your post title and contact email in the order so we can find your post." Admin matches payment using title + contact email. If a payment cannot be matched (user omitted info), admin emails the Stripe receipt address to request details. Unmatched payments are refunded after 7 days. Posts rejected after a featured payment are refunded manually. These edge cases are low-frequency and handled operationally, not in code.

---

## Admin Panel

### Tabs
`pending` | `approved` | `rejected` | `expired` — filter the queue.

### Per-Post Actions (context-aware)
- **pending:** approve, reject, delete
- **approved:** expire, edit, delete, toggle featured, toggle urgent
- **rejected:** re-open (→ pending), delete
- **expired:** re-open (→ pending), delete

### Edit Posts
Inline edit form on admin card. Editable fields: title, category, location, compensation, description, contact. Status not editable via edit form — use action buttons.

### Featured / Urgent Toggles
On approved posts:
- **Feature:** sets `featured: true` + `featuredUntil: now + 7 days`. Toggle again to clear both fields. Auto-cleared by `dailyExpiry` when `featuredUntil` passes.
- **Urgent:** sets `urgent: true`. Toggle again to clear. **No auto-expiry** — urgent is manually managed only. This is intentional for v2; urgency is a content signal, not time-boxed like featured placement.

Admin fulfills manually after Stripe payment confirmation.

### Duplicate Contact Warning
If the same contact email appears on more than one post in the current result set, each matching card shows a `[dup]` warning badge. Detected client-side across loaded results — no extra Firestore query.

---

## Auto-Expiry

**Rule:** Posts expire 28 days after approval (`approvedAt`), not after submission (`createdAt`).

**Implementation:** Scheduled Cloud Function (`dailyExpiry`) runs daily at midnight ET:
1. Queries `status == 'approved'` posts where `approvedAt < now - 28 days`
2. Batch-updates status to `expired`
3. Removes expired posts from Algolia
4. Clears `featured: true` on posts where `featuredUntil < now` (resets stale featured state)

Note: `onPostStatusChange` also fires on individual status → `expired` changes and removes from Algolia. Algolia delete is idempotent — double-removal by `dailyExpiry` is safe and accepted.

Board query only shows `status == 'approved'` posts — expired posts disappear once the function runs (up to 24h lag is acceptable).

---

## Cloud Functions

Three functions in `functions/index.js`:

### 1. `onNewPost` (Firestore trigger)
Fires on `posts/{postId}` create. Writes to the `mail` collection (Firebase Trigger Email extension), which sends email to the configured admin address with post title, type, category, location, compensation, and contact. **No Algolia interaction** — posts are pending at creation and not indexed until approved.

**Admin email address:** configured via Cloud Functions v2 `.env` file as `ADMIN_EMAIL`.

### 2. `onPostStatusChange` (Firestore trigger)
Fires on `posts/{postId}` update. **Guard:** only execute logic if `before.status !== after.status` — prevents spurious re-runs on non-status edits (e.g., admin editing title on an approved post).

Handles:
- Status → `approved`: set `approvedAt = now`, add/update Algolia record
- Status → `expired` or `rejected`: remove from Algolia
- `featured`/`urgent` field changes: **not** synced to Algolia (display-only, not searchable)

Because the guard checks `before.status !== after.status`, `approvedAt` is only set when status actually changes to `approved`. This means:
- Editing an already-approved post (no status change) → guard blocks execution, `approvedAt` unchanged ✓
- Re-approving a previously expired/rejected post (status changes to `approved` again) → `approvedAt` is reset to now, restarting the 28-day expiry clock. This is intentional.

### 3. `dailyExpiry` (scheduled, runs daily at midnight ET)
1. Query `status == 'approved'` where `approvedAt < now - 28 days` → batch-update to `expired`, remove from Algolia
2. Query `featured == true` where `featuredUntil < now` → batch-update `featured: false, featuredUntil: null`

---

## Firestore Rules

Updated rules:
- `read: if true` — all posts readable (pending/approved/rejected/expired). This means anyone can query Firestore directly for non-approved posts. Accepted tradeoff: the board UI only displays `approved` posts, and the content in pending/rejected/expired posts is not sensitive. Tighter read rules require Firebase Auth.
- `create` — same validation as v1
- `update: if true` — fully open for v2 (admin edit requires updating arbitrary fields; no auth to enforce tighter rules; conscious accepted tradeoff for a no-auth SPA)
- `delete: if true` — same as above, conscious accepted tradeoff
- Security note: the `update` and `delete` rules are intentionally permissive due to the no-auth architecture. Mitigation: Firestore activity is visible in the Firebase Console; abuse would be manually detectable. Tighter rules can be added in v3 if Firebase Auth is introduced.

---

## Algolia Setup

1. Create free Algolia account → create index `holler_works_posts`
2. Admin API key stored in Cloud Functions environment config only (never in `index.html`)
3. Search-only public API key + App ID stored as constants in `index.html`
4. Index schema: `objectID` (Firestore doc ID), `title`, `description`, `category`, `location`, `type`, `compensation`, `approvedAt`
5. Algolia records are only added when `status → approved` and removed when `status → expired/rejected`. The client does not need to filter Algolia results by status — records in the index are always approved by invariant. If a sync failure leaves a stale record, it is an operational issue resolved by re-running the sync, not a client-side concern.

---

## Stripe Setup

1. Create Stripe account
2. Create two Payment Links in Stripe dashboard:
   - "Feature my post — 7 days" — $10 (add custom "Order note" field for post title)
   - "Mark as Urgent" — $5 (same)
3. Paste Payment Link URLs into `index.html` as constants (`STRIPE_FEATURED_URL`, `STRIPE_URGENT_URL`)

---

## Out of Scope (v2)

- Stripe webhooks / automated post promotion
- User accounts
- Email submitter on approval
- RSS feed
- Comments / replies
- Multi-category posts
- Search state in URL
