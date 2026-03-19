# HOLLER.WORKS Seeding Automation

This is the first-pass seeding toolkit for HOLLER.WORKS. It is intentionally review-first: it collects jobs from structured sources, normalizes them into the existing admin import format, scores them for relevance, and writes JSON you can paste into the admin `seed / import posts` panel.

It does **not** auto-publish anything.

## Goals

- reduce copy/paste work
- keep the board tech-only and Appalachia-aware
- make it easy to start with `5-10` known-good sources
- avoid turning the board into a junk mirror

## Current source types

- `greenhouse`
- `lever`
- `ashby`
- `pcs`
- `primepay-recruit`
- `getro`
- `dicks-jobs`
- `peopleadmin`
- `peopleadmin-atom`
- `talentbrew`
- `virginia-tech`
- `json-file`

The `json-file` source exists for two reasons:

- quick manual bootstrapping
- testing the pipeline without hitting live endpoints

The `pcs` source is a public Eightfold/PCS adapter:

- it uses the board's public `/api/pcsx/search` and `/api/pcsx/position_details` endpoints
- it works well for sources like Northrop Grumman where the official careers site is PCS-backed
- it still benefits from tight query and location filters, because broad PCS boards can be extremely large

The `getro` source is useful for regional ecosystem boards like `jobs.knoxtech.org` and `jobs.launchtn.org`, but it currently has an important limitation:

- it fetches the first visible board page and then follows each job into its detail page
- that is enough to get real descriptions and company domains
- it is **not** yet a full-board pagination adapter

In practice, that makes `getro` best for:

- targeted evaluation
- employer discovery
- selective sourcing from curated regional boards

The `dicks-jobs` source is a narrow public-careers adapter for the Dick's Sporting Goods jobs site:

- it paginates the public `Technology` search surface
- it follows each public job detail page for description, apply URL, and pay range
- it exists so approved Pittsburgh-based Dick's technology roles can live in the promoted starter rotation without relying on a frozen JSON batch

The `virginia-tech` source is a narrow browser-backed adapter for the public `jobs.apply.vt.edu` surface:

- it uses Playwright because the site is fronted by an AWS WAF challenge
- it fetches a tightly filtered category slice instead of the whole board
- it is meant for evaluation and careful expansion, not blind broad import

The `peopleadmin` source is a lightweight higher-ed adapter for public PeopleAdmin search/detail pages:

- it follows public `/postings/search` results into detail pages
- it can pull salary when the posting exposes a salary range
- it still benefits from source-specific location rules, because institutions often use internal campus codes instead of city names

The `peopleadmin-atom` source is the faster discovery-oriented sibling:

- it pulls from a public `/postings/all_jobs.atom` feed instead of paginating the search page
- it follows each feed entry into the job detail page
- it is useful for wide academic discovery sweeps where we want to find salary-bearing technical roles across several institutions quickly
- it still needs tight title/department filters, because raw higher-ed feeds are noisy

The `talentbrew` source is a public HTML adapter for TalentBrew / Radancy career sites:

- it reads the public search results page and follows `/job/...` detail pages
- it works best when the source config uses a tightly scoped `searchUrl`
- it is a good fit for employers whose official jobs sites look custom on the surface but are actually TalentBrew-backed underneath, such as Boeing

## How it works

Flow:

1. fetch jobs from each source
2. normalize the fields to the HOLLER.WORKS import shape
3. classify the job into an existing category
4. score relevance
5. reject jobs that fail validation, miss compensation, or look non-tech
6. dedupe within the run
7. write a review-ready JSON array plus a report

## Usage

```bash
npm run seed:jobs -- --config scripts/seed-jobs/sources.example.json
```

For a no-network smoke check:

```bash
npm run seed:jobs -- --config scripts/seed-jobs/sources.fixture.json
```

Optional flags:

```bash
npm run seed:jobs -- \
  --config scripts/seed-jobs/sources.example.json \
  --out tmp/seed-import.json \
  --report tmp/seed-report.json \
  --min-score 40 \
  --limit 50 \
  --per-source-limit 15
```

For multi-source discovery batching:

```bash
npm run seed:discover -- \
  --manifest scripts/seed-jobs/discovery-manifest.json \
  --out tmp/discovery-batch.json \
  --report tmp/discovery-batch-report.json
```

That discovery runner:

1. runs a sequence of candidate source configs
2. accumulates clean, deduped jobs across them
3. stops once it reaches the target batch size in the manifest
4. writes a combined review batch plus a per-entry report

