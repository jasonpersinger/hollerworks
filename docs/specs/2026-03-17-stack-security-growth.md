# HOLLER.WORKS Stack, Security, and Early Growth Pulse

This spec gives us three reusable ways to explain the product's stack and security posture, plus a simple analytics habit for the first stretch of launch.

## Stack At A Glance

- Frontend: static single-page app deployed on Netlify
- Backend: Firebase Functions on Node 22
- Database: Firestore
- Search: Algolia
- Public submissions: server-side callable validation plus moderation queue
- Admin auth: email magic-link flow with signed admin sessions
- Spam protection: Cloudflare Turnstile, rate limits, and review before publish
- Analytics: first-party tracking for board views, post views, apply clicks, alert signups, and successful submissions

## 1. Founder-Friendly Answer

Use this when someone asks casually what the site runs on or whether it is secure.

`HOLLER.WORKS is a lightweight web app with a static frontend, Firebase on the backend, Firestore for data, and Algolia for search. Public submissions and admin actions go through server-side validation and moderation instead of writing directly from the browser. We also use Turnstile for spam protection, keep sensitive credentials in managed secrets, and only expose approved public listings client-side.`

## 2. Technical Answer

Use this when the person asking is technical and wants something more concrete.

`The frontend is a static app deployed on Netlify. Backend logic runs through Firebase Functions on Node 22, with Firestore as the primary datastore and Algolia powering search. Public listing data is readable only when a post is approved, enforced by Firestore security rules. Browser-side posting does not write directly to Firestore; submissions go through a callable backend that validates payloads, checks Turnstile, applies throttling, and places posts into moderation. Admin access uses an email magic-link flow and signed sessions, while sensitive values like session-signing and write-capable keys are bound through managed secrets rather than public client config.`

## 3. Short FAQ Version

Use this for site copy, a launch FAQ, or a social reply that needs to stay compact.

### What stack does HOLLER.WORKS use?

HOLLER.WORKS uses a static frontend on Netlify, Firebase Functions and Firestore on the backend, and Algolia for search.

### Is the site secure?

The site is set up so only approved public listing data is readable from the client. Public submissions and admin actions run through server-side checks, moderation, spam protection, and rate limits.

### Do you store secrets in the frontend?

No sensitive credentials are stored in the public client app. Public Firebase configuration is normal for this type of stack, but write-capable secrets and session-signing values are kept in managed backend secrets.

## Early Growth Pulse

The goal here is not to build a huge analytics process. The goal is to stay close to the first signals without turning the site into homework.

### Daily 5-Minute Check

Do this once a day for the first couple of weeks.

1. Open `/admin`.
2. Check the `launch ops snapshot`.
3. Check `traffic funnel, last 7d`.
4. Check `top posts, all time`.
5. Note any unusual movement:
- new alert signups
- new post views
- apply clicks
- suspicious spikes

### Twice-Weekly Report Pull

Run this command two times a week:

```bash
npm run analytics:report
```

The report writes to:

`output/reports/analytics-snapshot.md`

This gives a durable snapshot of:

- inventory counts
- active alerts
- 7-day totals
- funnel percentages
- daily activity
- top posts

### Weekly Questions

At the end of each week, answer these:

1. Are people reaching the board at all?
2. Are they clicking into posts?
3. Which listings are getting attention?
4. Are alerts growing?
5. Are there signs that the homepage or category mix needs to change?

### What Good Early Signals Look Like

- board views begin to move even if small
- post views are not zero
- a few alert signups appear
- a handful of listings start separating from the rest

### What Would Trigger A Pivot

- lots of board views with almost no post views
- post views with no apply clicks over time
- no alert signups after real outreach
- one company or one category dominating the board too heavily

## Suggested Operating Rhythm

- Daily: quick admin check
- Twice weekly: generate analytics snapshot
- Weekly: decide one product or sourcing adjustment based on the data

This keeps us learning from real usage without overcomplicating the very early stage.
