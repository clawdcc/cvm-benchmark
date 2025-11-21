#!/usr/bin/env node
/**
 * Update Benchmark Script
 *
 * Benchmarks newly installed Claude Code versions and appends results to historical data.
 *
 * Workflow:
 * 1. Load existing benchmark history from data/benchmarks.json
 * 2. Get all installed CVM versions
 * 3. Identify new versions not yet benchmarked
 * 4. Run 2 benchmark runs with 3 requests each (2x3 = 6 total runs per version)
 * 5. Append new results to existing data
 * 6. Save updated benchmarks.json
 *
 * Usage:
 *   npm run benchmark:update
 *   npm run benchmark:update -- --force  # Re-benchmark all versions
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BENCHMARKS_FILE = path.join(DATA_DIR, 'benchmarks.json');

// Parse CLI args
const args = process.argv.slice(2);
const FORCE_REBENCHMARK = args.includes('--force');

/**
 * Load existing benchmark data
 */
async function loadExistingBenchmarks() {
  try {
    const data = await fs.readFile(BENCHMARKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📋 No existing benchmark data found, starting fresh');
      return { versions: {}, metadata: { lastUpdated: null, totalRuns: 0 } };
    }
    throw error;
  }
}

/**
 * Get all installed CVM versions
 */
async function getInstalledVersions() {
  return new Promise((resolve, reject) => {
    const proc = spawn('cvm', ['list', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Fallback: parse text output
        const versions = [];
        const lines = stdout.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*(?:\*)?\s*(\d+\.\d+\.\d+)/);
          if (match) {
            versions.push(match[1]);
          }
        }
        resolve(versions);
      } else {
        try {
          const data = JSON.parse(stdout);
          resolve(data.versions || []);
        } catch {
          reject(new Error('Failed to parse CVM output'));
        }
      }
    });
  });
}

/**
 * Run benchmark for specific versions
 */
async function runBenchmark(versions) {
  return new Promise((resolve, reject) => {
    const args = [
      'run',
      '--include',
      ...versions,
      '--runs',
      '3',
      '--no-cleanup',
    ];

    console.log(`\n📊 Running benchmark: cvm-benchmark ${args.join(' ')}`);

    const proc = spawn('./bin/cvm-benchmark.js', args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Load latest benchmark run from ~/.cvm/benchmarks/
 */
async function loadLatestBenchmarkRun() {
  const benchmarkDir = path.join(process.env.HOME, '.cvm', 'benchmarks');
  const runs = await fs.readdir(benchmarkDir);

  // Find highest run number
  const runNumbers = runs
    .filter(name => name.startsWith('run-'))
    .map(name => parseInt(name.replace('run-', '')))
    .filter(n => !isNaN(n));

  if (runNumbers.length === 0) {
    throw new Error('No benchmark runs found');
  }

  const latestRun = Math.max(...runNumbers);
  const runDir = path.join(benchmarkDir, `run-${latestRun}`);

  // Load results
  const resultsFile = path.join(runDir, 'results.json');
  const data = await fs.readFile(resultsFile, 'utf-8');
  return JSON.parse(data);
}

/**
 * Merge new results into existing data
 */
function mergeResults(existing, newResults) {
  const merged = { ...existing };

  for (const versionResult of newResults.versions) {
    const version = versionResult.version;

    if (!merged.versions[version]) {
      merged.versions[version] = {
        version,
        runs: [],
      };
    }

    // Append new runs
    merged.versions[version].runs.push({
      timestamp: newResults.metadata.endTime,
      versionSpawn: versionResult.versionSpawn,
      interactive: versionResult.interactive,
    });
  }

  // Update metadata
  merged.metadata.lastUpdated = new Date().toISOString();
  merged.metadata.totalRuns = Object.values(merged.versions).reduce(
    (sum, v) => sum + v.runs.length,
    0
  );

  return merged;
}

/**
 * Save benchmark data
 */
async function saveBenchmarks(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n✅ Saved benchmark data to ${BENCHMARKS_FILE}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting benchmark update...\n');

  // Load existing data
  const existing = await loadExistingBenchmarks();
  console.log(`📂 Loaded ${Object.keys(existing.versions).length} previously benchmarked versions`);

  // Get installed versions
  const installed = await getInstalledVersions();
  console.log(`📦 Found ${installed.length} installed versions\n`);

  // Determine versions to benchmark
  let toBenchmark;
  if (FORCE_REBENCHMARK) {
    console.log('🔄 --force flag set, re-benchmarking all versions');
    toBenchmark = installed;
  } else {
    const alreadyBenchmarked = new Set(Object.keys(existing.versions));
    toBenchmark = installed.filter(v => !alreadyBenchmarked.has(v));

    if (toBenchmark.length === 0) {
      console.log('✅ All installed versions already benchmarked');
      console.log('   Use --force to re-benchmark all versions');
      return;
    }

    console.log(`🆕 Found ${toBenchmark.length} new version(s) to benchmark:`);
    toBenchmark.forEach(v => console.log(`   - ${v}`));
  }

  // Run 2 benchmark runs
  console.log('\n📊 Running 2 benchmark runs (3 requests each)...\n');

  for (let i = 1; i <= 2; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 Benchmark Run ${i}/2`);
    console.log('='.repeat(60));

    await runBenchmark(toBenchmark);

    // Load and merge results
    const newResults = await loadLatestBenchmarkRun();
    const merged = mergeResults(existing, newResults);

    // Save after each run
    await saveBenchmarks(merged);

    // Update existing for next run
    Object.assign(existing, merged);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Benchmark update complete!');
  console.log('='.repeat(60));
  console.log(`\n📈 Total versions benchmarked: ${Object.keys(existing.versions).length}`);
  console.log(`📊 Total benchmark runs: ${existing.metadata.totalRuns}`);
  console.log(`📁 Data saved to: ${BENCHMARKS_FILE}\n`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
