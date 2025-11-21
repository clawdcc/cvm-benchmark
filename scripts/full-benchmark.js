#!/usr/bin/env node
/**
 * Full Benchmark Script with Installation
 *
 * Complete workflow: install versions → benchmark → optionally cleanup
 *
 * Features:
 * - Installs all (or filtered) Claude Code versions via CVM
 * - Runs comprehensive benchmark suite
 * - Supports incremental updates (only new versions)
 * - Optional cleanup after benchmarking
 *
 * Environment Variables:
 *   BENCH_FROM=2.0.0       # Minimum version to install/benchmark
 *   BENCH_TO=2.0.50        # Maximum version to install/benchmark
 *   BENCH_LIMIT=10         # Limit to N latest versions
 *   BENCH_SAMPLES=3        # Samples per benchmark (default: 3)
 *   BENCH_RUNS=2           # Number of complete suite runs (default: 2)
 *   BENCH_CLEANUP=true     # Uninstall versions after benchmark (default: false)
 *   BENCH_INCREMENTAL=true # Only install/benchmark new versions (default: false)
 *
 * Usage:
 *   # Full: Install all versions, benchmark, keep installed
 *   npm run benchmark:full
 *
 *   # Full: Install, benchmark, then cleanup
 *   BENCH_CLEANUP=true npm run benchmark:full
 *
 *   # Incremental: Only new versions
 *   BENCH_INCREMENTAL=true npm run benchmark:full
 *
 *   # Range: Install and benchmark 2.0.x only
 *   BENCH_FROM=2.0.0 BENCH_TO=2.0.50 npm run benchmark:full
 *
 *   # Quick test: Latest 5 versions
 *   BENCH_LIMIT=5 npm run benchmark:full
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse environment configuration
const FROM_VERSION = process.env.BENCH_FROM;
const TO_VERSION = process.env.BENCH_TO;
const LIMIT = process.env.BENCH_LIMIT ? parseInt(process.env.BENCH_LIMIT) : undefined;
const SAMPLES = process.env.BENCH_SAMPLES ? parseInt(process.env.BENCH_SAMPLES) : 3;
const RUNS = process.env.BENCH_RUNS ? parseInt(process.env.BENCH_RUNS) : 2;
const CLEANUP = process.env.BENCH_CLEANUP === 'true';
const INCREMENTAL = process.env.BENCH_INCREMENTAL === 'true';

/**
 * Execute shell command
 */
