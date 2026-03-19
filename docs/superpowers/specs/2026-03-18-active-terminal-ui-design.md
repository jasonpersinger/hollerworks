# Active Terminal UI Design Document

**Status:** Approved
**Date:** 2026-03-18
**Topic:** UI/UX Enhancements for holler.works

## Overview
This design aims to deepen the "utilitarian terminal" aesthetic of holler.works while improving trust (via moderation signaling) and discovery (via regional markers and category counts).

## Goals
1. **Signal Activity:** Make the board feel like a living, frequently updated system.
2. **Reinforce Trust:** Explicitly highlight that listings are human-moderated.
3. **Regional Discovery:** Allow users to scan the feed for specific Appalachian sub-regions instantly.
4. **Information Density:** Provide more data (category counts) without overwhelming the monospace layout.

## Design Units

### 1. Dynamic Sidebar Counts
- **Description:** Sidebar categories will display the current number of active (approved) listings.
- **Implementation:** 
  - Query Algolia for category facets on page load.
  - Inject counts into the `rail-link` spans.
- **Interface:** CSS-styled `<span>` within the existing sidebar buttons.

### 2. System Pulse Header
- **Description:** A "heartbeat" for the system shown at the top of the job board.
- **Implementation:**
  - A subtle CSS animation (blinking green dot).
  - A "LAST_SYNC" timestamp showing the current time or the most recent post's approval time.

### 3. Regional Chips
- **Description:** Pre-titles in the job feed that identify the state/region.
- **Implementation:**
  - Standardized codes like `[WV]`, `[VA]`, `[PA]`.
  - Added to the title rendering logic in `appendPostRow` and `doSearch`.

### 4. Human-Reviewed Badges
- **Description:** A marker on every listing confirming moderation.
- **Implementation:**
  - A stylized label `// HUMAN_REVIEWED: OK`.
  - Placed in the meta-row of each post.

## Architectural Trade-offs
- **Client-side Counting:** We are using Algolia's faceting to get category counts. This avoids extra Firestore reads but adds a slight dependency on Algolia for the initial sidebar state.
- **Visual Noise:** Adding regional chips and reviewed badges increases the character count per row. We will mitigate this by tightening the monospace spacing.

## Verification Strategy
- **Visual Review:** Verify the "Active Terminal" pulse and counts via the local server.
- **Regression Testing:** Run `npm run test:smoke` to ensure category filters and navigation still function correctly.
