# Conversion and Usability Boost Design Document

**Status:** Proposed
**Date:** 2026-03-18
**Topic:** Conversion (A) and Usability (D) Improvements

## Overview
Following the successful "Active Terminal" update, these changes focus on reducing friction for both employers (submission) and seekers (discovery/mobile usability).

## Goals
1. **Improve Submission Quality:** Help employers see how their post will look before they pay/submit.
2. **Ergonomic Mobile UX:** Make it easier to post from a phone.
3. **Recognition:** Help seekers distinguish between companies in the list more easily.
4. **Low-Friction Discovery:** Highlight "Quick Apply" opportunities.

## Proposed Features

### 1. Post Preview (Employer Trust)
- **Description:** A "Live Preview" panel in the `/submit` view.
- **Implementation:** 
  - A button `[PREVIEW_POST]` that renders a `mini-panel` version of the job row.
  - Helps employers catch formatting errors in the description.

### 2. Sticky Mobile Action Bar
- **Description:** A fixed-bottom bar on mobile containing the "Post a Job" CTA.
- **Implementation:** 
  - CSS: `.mobile-action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--black); border-top: 1px solid #222; padding: 12px; display: none; }`
  - Responsive: Show only on screens < 600px.

### 3. CSS "Logo" Placeholders
- **Description:** A small 24x24 block with the company's initials if no logo is provided.
- **Implementation:** 
  - A function `renderPlaceholder(companyName)` that generates a consistent colored square (using the same brand palette).
  - Adds a "directory" feel without requiring high-res assets.

### 4. Direct Apply Highlighting
- **Description:** If the `contact` field is an email, show a `[DIRECT]` chip.
- **Implementation:** 
  - Check `isLikelyEmail(p.contact)` during row rendering.
  - Prepend to metadata.

## Architectural Trade-offs
- **Mobile Real Estate:** A fixed bottom bar takes up vertical space. We'll keep it very slim (approx 48px).
- **Complexity:** Adding a preview adds more logic to the `renderSubmit` function, but it's purely client-side.

## Next Steps
- User approval of these concepts.
- Detailed implementation plan.
