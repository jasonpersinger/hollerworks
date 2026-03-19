# Radiance Technologies Tech Slice Summary

Date checked: March 18, 2026

## Current take

`Radiance Technologies` is a real employer-source candidate for HOLLER.WORKS.

- Official careers page: `https://www.radiancetech.com/careers/`
- Live ATS surface discovered from the official page: `https://radiancetech.wd12.myworkdayjobs.com/Radiance_External`
- Platform in practice: `Workday`
- Regional tie: strong Huntsville, Alabama employer

## Why it matters

Radiance is valuable for the same reason Northrop was valuable:

- strong Huntsville tie
- real technical inventory
- official public jobs surface
- some public salary-bearing roles that explicitly include `Huntsville, AL`

## Proven clean slice

A focused first pass produced a clean salary-bearing Huntsville-adjacent lane built from multi-location Radiance roles whose location set includes `Huntsville, AL`.

Best confirmed roles from the current board:

- `Site Reliability Engineer (SRE)` with salary range `$75,000 - $100,000`
- `Senior Site Reliability Engineer` with salary range `$90,000 - $135,000`
- `Software Architect` with salary range `$100,000 - $130,000`
- `Quality Assurance (QA) Automation Engineer` with salary range `$75,000 - $135,000`

These roles currently present with a base location in `Beavercreek, OH`, but the public detail pages also list `Huntsville, AL` as an additional location, which keeps them in-bounds for the Appalachia/Huntsville sourcing lane.

## Current blockers and cautions

The board also has some Huntsville-only technical roles that do **not** currently expose public compensation, including:

- `Test Engineer`
- `Senior Reverse Engineer`

That means Radiance is promising, but the import path should stay selective:

- keep the salary-bearing multi-location technical roles
- reject the Huntsville-only roles that miss compensation
- keep management, customer success, RF/radar, and non-software engineering noise out of the first batch

## Operational note

A reusable eval config now exists at:

- `scripts/seed-jobs/sources.radiance-eval.json`

Recommended next move:

1. run the Radiance eval config
2. inspect the resulting batch for title quality and compensation retention
3. if the approved output still looks clean, prepare it for review/import before promotion
