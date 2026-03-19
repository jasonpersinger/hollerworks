# HOLLER.WORKS Seed Import Walkthrough

## What This Does

This workflow does two things:

1. `seed:jobs` pulls likely jobs from the configured company feeds and writes a review batch to JSON.
2. `seed:import` sends that JSON batch into the HOLLER.WORKS admin queue as `pending` posts.

Nothing is auto-published unless you explicitly import as `approved`.

## Before You Start

- Make sure you are in the project folder:
  - `cd /home/jason/HOLLERWORKS`
- Make sure you can log into `/admin` on the live site.
- Keep your admin session token private. It grants temporary admin access.

## Step 1: Generate a Seed Batch

Run:

`npm run seed:jobs -- --config scripts/seed-jobs/sources.appalachia-starters.json --out tmp/seed-starters.json --report tmp/seed-starters-report.json --limit 50`

What this does:

- reads the configured source feeds
- filters for relevant Appalachian / regional jobs
- scores and dedupes them
- writes the import-ready batch to `tmp/seed-starters.json`
- writes a summary report to `tmp/seed-starters-report.json`

## Step 2: Review the Output Files

Look at:

- `tmp/seed-starters.json`
- `tmp/seed-starters-report.json`

What to check:

- does the company mix look reasonable?
- are the titles relevant to HOLLER.WORKS?
- are there obvious false positives you would never approve?

This is your chance to sanity-check before anything reaches admin.

## Step 3: Log Into Admin

Open:

`https://holler.works/admin`

Complete the normal admin login flow.

You do not need to paste jobs into the admin textarea anymore if you use the CLI importer.

## Step 4: Copy Your Admin Session Token

In the browser on `/admin`:

1. open DevTools
2. open the Console tab
3. run:

`sessionStorage.getItem('hollerAdminSession')`

4. copy the returned token

Important:

- this token is temporary
- treat it like a password while it is active

## Step 5: Import the Batch to Pending Review

Back in your terminal, run:

`npm run seed:import -- --file tmp/seed-starters.json --token "PASTE_TOKEN_HERE" --status pending`

What this does:

- reads the JSON batch from disk
- sends it to the live `adminImportPosts` function
- imports in chunks of up to `50`
- places the posts into `pending review`

## Step 6: Review Inside Admin

Return to `/admin` and refresh if needed.

Now you can:

- approve good posts
- reject bad posts
- edit titles, descriptions, or metadata before approval
- delete anything obviously wrong

This is still a human-reviewed workflow. The scripts reduce typing; they do not replace judgment.

## Step 7: Repeat the Process

Once this feels comfortable, the normal loop is:

1. update source configs
2. run `seed:jobs`
3. inspect the report
4. copy admin token
5. run `seed:import`
6. review in admin

## Common Problems

### `Invalid admin session.`

Cause:

- the token is wrong
- the token expired
- you copied the wrong session storage value

Fix:

- log into `/admin` again
- rerun `sessionStorage.getItem('hollerAdminSession')`
- copy the fresh token

### The seeder returns too many bad jobs

Cause:

- source filters are too loose

Fix:

- tighten `includeKeywords`
- add `excludeKeywords`
- reduce `maxAccepted`
- tighten `allowedLocationPatterns`

### A company feed exists but is not configured

Cause:

- the ATS type may not be supported yet
- the source identifier may still be unknown

Fix:

- check the seeding master sheet
- add the company as a configured source once the feed is confirmed

## Recommended Default

For now, use:

- `--status pending`

That keeps everything in the moderation queue first, which is the safest operating mode for launch.
