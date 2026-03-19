# holler.works — Session Memory

## Project Overview
Community tech job/skills board for Appalachia. People post "I need X" or "I can offer X."
Domain: holler.works (registered via GitHub Student Pack / Name.com)
Repo: /home/jason/Desktop/HOLLERWORKS

## Hosting & Stack
- Single HTML file, no frameworks, no build step
- Firebase Firestore for posts
- Firebase Cloud Functions + Trigger Email for email notifications
- Netlify hosting, connected to holler.works

## Design Decisions (approved)
- Layout: left rail navigation (Layout C from brainstorming)
- Color palette: rust #C1440E, brown #5C3D2E, gray #888, black #0e0e0e
- Font: monospace throughout (Courier New stack), no external fonts
- ASCII art accents
- Hash-based routing: #/, #/post/:id, #/submit, #/admin

## Post Data Model
```
posts/ {
  type: "need" | "offer",
  title: string (max 80),
  category: string (fixed list),
  location: string,
  compensation: string (REQUIRED),
  description: string (max 500),
  contact: string,
  status: "pending" | "approved" | "rejected",
  createdAt: timestamp
}
```

## Categories (fixed)
Software & Dev / IT & Support / Data & AI / Design & UX /
Admin & Operations / Finance & Accounting / HR & Recruiting /
Marketing & Content / Remote-Friendly / Other

## Moderation Flow
1. Submission → saved as pending in Firestore
2. Cloud Function → email admin
3. Admin visits #/admin → approve or reject
4. Approved posts appear on board

## Open Questions (need answers before implementation)
1. Admin auth — simple password (visible in source, accepted risk) OR Firebase Auth w/ Google account?
2. Contact info on post detail page — publicly visible, intentional?
3. Spam/flood submissions — accepted v1 risk since everything requires approval anyway?

## Spec Doc
docs/superpowers/specs/2026-03-12-holler-works-design.md
Status: reviewed, 8 issues flagged, pending resolution before writing implementation plan

## User Preferences
- Jason Persinger — founder of Pixel Patcher (pixelpatcher.com), Roanoke VA
- Prefers concise responses, no fluff
- Single HTML file architecture preferred
- Firebase already familiar from Pixel Patcher accounting app
- Commits frequently
