# Defense Employer Adapter Pass

Date checked: March 18, 2026

## What I tested

I investigated the employer lane that initially looked like an `Avature` opportunity:

- `Lockheed Martin`
- `Jacobs`
- `IBM`
- `Boeing`

## Main conclusion

`Avature` is **not** the right adapter family to build for this lane.

What looked like an Avature cluster turned out to be different non-job surfaces:

- `Lockheed Martin` Avature page is a talent network signup
- `Jacobs` Avature page is an events portal
- `IBM` Avature page is a talent/contact form
- `Boeing` Avature page is a military-veteran community portal

So an `Avature` adapter would not unlock the real public jobs boards we care about.

## What the real surfaces appear to be

### Lockheed Martin

- Public jobs search: `https://www.lockheedmartinjobs.com/search-jobs`
- Platform in practice: `TalentBrew / Radancy`
- Search page signals:
  - `tbcdn.talentbrew.com`
  - `module/postmodule`
  - `search-jobs/GetSearchRequestGeoLocation`
  - Algolia / InstantSearch client libraries on the page
- Additional legacy links also appear to point at `BrassRing`

Important compensation finding:

- sampled Huntsville technical roles such as `Automated Software Test Engineer`, `Cybersecurity Engineer - Early Career`, and `Embedded Software Engineer` did **not** expose public numeric compensation
- some non-Appalachian roles did expose compensation, which means the board is not uniformly comp-dark, but the Huntsville slice currently looks weak for HOLLER.WORKS policy

### Boeing

- Public jobs home: `https://jobs.boeing.com/`
- Platform in practice: also looks like `TalentBrew / Radancy`
- Shared signals with Lockheed:
  - `tbcdn.talentbrew.com`
  - `module/postmodule`
  - `SetSearchRequestGeoLocation`
- The page also links to a `Workday` login, but that did not look like the public search surface

This lane still needs a compensation reality check before adapter work would be justified.

### Jacobs

- The Avature page discovered here is `eventlisting`, not jobs
- Current read: not a job-ingestion target from that surface

### IBM

- The Avature-linked page is a talent-network/contact form, not a public jobs board
- Current read: not an Avature adapter candidate

## Operational takeaway

The real reusable family exposed by this pass is:

- `TalentBrew / Radancy`

Not:

- `Avature`

## Recommendation

Do **not** build an `Avature` adapter for these employers.

If this lane becomes the next engineering investment, the honest next adapter candidate is `TalentBrew / Radancy`, but only if at least one Appalachian technical slice shows reliable public compensation.
