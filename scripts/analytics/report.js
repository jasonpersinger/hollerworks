#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const PROJECT_ID = 'hollerworks-be0a1';
const REGION = 'us-central1';

function printHelp() {
  console.log([
    'Usage:',
    '  npm run analytics:report -- --token "$HOLLER_ADMIN_SESSION_TOKEN"',
    '',
    'Options:',
    '  --token      admin session token; defaults to HOLLER_ADMIN_SESSION_TOKEN env var',
    '  --out        output markdown path (default output/reports/analytics-snapshot.md)',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    token: process.env.HOLLER_ADMIN_SESSION_TOKEN || '',
    out: 'output/reports/analytics-snapshot.md',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--token') options.token = argv[i + 1] || '';
    if (arg === '--out') options.out = argv[i + 1] || options.out;
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.token) {
    throw new Error('Admin session token is required. Pass --token or set HOLLER_ADMIN_SESSION_TOKEN.');
  }

  return options;
}

async function fetchAdminSnapshot(token) {
  const response = await fetch(`https://${REGION}-${PROJECT_ID}.cloudfunctions.net/adminListPosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        token,
        status: 'approved',
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
  }
  return payload.result;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function buildMarkdown(snapshot) {
  const dashboard = snapshot.dashboard || {};
  const analytics = dashboard.analytics || {};
  const totals = analytics.totals || {};
  const funnel = analytics.funnel || {};
  const topPosts = analytics.topPosts || [];
  const daily = analytics.daily || [];

  const lines = [
    '# HOLLER.WORKS Analytics Snapshot',
    '',
    `Generated: ${new Date().toLocaleString('en-US')}`,
    '',
    '## Inventory',
    '',
    `- approved posts: ${formatNumber(snapshot.counts?.approved)}`,
    `- pending posts: ${formatNumber(snapshot.counts?.pending)}`,
    `- rejected posts: ${formatNumber(snapshot.counts?.rejected)}`,
    `- active alerts: ${formatNumber(dashboard.activeAlerts)}`,
    '',
    '## Last 7 Days',
    '',
    `- board views: ${formatNumber(totals.boardViews)}`,
    `- post views: ${formatNumber(totals.postViews)}`,
    `- apply clicks: ${formatNumber(totals.applyClicks)}`,
    `- alert signups: ${formatNumber(totals.alertSignups)}`,
    `- successful submissions: ${formatNumber(totals.submitSuccesses)}`,
    '',
    '## Funnel',
    '',
    `- post views per board view: ${Number(funnel.postViewsPerBoardView || 0)}%`,
    `- apply clicks per post view: ${Number(funnel.appliesPerPostView || 0)}%`,
    `- apply clicks per board view: ${Number(funnel.appliesPerBoardView || 0)}%`,
    `- alert signups per board view: ${Number(funnel.alertsPerBoardView || 0)}%`,
    `- submissions per board view: ${Number(funnel.submissionsPerBoardView || 0)}%`,
    '',
    '## Daily Activity',
    '',
    '| day | board views | post views | apply clicks | alerts | submissions |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...daily.map(row => `| ${row.dayKey} | ${formatNumber(row.boardViews)} | ${formatNumber(row.postViews)} | ${formatNumber(row.applyClicks)} | ${formatNumber(row.alertSignups)} | ${formatNumber(row.submitSuccesses)} |`),
    '',
    '## Top Posts',
    '',
    '| title | company | post views | apply clicks | apply rate |',
    '| --- | --- | ---: | ---: | ---: |',
    ...(topPosts.length
      ? topPosts.map(post => `| ${post.title || 'untitled'} | ${post.companyName || ''} | ${formatNumber(post.postViews)} | ${formatNumber(post.applyClicks)} | ${Number(post.applyRate || 0)}% |`)
      : ['| no data yet |  | 0 | 0 | 0% |']),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await fetchAdminSnapshot(options.token);
  const markdown = buildMarkdown(snapshot);
  const outPath = path.resolve(process.cwd(), options.out);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, markdown);
  console.log(`wrote analytics snapshot to ${outPath}`);
}

main().catch(error => {
  console.error(`analytics:report failed: ${error.message}`);
  process.exit(1);
});
