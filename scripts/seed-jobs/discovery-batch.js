#!/usr/bin/env node

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function printHelp() {
  console.log([
    'Usage:',
    '  npm run seed:discover -- --manifest scripts/seed-jobs/discovery-manifest.json',
    '',
    'Options:',
    '  --manifest   discovery manifest JSON (required)',
    '  --out        combined review-ready batch JSON',
    '  --report     combined discovery report JSON',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    manifest: '',
    out: 'tmp/discovery-batch.json',
    report: 'tmp/discovery-batch-report.json',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') options.manifest = argv[index + 1] || '';
    if (arg === '--out') options.out = argv[index + 1] || options.out;
    if (arg === '--report') options.report = argv[index + 1] || options.report;
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  if (!options.manifest) {
    printHelp();
    throw new Error('--manifest is required');
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildFingerprint(post) {
  return [
    normalizeKey(post.title),
    normalizeKey(post.companyName),
    normalizeKey(post.contact),
  ].join('|');
}

async function runSeedCli({ configPath, outPath, reportPath, minScore, limit, perSourceLimit }) {
  const args = [
    path.resolve('scripts/seed-jobs/cli.js'),
    '--config', configPath,
    '--out', outPath,
    '--report', reportPath,
  ];
  if (typeof minScore === 'number') {
    args.push('--min-score', String(minScore));
  }
  if (typeof limit === 'number') {
    args.push('--limit', String(limit));
  }
  if (typeof perSourceLimit === 'number' && perSourceLimit > 0) {
    args.push('--per-source-limit', String(perSourceLimit));
  }
  await execFileAsync('node', args, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 20,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), options.manifest);
  const manifest = await readJson(manifestPath);
  const targetCount = Number(manifest.targetCount || 15);
  const defaultMinScore = Number(manifest.minScore || 35);
  const defaultLimit = Number(manifest.limit || targetCount);
  const defaultPerSourceLimit = Number(manifest.perSourceLimit || 0);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  if (!entries.length) {
    throw new Error('Discovery manifest must include at least one entry.');
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'holler-discovery-'));
  const finalBatch = [];
  const seen = new Set();
  const entryReports = [];

  try {
    for (let index = 0; index < entries.length; index += 1) {
      if (finalBatch.length >= targetCount) break;

      const entry = entries[index];
      const sourceConfigPath = path.resolve(process.cwd(), entry.config);
      const sourceConfig = await readJson(sourceConfigPath);
      const sourceNames = Array.isArray(entry.sourceNames) ? entry.sourceNames : [];

      if (sourceNames.length) {
        sourceConfig.sources = (Array.isArray(sourceConfig.sources) ? sourceConfig.sources : [])
          .filter(source => sourceNames.includes(source.name));
      }

      if (!Array.isArray(sourceConfig.sources) || !sourceConfig.sources.length) {
        entryReports.push({
          label: entry.label || entry.config,
          config: entry.config,
          sourceNames,
          error: 'No sources matched this entry.',
          acceptedIntoBatch: 0,
        });
        continue;
      }

      const safeLabel = (entry.label || path.basename(entry.config, '.json'))
        .replace(/[^a-z0-9_-]+/gi, '-')
        .toLowerCase();
      const tempConfigPath = path.join(tmpRoot, `${String(index + 1).padStart(2, '0')}-${safeLabel}.json`);
      const tempOutPath = path.join(tmpRoot, `${String(index + 1).padStart(2, '0')}-${safeLabel}-out.json`);
      const tempReportPath = path.join(tmpRoot, `${String(index + 1).padStart(2, '0')}-${safeLabel}-report.json`);
      await writeJson(tempConfigPath, sourceConfig);

      try {
        await runSeedCli({
          configPath: tempConfigPath,
          outPath: tempOutPath,
          reportPath: tempReportPath,
          minScore: entry.minScore ?? defaultMinScore,
          limit: entry.limit ?? defaultLimit,
          perSourceLimit: entry.perSourceLimit ?? defaultPerSourceLimit,
        });

        const posts = await readJson(tempOutPath);
        const report = await readJson(tempReportPath);
        let acceptedIntoBatch = 0;
        for (const post of Array.isArray(posts) ? posts : []) {
          const fingerprint = buildFingerprint(post);
          if (!fingerprint || seen.has(fingerprint)) continue;
          seen.add(fingerprint);
          finalBatch.push(post);
          acceptedIntoBatch += 1;
          if (finalBatch.length >= targetCount) break;
        }

        entryReports.push({
          label: entry.label || entry.config,
          config: entry.config,
          sourceNames,
          outputCount: Array.isArray(posts) ? posts.length : 0,
          acceptedIntoBatch,
          rawCount: report.rawCount || 0,
          sourceCount: Array.isArray(report.sources) ? report.sources.length : 0,
          acceptedCount: Array.isArray(report.accepted) ? report.accepted.length : 0,
          rejectedCount: Array.isArray(report.rejected) ? report.rejected.length : 0,
        });
      } catch (error) {
        entryReports.push({
          label: entry.label || entry.config,
          config: entry.config,
          sourceNames,
          error: error.message,
          acceptedIntoBatch: 0,
        });
      }
    }
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }

  const batchPath = path.resolve(process.cwd(), options.out);
  const reportPath = path.resolve(process.cwd(), options.report);
  await writeJson(batchPath, finalBatch);
  await writeJson(reportPath, {
    generatedAt: new Date().toISOString(),
    manifestPath,
    targetCount,
    batchCount: finalBatch.length,
    targetReached: finalBatch.length >= targetCount,
    entries: entryReports,
  });

  console.log(`discovery entries processed: ${entryReports.length}`);
  console.log(`batch size: ${finalBatch.length}`);
  console.log(`target reached: ${finalBatch.length >= targetCount ? 'yes' : 'no'}`);
  console.log(`output path: ${batchPath}`);
}

main().catch(error => {
  console.error(`seed:discover failed: ${error.message}`);
  process.exit(1);
});
