# HOLLER.WORKS Ecosystem Source Scouting

This is the next-source map for broadening job coverage beyond the current employer ATS starter set.

## Immediate targets

These are the best next sources to operationalize because they are official, regional, and likely to produce varied listings or varied employer leads.

1. `Knoxville Technology Council Job Board`
   - URL: `https://jobs.knoxtech.org/`
   - Why it matters: direct East Tennessee coverage, visible employer directory, active tech board
   - Best use: ingest jobs and mine company names for direct ATS follow-up
   - Current take: the new `getro` adapter works here, but many postings fail HOLLER.WORKS import because compensation is missing; still valuable as a selective source and discovery layer

2. `Launch Tennessee Job Board`
   - URL: `https://jobs.launchtn.org/`
   - Why it matters: startup-heavy statewide Tennessee mix
   - Best use: ingest jobs and mine companies
   - Current take: confirmed shared `getro` platform with KnoxTech; direct import should stay conservative because statewide coverage is broader than Appalachia and many listings are outside scope

3. `Generation WV Career Connector`
   - URL: `https://generationwv.org/our-work/career-opportunities/`
   - Why it matters: direct West Virginia relevance and an existing tech-industry focus
   - Best use: ingest if the listing surface is stable; otherwise use it to identify employers and partner orgs
   - Current take: especially valuable for getting HOLLER.WORKS out of the Pittsburgh gravity well, but the current tech-industry feed is thin. It uses `WP Job Manager`, which is technically scrapeable, but the live feed only surfaced two current listings on March 16, 2026 and neither looked like a strong direct-import fit.

4. `PGH Career Connector`
   - URL: `https://www.pghcareerconnector.com/`
   - Why it matters: official Pittsburgh Technology Council board, likely good employer density
   - Best use: diversify Pittsburgh beyond Aurora / Duolingo / Gecko
   - Current take: still useful even with existing Pittsburgh coverage because it should expose different employers

5. `Venture Asheville Job Board`
   - URL: `https://ventureasheville.com/jobs/`
   - Why it matters: Western North Carolina startup and venture coverage
   - Best use: direct listings if the page is scrapeable; otherwise employer discovery
   - Current take: high-value because Western NC is on-brand and currently underrepresented

## Discovery-only sources

These are good for employer discovery, partnerships, and outreach, but I would not build ingestion around them first.

- `TechConnect WV`
  - URL: `https://techconnectwv.org/`
  - Use it for: employer discovery, ecosystem mapping, outreach, partnership ideas
  - Why not first: points users back to Generation WV for the actual jobs surface

- `ChaTech Jobs & Talent`
  - URL: `https://www.chatech.org/jobsandtalent`
  - Use it for: employer discovery and Chattanooga ecosystem mapping
  - Why not first: looks more like a jobs-and-resume hub than a clean public board

- `PGH.AI Career Hub`
  - URL: `https://www.pgh.ai/careerhub`
  - Use it for: AI employer discovery and niche community signals
  - Why not first: community/discussion heavy, not a structured board

## Academic and Research Lane

Academic institutions are worth considering for HOLLER.WORKS, but only as filtered tech-role sources.

That means:

- yes to software, security, IT, data, research computing, digital product, instructional tech, and technical documentation roles
- no to broad faculty hiring, generic administration, or non-technical campus operations

Current queue:

1. `Oak Ridge National Laboratory`
   - URL: `https://jobs.ornl.gov/`
   - Platform: `SuccessFactors`
   - Why it matters: one of the strongest technical employers in-region
   - Current take: high-value, but sampled public job pages did not expose compensation, so it does not currently satisfy HOLLER.WORKS import policy

2. `West Virginia University`
   - URL: `https://careers.wvu.edu/internal-and-external-portal`
   - Platform: `Taleo`
   - Why it matters: strong in-region institution with likely IT, analytics, and research computing roles
   - Current take: the public Taleo search endpoint is real and the detail pages carry usable role text, but sampled public tech-role pages did not expose compensation. That keeps WVU in-bounds as a manual or semi-automated research lane, but not as an import-ready source under HOLLER.WORKS policy.

3. `Virginia Tech`
   - URL: `https://jobs.vt.edu/`
   - Platform: `PageUp`
   - Why it matters: strong regional fit for software, IT, and digital roles
   - Current take: strongest academic adapter candidate so far. The public `jobs.apply.vt.edu` search surface is filterable via GET parameters, sampled tech-role detail pages expose salary ranges, and a capped first prototype accepted `6` out of `12` fetched roles.

4. `University of Tennessee, Knoxville`
   - URL: `https://jobs.utk.edu/`
   - Platform: unverified from this environment
   - Why it matters: large East Tennessee institution with potential digital-work relevance
   - Current take: keep in queue pending manual verification

5. `WVU Medicine`
   - URL: `https://careers.wvumedicine.org/`
   - Platform: unverified from this environment
   - Why it matters: likely health-tech, cybersecurity, infrastructure, and analytics roles
   - Current take: only worth pursuing for clearly technical roles, and the live surface still needs verification

Reference files:

- `output/spreadsheet/appalachia-academic-tech-source-map.csv`
- `output/spreadsheet/appalachia-academic-institutions-queue.csv`
- `output/spreadsheet/pgh-career-connector-employer-leads.csv`

## Practical next move

If I were doing the next source pass, I would do it in this order:

1. Prototype a tightly filtered `Virginia Tech` path using the public `jobs.apply.vt.edu` search and the strongest tech-facing categories
2. Keep `WVU` in the queue, but only as a manual or semi-automated research lane unless public compensation appears
3. Continue mining `PGH Career Connector` and similar ecosystem boards for employer leads rather than forcing broad imports
4. Build on `KnoxTech` / `LaunchTN` selectively, using `getro` for discovery and only importing jobs that clear the compensation bar
5. Add `Generation WV` as the next “high-relevance, non-Pittsburgh” target when the current stronger direct surfaces are exhausted
6. Treat academic and research institutions as a separate filtered lane rather than folding them into the main employer-source logic too early

## Working principle

Prefer sources that do at least one of these:

- add a new Appalachian geography not yet well covered
- expose multiple real employers at once
- use a stable/public jobs platform
- help discover employer ATS pages we can ingest directly later

Avoid spending early engineering time on sources that are:

- mostly community discussion
- mostly form submissions or talent-resume workflows
- too brittle to scrape
- only adjacent to Appalachia instead of meaningfully in or tied to it