This is intended for the newer workflow:

- let discovery run in the background across many candidate sources
- only stop and ask for an admin token once the batch is big enough and clean enough to review

Output files:

- import JSON: `tmp/seed-import.json`
- processing report: `tmp/seed-report.json`
- discovery batch JSON: `tmp/discovery-batch.json`
- discovery batch report: `tmp/discovery-batch-report.json`

## Importing a reviewed batch

Once you have a JSON file you want to send to the admin queue:

1. Log into `/admin` in the browser.
2. Open DevTools console.
3. Run:

```js
sessionStorage.getItem('hollerAdminSession')
```

4. Copy the token.
5. Run the importer:

```bash
npm run seed:import -- \
  --file tmp/seed-starters.json \
  --token "PASTE_ADMIN_SESSION_TOKEN_HERE" \
  --status pending
```

The importer will batch automatically in groups of `50`, which matches the backend import limit.

Starter config for real feeds:

```bash
npm run seed:jobs -- --config scripts/seed-jobs/sources.appalachia-starters.json --out tmp/seed-starters.json --report tmp/seed-starters-report.json --limit 50
```

## Source config shape

Each source should provide enough information for the board's stricter validation rules.

Example:

```json
{
  "name": "Example Greenhouse Source",
  "type": "greenhouse",
  "boardToken": "example-company",
  "companyName": "Example Company",
  "companyWebsite": "https://example.com",
  "locationState": "West Virginia",
  "locationRegion": "Northern WV",
  "sourceWeight": 15,
  "includeKeywords": ["engineer", "developer", "docs"]
}
```

Important fields:

- `companyWebsite`
  Required for importable job posts.
- `locationState` and `locationRegion`
  Strongly recommended. The board requires a valid Appalachian state/region pair. For now, the safest approach is to set these per source rather than trying to infer them automatically.
- `sourceWeight`
  Lets trusted sources score a little higher.
- `includeKeywords` / `excludeKeywords`
  Simple quality control for mixed-role job feeds.
- `defaultCompensation`
  Optional, but use carefully. The board policy expects compensation to be real.
- `maxAccepted`
  Lets you cap how many listings a single source can contribute to the final output, which is useful when one high-volume company would otherwise dominate the batch.
- `dedupeByTitleLocation`
  Optional. When true, the seeder keeps only one final-output job per normalized title/company/location combination for that source. This is useful for ATSes that surface near-identical reposts or multi-ID variants.
- `allowedLocationPatterns`
  Useful for mixed-location ATS feeds. Jobs whose raw location text does not match one of these patterns get dropped early.
- `locationRules`
  Maps raw ATS location text into the state/region format HOLLER.WORKS expects.
- `boardUrl`
  Required for `getro` sources. This should point at the board's `/jobs` page.

Example:

```json
{
  "allowedLocationPatterns": ["Pittsburgh, PA", "Cleveland, OH"],
  "locationRules": [
    {
      "match": "Pittsburgh, PA",
      "locationState": "Pennsylvania",
      "locationRegion": "Western PA",
      "locationCity": "Pittsburgh"
    },
    {
      "match": "Cleveland, OH",
      "locationState": "Ohio",
      "locationRegion": "Northeast Ohio",
      "locationCity": "Cleveland"
    }
  ]
}
```

Example `getro` source:

```json
{
  "name": "KnoxTech Job Board",
  "type": "getro",
  "boardUrl": "https://jobs.knoxtech.org/jobs",
  "sourceWeight": 10,
  "allowedLocationPatterns": ["Knoxville, TN", "Oak Ridge, TN", "Remote"],
  "locationRules": [
    {
      "match": "Oak Ridge, TN",
      "locationState": "Tennessee",
      "locationRegion": "East Tennessee",
      "locationCity": "Oak Ridge"
    },
    {
      "match": "Remote",
      "locationState": "Tennessee",
      "locationRegion": "East Tennessee",
      "locationCity": "Remote",
      "remoteFriendly": true
    }
  ],
  "includeKeywords": ["engineer", "developer", "data", "security"],
  "excludeKeywords": ["cashier", "guest services", "administrative assistant"]
}
```

Example `virginia-tech` source:

