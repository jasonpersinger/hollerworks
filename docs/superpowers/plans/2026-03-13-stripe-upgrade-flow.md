# Stripe Upgrade Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "include your title and email" Stripe instructions with parameterized payment links that auto-link every payment to the correct post.

**Architecture:** Three targeted edits to `index.html` -- remove the Stripe CTA from the submit form, capture the Firestore doc ID after submission, and build parameterized Stripe URLs on the success screen using DOM methods. One additional edit fixes the footer Polar reference.

**Tech Stack:** Vanilla JS, Firebase Firestore `addDoc()`, Stripe Payment Links (static URLs with query params).

---

## Chunk 1: Stripe Upgrade Flow

**Files:**
- Modify: `index.html:1012-1017` (remove `.stripe-cta` from form HTML)
- Modify: `index.html:1105` (capture `docRef` from `addDoc()`)
- Modify: `index.html:1114-1123` (replace success screen with parameterized upgrade CTA)
- Modify: `index.html:1597` (fix footer: Polar -> Stripe)

**Spec:** `docs/superpowers/specs/2026-03-13-stripe-upgrade-flow-design.md`

---

- [ ] **Step 1: Remove Stripe CTA from form HTML**

In `index.html`, find and remove this block from the `renderSubmit()` form innerHTML (around line 1012):

```
        <div class="stripe-cta">
          <div class="stripe-cta-label">want more visibility?</div>
          <a href="${STRIPE_FEATURED_URL}" ...>feature this post for 7 days -- $10</a>
          <a href="${STRIPE_URGENT_URL}"   ...>mark as urgent -- $5</a>
          <div class="stripe-note">submit your post first, then pay separately...</div>
        </div>
```

Leave everything else in the form unchanged.

- [ ] **Step 2: Capture docRef from addDoc()**

Find the `addDoc()` call (around line 1105):

```js
          await addDoc(collection(db, 'posts'), {
```

Change to:

```js
          const docRef = await addDoc(collection(db, 'posts'), {
```

- [ ] **Step 3: Replace success screen with parameterized upgrade CTA**

Find the current success handler (around line 1114):

```js
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
```

Replace with:

```js
          const postId      = docRef.id;
          const featuredUrl = STRIPE_FEATURED_URL
            + '?prefilled_email=' + encodeURIComponent(contact)
            + '&client_reference_id=' + postId;
          const urgentUrl   = STRIPE_URGENT_URL
            + '?prefilled_email=' + encodeURIComponent(contact)
            + '&client_reference_id=' + postId;

          el.textContent = '';

          const ok = document.createElement('div');
          ok.className = 'msg msg-ok';
          ok.textContent = 'post submitted -- it will appear on the board after review.';
          el.appendChild(ok);

          const cta = document.createElement('div');
          cta.className = 'stripe-cta';

          const ctaLabel = document.createElement('div');
          ctaLabel.className = 'stripe-cta-label';
          ctaLabel.textContent = 'want more visibility?';
          cta.appendChild(ctaLabel);

          const featuredLink = document.createElement('a');
          featuredLink.href = featuredUrl;
          featuredLink.target = '_blank';
          featuredLink.rel = 'noopener noreferrer';
          featuredLink.className = 'stripe-link';
          featuredLink.textContent = '→ feature this post for 7 days -- $10';
          cta.appendChild(featuredLink);

          const urgentLink = document.createElement('a');
          urgentLink.href = urgentUrl;
          urgentLink.target = '_blank';
          urgentLink.rel = 'noopener noreferrer';
          urgentLink.className = 'stripe-link';
          urgentLink.textContent = '→ mark as urgent -- $5';
          cta.appendChild(urgentLink);

          const note = document.createElement('div');
          note.className = 'stripe-note';
          note.textContent = 'payment is linked to your post automatically.';
          cta.appendChild(note);

          el.appendChild(cta);

          const backLink = document.createElement('a');
          backLink.href = '#/';
          backLink.style.cssText = 'font-size:12px; display:block; margin-top:18px;';
          backLink.textContent = '← back to board';
          el.appendChild(backLink);
```

- [ ] **Step 4: Fix footer Polar reference**

Find in `index.html` (around line 1597):

```
Payments processed by Polar.
```

Change to:

```
Payments processed by Stripe.
```

- [ ] **Step 5: Verify the flow**

Open the app and submit a test post. Confirm:
- The Stripe upgrade CTA no longer appears in the form below the submit button
- After submission, the success screen shows the two upgrade links
- Hovering over a link shows the Stripe URL with `prefilled_email` and `client_reference_id` in the browser status bar
- Clicking a link opens Stripe in a new tab with the email pre-filled
- The footer reads "Payments processed by Stripe."

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: auto-link stripe payments to posts via url params"
```
