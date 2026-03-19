#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const PROJECT_ID = 'hollerworks-be0a1';
const REGION = 'us-central1';
const DEFAULT_STATUS = 'pending';
const MAX_BATCH_SIZE = 50;

function printHelp() {
  console.log([
    'Usage:',
    '  npm run seed:import -- --file tmp/seed-starters.json --token "$HOLLER_ADMIN_SESSION_TOKEN"',
    '',
    'Options:',
    '  --file       path to the seed JSON file (required)',
    '  --token      admin session token; defaults to HOLLER_ADMIN_SESSION_TOKEN env var',
    '  --status     import status: pending or approved (default pending)',
    '',
    'Tip:',
    "  In the browser on /admin, run: sessionStorage.getItem('hollerAdminSession')",
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    file: '',
    token: process.env.HOLLER_ADMIN_SESSION_TOKEN || '',
    status: DEFAULT_STATUS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') options.file = argv[i + 1] || '';
    if (arg === '--token') options.token = argv[i + 1] || '';
    if (arg === '--status') options.status = argv[i + 1] || DEFAULT_STATUS;
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  if (!options.file) {
    printHelp();
    throw new Error('--file is required');
  }
  if (!options.token) {
    throw new Error('Admin session token is required. Pass --token or set HOLLER_ADMIN_SESSION_TOKEN.');
  }
  if (!['pending', 'approved'].includes(options.status)) {
    throw new Error('--status must be pending or approved');
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function callAdminImport({ token, status, posts }) {
  const response = await fetch(`https://${REGION}-${PROJECT_ID}.cloudfunctions.net/adminImportPosts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        token,
        status,
        posts,
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload?.error?.message || `Import failed with ${response.status}`;
    throw new Error(message);
  }
  return payload.result || payload.data || payload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), options.file);
  const posts = await readJson(filePath);
  if (!Array.isArray(posts) || !posts.length) {
    throw new Error('Import file must be a non-empty JSON array.');
  }

  const batches = chunk(posts, MAX_BATCH_SIZE);
  let imported = 0;
  const importedIds = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const result = await callAdminImport({
      token: options.token,
      status: options.status,
      posts: batch,
    });
    imported += Number(result.count || 0);
    if (Array.isArray(result.ids)) importedIds.push(...result.ids);
    console.log(`batch ${index + 1}/${batches.length}: imported ${result.count} posts to ${options.status}`);
  }

  console.log(`done: imported ${imported} posts from ${path.basename(filePath)}`);
  if (importedIds.length) {
    console.log(`ids: ${importedIds.join(', ')}`);
  }
}

main().catch(error => {
  console.error(`seed:import failed: ${error.message}`);
  process.exit(1);
});
