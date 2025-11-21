/**
 * Integration Test & Production Benchmark Runner
 *
 * This is both a test AND the actual benchmark data generator.
 * It validates the tool works correctly while producing real benchmark data.
 *
 * Usage:
 *   npm run test:integration              # Run with defaults (all versions)
 *   BENCH_FROM=2.0.40 npm run test:integration  # From specific version
 *   BENCH_TO=2.0.50 npm run test:integration    # To specific version
 *   BENCH_LIMIT=10 npm run test:integration     # Limit to N versions
 *   BENCH_RUNS=5 npm run test:integration       # X runs per version
 */

import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../src/core/benchmark-runner.js';
import { VersionManager } from '../src/core/version-manager.js';
import { ResultStore } from '../src/storage/result-store.js';
import type { BenchmarkConfig } from '../src/types/config.js';
import fs from 'fs/promises';
import path from 'path';

// Read config from environment
const FROM_VERSION = process.env.BENCH_FROM; // e.g., "2.0.40"
const TO_VERSION = process.env.BENCH_TO;     // e.g., "2.0.50"
const LIMIT = process.env.BENCH_LIMIT ? parseInt(process.env.BENCH_LIMIT) : undefined;
const RUNS = process.env.BENCH_RUNS ? parseInt(process.env.BENCH_RUNS) : 2;

describe('Integration: Full Benchmark Suite', () => {
  it('should run complete benchmark workflow and produce valid data', async () => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 INTEGRATION TEST: Full Benchmark Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Configuration:`);
    console.log(`  From: ${FROM_VERSION || 'first available'}`);
    console.log(`  To: ${TO_VERSION || 'latest'}`);
    console.log(`  Limit: ${LIMIT || 'none'}`);
    console.log(`  Runs per version: ${RUNS}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Build configuration
    const config: BenchmarkConfig = {
      benchmark: {
        runsPerVersion: RUNS,
        timeout: 120000,
        runBoth: true,
      },
      versions: {
        ...(FROM_VERSION && { min: FROM_VERSION }),
        ...(TO_VERSION && { max: TO_VERSION }),
        ...(LIMIT && { limit: LIMIT }),
        exclude: [],
      },
      storage: {
        baseDir: '~/.cvm/benchmarks',
        cleanupSessions: true,
        keepErrorSessions: true,
      },
      reporting: {
        autoGenerate: true,
        outputDir: './reports',
        includeErrors: true,
      },
    };

    // Initialize components
    const versionManager = new VersionManager();
    const runner = new BenchmarkRunner();
    const resultStore = new ResultStore();

    // Verify CVM is installed and has versions
    const allVersions = await versionManager.getInstalledVersions();
    expect(allVersions.length).toBeGreaterThan(0);
    console.log(`✓ Found ${allVersions.length} installed CVM versions\n`);

    // Run the benchmark suite
    console.log('🚀 Starting benchmark run...\n');
    const startTime = Date.now();
    const result = await runner.runSuite(config);
    const duration = Date.now() - startTime;

    // Assertions: Verify result structure
    expect(result).toBeDefined();
    expect(result.runNumber).toBeGreaterThan(0);
    expect(result.versions).toBeDefined();
    expect(Array.isArray(result.versions)).toBe(true);
    expect(result.versions.length).toBeGreaterThan(0);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.totalVersions).toBe(result.versions.length);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ BENCHMARK COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Run #${result.runNumber}`);
    console.log(`Versions tested: ${result.metadata.totalVersions}`);
    console.log(`Successful: ${result.metadata.successfulVersions}`);
    console.log(`Failed: ${result.metadata.failedVersions}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Results: ~/.cvm/benchmarks/run-${result.runNumber}/`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify each version result
    for (const versionResult of result.versions) {
      expect(versionResult.version).toBeDefined();
      expect(versionResult.status).toBeDefined();
      expect(['success', 'error']).toContain(versionResult.status);

      // Verify version spawn benchmark
      expect(versionResult.versionSpawn).toBeDefined();
      expect(versionResult.versionSpawn.runs).toBe(RUNS);
      expect(versionResult.versionSpawn.avg).toBeGreaterThan(0);
      expect(versionResult.versionSpawn.min).toBeGreaterThan(0);
      expect(versionResult.versionSpawn.max).toBeGreaterThan(0);
      expect(versionResult.versionSpawn.results).toHaveLength(RUNS);

      // Verify interactive benchmark (if successful)
      if (versionResult.status === 'success') {
        expect(versionResult.interactive).toBeDefined();
        expect(versionResult.interactive.runs).toBe(RUNS);
        expect(versionResult.interactive.results).toHaveLength(RUNS);

        for (const run of versionResult.interactive.results) {
          expect(run.result).toBeDefined();
          expect(['ready', 'error_detected', 'ui_then_exit', 'exited_early', 'timeout']).toContain(run.result);
          expect(run.time).toBeGreaterThan(0);
          expect(run.signals).toBeDefined();
        }
      }
    }

    // Verify files were created
    const runDir = path.join(process.env.HOME!, '.cvm', 'benchmarks', `run-${result.runNumber}`);
    const metadataExists = await fs.access(path.join(runDir, 'metadata.json')).then(() => true).catch(() => false);
    const resultsExists = await fs.access(path.join(runDir, 'results.json')).then(() => true).catch(() => false);

    expect(metadataExists).toBe(true);
    expect(resultsExists).toBe(true);

    // Load and verify saved results match in-memory results
    const savedResults = await resultStore.loadSuiteResults(result.runNumber);
    expect(savedResults.runNumber).toBe(result.runNumber);
    expect(savedResults.versions.length).toBe(result.versions.length);
    expect(savedResults.metadata.totalVersions).toBe(result.metadata.totalVersions);

    console.log('✅ All assertions passed');
    console.log('✅ Benchmark data validated and saved\n');

    // Summary by status
    const summary = {
      ready: 0,
      error_detected: 0,
      ui_then_exit: 0,
      exited_early: 0,
      timeout: 0,
      failed: 0,
    };

    for (const v of result.versions) {
      if (v.status === 'error') {
        summary.failed++;
      } else if (v.interactive) {
        const primaryResult = v.interactive.results[0]?.result;
        if (primaryResult && primaryResult in summary) {
          summary[primaryResult as keyof typeof summary]++;
        }
      }
    }

    console.log('📈 Result Breakdown:');
    console.log(`   Ready: ${summary.ready}`);
    console.log(`   Error Detected: ${summary.error_detected}`);
    console.log(`   UI Then Exit: ${summary.ui_then_exit}`);
    console.log(`   Exited Early: ${summary.exited_early}`);
    console.log(`   Timeout: ${summary.timeout}`);
    console.log(`   Failed: ${summary.failed}\n`);
  }, 600000); // 10 minute timeout for full suite
});
