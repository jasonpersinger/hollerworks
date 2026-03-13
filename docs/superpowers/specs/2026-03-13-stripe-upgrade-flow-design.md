# holler.works -- Stripe Upgrade Flow
**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Replace the manual "include your title and email in the Stripe order" instructions with a flow that automatically links payments to posts using Stripe Payment Link URL parameters. The upgrade CTA moves from the submit form to the post-submission success screen, where a real post ID exists.

---

## Problem

The current Stripe CTA lives inside the submit form (before submission). The note tells users to manually include their post title and contact email in the Stripe order so the admin can match payment to post. This is error-prone and requires manual admin work.

---

## Solution

Stripe Payment Links accept query parameters:
- `?prefilled_email=<email>` -- pre-fills the customer email in Stripe checkout
- `?client_reference_id=<id>` -- attaches a custom ID to the payment record, visible in the Stripe dashboard

After `addDoc()` returns, the app has both the Firestore document ID (`docRef.id`) and the contact field value. These get embedded in the Stripe URLs shown on the success screen.

---

## Changes

### 1. Remove Stripe CTA from form HTML

Remove the `.stripe-cta` block from the `renderSubmit()` form innerHTML. It currently sits below the submit button and instructs users to include their info manually.

### 2. Show parameterized upgrade CTA on success screen

After `addDoc()` succeeds, replace the current minimal success screen with:

```
[post submitted]

your post is pending review and will appear on the board once approved.

[want more visibility?]
→ feature this post for 7 days -- $10
→ mark as urgent -- $5

payment is linked to your post automatically.

← back to board
```

The `addDoc()` call must capture its return value:

```js
const docRef = await addDoc(collection(db, 'posts'), { ... });
```

The Stripe URLs are then built dynamically:

```js
const postId = docRef.id;
const email  = contact; // already trimmed from form; non-email values are silently ignored by Stripe
const featuredUrl = `${STRIPE_FEATURED_URL}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${postId}`;
const urgentUrl   = `${STRIPE_URGENT_URL}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${postId}`;
```

Stripe links open in a new tab (`target="_blank" rel="noopener noreferrer"`) so the user does not lose the success screen.

The `client_reference_id` appears in the Stripe dashboard on the payment record. Admin looks up the post ID in Firestore directly -- no manual matching.

---

## Files Changed

- `index.html` only

## Changes Summary

| Location | Change |
|----------|--------|
| `renderSubmit()` form innerHTML | Remove `.stripe-cta` block |
| `addDoc()` call | Capture return value: `const docRef = await addDoc(...)` |
| `addDoc()` success handler | Build parameterized Stripe URLs from `docRef.id` + `contact`, render upgrade CTA on success screen |
| Site footer | Update Polar reference to Stripe |

---

## Out of Scope

- Webhooks or automated post promotion (still manual admin action after payment)
- Storing payment status in Firestore
- Handling cases where contact is a URL rather than an email (prefilled_email is ignored by Stripe if not a valid email -- no harm done)
