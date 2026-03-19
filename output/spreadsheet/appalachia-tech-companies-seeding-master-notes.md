# Seeding Master Notes

This sheet is the operational control panel for seeding research.

## Key columns

- `SEED_PRIORITY`
  - `P1`: best current candidates to turn into source configs
  - `P2`: promising, but needs more setup or adapter work
  - `P3`: backlog or unsupported ATS
- `SEED_READY`
  - `ready`: already configured in the starter source config
  - `research`: plausible next source, but still needs verification or setup
  - `backlog`: not currently worth wiring up in the seeder
- `REVIEW_STATUS`
  - `configured`: already present in `sources.appalachia-starters.json`
  - `unreviewed`: not yet operationalized
- `SOURCE_IDENTIFIER`
  - Greenhouse board token, Lever account name, or similar source-specific identifier
- `ALLOWED_LOCATION_PATTERNS_JSON`
  - raw ATS location text patterns to keep
- `LOCATION_RULES_JSON`
  - maps ATS location text into HOLLER.WORKS state/region format

## Working rule

Use this sheet as the source of truth for what we want to ingest next. The current best next moves are the `P1` rows with `SEED_READY = research`.

## Companion source map

For non-company ecosystem and board sources, see:

- `output/spreadsheet/appalachia-ecosystem-source-map.csv`
- `docs/ecosystem-source-scouting.md`

Those files cover regional job boards, tech councils, and ecosystem organizations that can broaden the seeding pipeline beyond direct employer ATS pages.
