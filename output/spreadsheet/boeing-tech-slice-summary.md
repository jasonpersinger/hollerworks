# Boeing Tech Slice Summary

Date checked: March 18, 2026

## Current take

`Boeing` is now a real HOLLER.WORKS source candidate through the new `talentbrew` adapter.

- Official public jobs site: `https://jobs.boeing.com/`
- Platform in practice: `TalentBrew / Radancy`
- Regional tie for this slice: `Huntsville, Alabama`

## Why this matters

This is the first confirmed `TalentBrew / Radancy` employer in the seeding toolkit that produced a clean, salary-bearing technical slice in-region.

That makes it more important than a one-off source:

- it proves the new adapter works end-to-end
- it gives us a real Huntsville employer candidate
- it suggests other TalentBrew-backed employers may be worth probing, but only after compensation is verified

## Current eval result

Focused eval config:

- `scripts/seed-jobs/sources.boeing-eval.json`

Output:

- `tmp/boeing-eval.json`
- `tmp/boeing-eval-report.json`

Run result:

- `15` raw jobs fetched
- `5` accepted
- `10` rejected
- `5` final output jobs

## Clean kept roles

- `Software Engineers–Hardware Emulation (Associate, Experienced, Senior)` with compensation `$160,650 - $217,350`
- `Entry-Level Systems Engineer` with compensation `$73,950 - $100,050`
- `Associate Systems Engineer` with compensation `$91,800 - $124,200`
- `Systems Engineer (Senior or Principal)` with compensation `$197,200 - $266,800`
- `Systems Engineer (Experienced or Lead)` with compensation `$136,850 - $185,150`

All kept roles mapped cleanly to:

- `Alabama`
- `Northern Alabama`
- `Huntsville`

## Noise that was correctly rejected

The first eval correctly filtered out non-target roles such as:

- business development
- engineering manager
- manufacturing planner
- quality engineer
- product review / liaison engineering
- electrical design and test engineering

## Recommendation

`Boeing` is a legitimate eval-stage source now.

Recommended next move:

1. review the current `5`-role slice for product fit
2. if those listings look good in admin review, use that approval as the promotion gate
3. only then consider adding Boeing to the promoted starter rotation