```json
{
  "name": "Virginia Tech Tech Slice",
  "type": "virginia-tech",
  "searchUrl": "https://jobs.apply.vt.edu/jobs/search",
  "companyName": "Virginia Tech",
  "companyWebsite": "https://www.vt.edu",
  "maxPages": 2,
  "maxDetailJobs": 12,
  "categoryFilters": [
    {
      "name": "Information Systems / Technology",
      "value": "3c1b6a423b6ee41c8f5d5908a7e4b53f"
    }
  ]
}
```

## What the tool outputs

The output is already shaped for the admin importer:

```json
{
  "title": "Frontend Engineer",
  "category": "Software & Dev",
  "companyName": "Mountain Software Co.",
  "companyWebsite": "https://mountainsoftware.example/",
  "locationState": "West Virginia",
  "locationRegion": "Northern WV",
  "locationCity": "Morgantown",
  "compensation": "$95k-$120k per year",
  "description": "Build UI for a regional software product...",
  "contact": "https://mountainsoftware.example/jobs/frontend-engineer",
  "remoteFriendly": true,
  "sourceUrl": "https://mountainsoftware.example/jobs/frontend-engineer",
  "seedScore": 75,
  "seedNotes": ["Appalachia tie +25", "remote-friendly +15"]
}
```

The extra `seed*` fields are only there to help with review before import.

## Recommended first rollout

Start small.

- pick `5-10` known-good employers or boards
- prefer ATS-backed sources first
- review the output JSON manually
- import as `pending`, not `approved`

That gets you to a useful first batch without overbuilding the system.

## Getro evaluation note

The first live `getro` evaluation surfaced one important operational truth:

- the adapter works
- the job detail pages are rich enough to use
- but many regional board postings still fail HOLLER.WORKS validation because compensation is missing

That means `getro` boards are currently best treated as:

- a selective source for compensation-explicit roles
- a discovery layer for employers worth following up directly

Example evaluation run:

```bash
npm run seed:jobs -- \
  --config scripts/seed-jobs/sources.getro-evaluation.json \
  --out tmp/seed-getro-eval.json \
  --report tmp/seed-getro-eval-report.json \
  --limit 20
```

## Virginia Tech evaluation note

The first `virginia-tech` prototype was more encouraging than the university lane usually is:

- the public search surface is filterable
- sampled tech-role detail pages expose compensation
- a capped first pass fetched `12` roles and accepted `6`

The current limitations are more about tightening than viability:

- browser-backed fetching is slower because of the AWS WAF challenge
- some role categorization still benefits from title-specific cleanup
- the first pass should stay capped and filtered rather than trying to ingest the whole board

Example evaluation run:

```bash
npm run seed:jobs -- \
  --config scripts/seed-jobs/sources.virginia-tech-eval.json \
  --out tmp/seed-virginia-tech.json \
  --report tmp/seed-virginia-tech-report.json \
  --limit 20
```

At this point, `Virginia Tech` has cleared the bar to join the regular starter rotation as a capped, filtered source.

## Marshall evaluation note

`Marshall University` is now a narrow `peopleadmin` prototype rather than a broad source:

- the public search surface is real
- campus-code mapping now handles `MU - Marshall University` and `MUSOM - Marshall University School of Medicine`
- a tightened title/department filter collapses the noisy facilities/admin mix down to one clean in-bounds role
- the current accepted role is `Client Services Analyst`, with visible compensation and a clean `IT & Support` mapping

That makes Marshall a viable academic lane, but only as a narrow manual or periodic source for now. It has not earned promotion into the regular starter rotation yet.

## Abridge startup note

`Abridge` is now in the regular starter rotation as a capped Ashby startup slice. Its public board exposes compensation cleanly, Pittsburgh-aware secondary locations make the Appalachia fit usable, and the first filtered pass produced three reviewable technical roles.

## Workable startup note

`Workable` is now a supported source type in the seeder, but the first startup result is deliberately modest:

- `Jetpack Workflow` uses a real public Workable board
- the new adapter successfully processes that board through the normal seeding CLI
- the current public board has `0` openings, so it stays in the queue as a ready research lane rather than a live import source

That is still useful progress. It means we can stop treating Workable as a blocker and start judging Workable startups on actual role quality and compensation visibility instead.

## Next improvements

- add Paylocity, ApplyToJob, or BambooHR adapters only if compensation visibility improves enough to justify them
- store source fingerprints so dedupe works across runs
- add compensation parsing improvements
- add a one-command admin import path instead of manual paste
- optionally save rejected-job reasons to a CSV for review