function exec(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Get all available versions from npm registry
 */
async function getAvailableVersions() {
  console.log('📋 Fetching available Claude Code versions from npm...');

  const { stdout } = await exec('cvm', ['list-remote', '--json'], { silent: true });

  try {
    const data = JSON.parse(stdout);
    return data.versions || [];
  } catch {
    // Fallback: parse text output
    const lines = stdout.split('\n');
    const versions = [];
    for (const line of lines) {
      const match = line.match(/^\s*(\d+\.\d+\.\d+)/);
      if (match) {
        versions.push(match[1]);
      }
    }
    return versions;
  }
}

/**
 * Get currently installed versions
 */
async function getInstalledVersions() {
  const { stdout } = await exec('cvm', ['list', '--json'], { silent: true });

  try {
    const data = JSON.parse(stdout);
    return data.versions || [];
  } catch {
    const lines = stdout.split('\n');
    const versions = [];
    for (const line of lines) {
      const match = line.match(/^\s*(?:\*)?\s*(\d+\.\d+\.\d+)/);
      if (match) {
        versions.push(match[1]);
      }
    }
    return versions;
  }
}

/**
 * Filter versions based on config
 */
function filterVersions(versions) {
  let filtered = [...versions];

  // Apply from/to filters
  if (FROM_VERSION) {
    filtered = filtered.filter(v => compareVersions(v, FROM_VERSION) >= 0);
  }
  if (TO_VERSION) {
    filtered = filtered.filter(v => compareVersions(v, TO_VERSION) <= 0);
  }

  // Sort versions
  filtered.sort(compareVersions);

  // Apply limit (take last N = latest N)
  if (LIMIT) {
    filtered = filtered.slice(-LIMIT);
  }

  return filtered;
}

/**
 * Compare semantic versions
 */
function compareVersions(a, b) {
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

/**
 * Install a version via CVM
 */
async function installVersion(version) {
  console.log(`📥 Installing ${version}...`);
  await exec('cvm', ['install', version]);
}

/**
 * Uninstall a version via CVM
 */
async function uninstallVersion(version) {
  console.log(`🗑️  Uninstalling ${version}...`);
  await exec('cvm', ['uninstall', version]);
}

/**
 * Run benchmark suite
 */
async function runBenchmark() {
  console.log('\n📊 Running benchmark suite...\n');

  const env = {
    ...process.env,
    BENCH_SAMPLES: String(SAMPLES),
    ...(FROM_VERSION && { BENCH_FROM: FROM_VERSION }),
    ...(TO_VERSION && { BENCH_TO: TO_VERSION }),
    ...(LIMIT && { BENCH_LIMIT: String(LIMIT) }),
  };

  for (let i = 1; i <= RUNS; i++) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔄 Benchmark Run ${i}/${RUNS}`);
    console.log('='.repeat(70) + '\n');

    await exec('npm', ['run', 'test:integration'], {
      cwd: ROOT_DIR,
      env,
    });
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 FULL BENCHMARK WITH INSTALLATION');
  console.log('='.repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`  Mode: ${INCREMENTAL ? 'Incremental (new versions only)' : 'Full'}`);
  console.log(`  From: ${FROM_VERSION || 'first available'}`);
  console.log(`  To: ${TO_VERSION || 'latest'}`);
  console.log(`  Limit: ${LIMIT || 'none'}`);
  console.log(`  Samples: ${SAMPLES} per benchmark`);
  console.log(`  Runs: ${RUNS} complete suite runs`);
  console.log(`  Cleanup: ${CLEANUP ? 'yes (uninstall after)' : 'no (keep installed)'}`);
  console.log('='.repeat(70) + '\n');

  // Get available versions
  const available = await getAvailableVersions();
  console.log(`✓ Found ${available.length} available versions in npm registry\n`);

  // Get currently installed versions
  const alreadyInstalled = await getInstalledVersions();
  console.log(`✓ Found ${alreadyInstalled.length} already installed versions\n`);

  // Determine versions to process
  const filtered = filterVersions(available);
  console.log(`📦 Target versions after filtering: ${filtered.length}\n`);

  let toInstall = [];
  if (INCREMENTAL) {
    // Only install versions not already installed
    toInstall = filtered.filter(v => !alreadyInstalled.includes(v));
    console.log(`🆕 New versions to install: ${toInstall.length}`);
    if (toInstall.length === 0) {
      console.log(`✅ All target versions already installed, proceeding to benchmark\n`);
    } else {
      console.log(`   ${toInstall.join(', ')}\n`);
    }
  } else {
    // Install all filtered versions (skip already installed)
    toInstall = filtered.filter(v => !alreadyInstalled.includes(v));
    if (toInstall.length < filtered.length) {
      console.log(`✓ ${filtered.length - toInstall.length} versions already installed`);
    }
    if (toInstall.length > 0) {
      console.log(`📥 Need to install: ${toInstall.length} versions\n`);
    }
  }

  // Install versions
  if (toInstall.length > 0) {
    console.log('='.repeat(70));
    console.log('📥 INSTALLATION PHASE');
    console.log('='.repeat(70) + '\n');

    for (let i = 0; i < toInstall.length; i++) {
      const version = toInstall[i];
      console.log(`[${i + 1}/${toInstall.length}] Installing ${version}...`);
      try {
        await installVersion(version);
        console.log(`✅ Installed ${version}\n`);
      } catch (error) {
        console.error(`❌ Failed to install ${version}: ${error.message}\n`);
      }
    }
  }

  // Run benchmarks
  console.log('\n' + '='.repeat(70));
  console.log('📊 BENCHMARK PHASE');
  console.log('='.repeat(70));

  try {
    await runBenchmark();
    console.log('\n✅ Benchmark complete!\n');
  } catch (error) {
    console.error(`\n❌ Benchmark failed: ${error.message}\n`);
    process.exit(1);
  }

  // Cleanup if requested
  if (CLEANUP && toInstall.length > 0) {
    console.log('='.repeat(70));
    console.log('🗑️  CLEANUP PHASE');
    console.log('='.repeat(70) + '\n');

    for (let i = 0; i < toInstall.length; i++) {
      const version = toInstall[i];
      console.log(`[${i + 1}/${toInstall.length}] Uninstalling ${version}...`);
      try {
        await uninstallVersion(version);
        console.log(`✅ Uninstalled ${version}\n`);
      } catch (error) {
        console.error(`❌ Failed to uninstall ${version}: ${error.message}\n`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL DONE!');
  console.log('='.repeat(70));
  console.log(`\n📊 Benchmark results saved to ~/.cvm/benchmarks/`);
  if (!CLEANUP && toInstall.length > 0) {
    console.log(`📦 ${toInstall.length} versions remain installed`);
    console.log(`   Run with BENCH_CLEANUP=true to uninstall after benchmarking`);
  }
  console.log();
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
