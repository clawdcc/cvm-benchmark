import type { BenchmarkConfig } from '../types/config.js';
import type {
  BenchmarkSuiteResult,
  BenchmarkRunResult,
  CombinedBenchmarkResult,
  InteractiveBenchmarkResult,
  VersionBenchmarkResult,
} from '../types/benchmark.js';
import { VersionManager } from './version-manager.js';
import { ResultStore } from '../storage/result-store.js';
import { benchmarkVersion } from '../benchmarks/version-spawn.js';
import { filterVersions, describeVersionFilter } from '../utils/version-filter.js';
import { cleanupSessions } from '../utils/cleanup.js';
import { logger } from '../utils/logger.js';
import { ProgressTracker } from '../utils/progress.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

export class BenchmarkRunner {
  private versionManager: VersionManager;
  private resultStore: ResultStore;

  constructor(_config?: Partial<BenchmarkConfig>) {
    this.versionManager = new VersionManager();
    this.resultStore = new ResultStore();
  }

  /**
   * Run interactive benchmark in a separate process to avoid node-pty threading bugs
   */
  private async benchmarkInteractiveIsolated(
    claudePath: string,
    cwd: string,
    timeout: number
  ): Promise<BenchmarkRunResult> {
    return new Promise((resolve, reject) => {
      // Find the worker script in dist/ (works for both test and production)
      // When running via vitest, we're in src/, so go up to project root then into dist/
      // When running from dist/, we're already in dist/, so go up to project root then into dist/
      const currentFile = fileURLToPath(import.meta.url);
      const currentDir = dirname(currentFile);

      // Find project root (has package.json)
      let projectRoot = currentDir;
      while (!existsSync(join(projectRoot, 'package.json'))) {
        const parent = dirname(projectRoot);
        if (parent === projectRoot) throw new Error('Could not find project root');
        projectRoot = parent;
      }

      const workerScript = join(projectRoot, 'dist/benchmarks/interactive-worker.js');

      // Use process.execPath to ensure worker uses the same Node version as parent
      const proc = spawn(process.execPath, [workerScript, claudePath, cwd, String(timeout)], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse benchmark result: ${error}`));
          }
        } else {
          reject(new Error(`Benchmark worker failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Run benchmark suite for all filtered versions
   */
  async runSuite(config: BenchmarkConfig): Promise<BenchmarkSuiteResult> {
    const startTime = Date.now();
    const runNumber = await this.resultStore.getNextRunNumber();

    logger.info(`Starting benchmark run #${runNumber}`);

    // Get and filter versions
    const allVersions = await this.versionManager.getInstalledVersions();
    const versions = filterVersions(allVersions, config);

    logger.info(describeVersionFilter(config, allVersions.length, versions.length));

    if (versions.length === 0) {
      throw new Error('No versions match the filter criteria');
    }

    // Run benchmarks
    const results: CombinedBenchmarkResult[] = [];
    const errors: Array<{ version: string; error: string }> = [];
    const sessionIds: string[] = [];

    const progress = new ProgressTracker();
    progress.start(`Benchmarking ${versions.length} versions...`, versions.length);

    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      progress.update(i + 1, `[${i + 1}/${versions.length}] Benchmarking ${version}...`);

      try {
        const result = await this.benchmarkVersion(version, config);
        results.push(result);

        // Collect session IDs for cleanup
        if (result.interactiveBenchmark) {
          result.interactiveBenchmark.runs.forEach((run) => {
            if (run.sessionId) sessionIds.push(run.sessionId);
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to benchmark ${version}: ${errorMsg}`);
        errors.push({ version, error: errorMsg });

        results.push({
          version,
          error: errorMsg,
        });
      }
    }

    progress.succeed(`Completed ${versions.length} versions`);

    // Cleanup sessions if configured
    if (config.storage.cleanupSessions && sessionIds.length > 0) {
      logger.info(`Cleaning up ${sessionIds.length} test sessions...`);
      const { cleaned, failed } = await cleanupSessions(sessionIds, process.cwd());
      logger.info(`Cleaned: ${cleaned}, Failed: ${failed}`);
    }

    // Calculate metadata
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    const suiteResult: BenchmarkSuiteResult = {
      runNumber,
      timestamp: new Date().toISOString(),
      config,
      results,
      errors,
      metadata: {
        totalVersions: versions.length,
        successfulVersions: successful,
        failedVersions: failed,
        duration: Date.now() - startTime,
      },
    };

    // Save results
    await this.resultStore.saveSuiteResults(runNumber, suiteResult);
    await this.resultStore.saveMetadata(runNumber, {
      timestamp: suiteResult.timestamp,
      versionsCount: versions.length,
      config,
    });

    // Save version and interactive results separately (for backwards compat)
    const versionResults: VersionBenchmarkResult[] = results
      .filter((r) => r.versionBenchmark)
      .map((r) => r.versionBenchmark!);

    const interactiveResults: InteractiveBenchmarkResult[] = results
      .filter((r) => r.interactiveBenchmark)
      .map((r) => r.interactiveBenchmark!);

    if (versionResults.length > 0) {
      await this.resultStore.saveVersionResults(runNumber, versionResults);
    }

    if (interactiveResults.length > 0) {
      await this.resultStore.saveInteractiveResults(runNumber, interactiveResults);
    }

    logger.success(`Benchmark run #${runNumber} complete`);
    logger.info(`Successful: ${successful}, Failed: ${failed}`);

    return suiteResult;
  }

  /**
   * Benchmark a single version (both spawn and interactive)
   */
  private async benchmarkVersion(
    version: string,
    config: BenchmarkConfig
  ): Promise<CombinedBenchmarkResult> {
    const claudePath = this.versionManager.getClaudePath(version);
    const result: CombinedBenchmarkResult = { version };

    // Run version spawn benchmark
    if (config.benchmark.runBoth) {
      try {
        const runs: number[] = [];
        for (let i = 0; i < config.benchmark.runsPerVersion; i++) {
          const time = await benchmarkVersion({
            claudePath,
            timeout: config.benchmark.timeout,
          });
          runs.push(time);
        }

        const avgTime = Math.round(runs.reduce((a, b) => a + b, 0) / runs.length);
        const minTime = Math.min(...runs);
        const maxTime = Math.max(...runs);
        const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
        const variance = runs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runs.length;
        const stdDev = Math.round(Math.sqrt(variance));

        result.versionBenchmark = {
          version,
          timestamp: new Date().toISOString(),
          runs,
          avgTime,
          minTime,
          maxTime,
          stdDev,
        };
      } catch (error) {
        logger.warn(`Version spawn benchmark failed for ${version}: ${error}`);
      }
    }

    // Run interactive PTY benchmark (in separate process to avoid node-pty threading bugs)
    try {
      const runs = [];
      for (let i = 0; i < config.benchmark.runsPerVersion; i++) {
        const run = await this.benchmarkInteractiveIsolated(
          claudePath,
          process.cwd(),
          config.benchmark.timeout
        );
        runs.push(run);
      }

      const times = runs.map((r) => r.time);
      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
      const stdDev = Math.round(Math.sqrt(variance));

      result.interactiveBenchmark = {
        version,
        timestamp: new Date().toISOString(),
        runs,
        avgTime,
        minTime,
        maxTime,
        stdDev,
        result: runs[0].result,
        reason: runs[0].reason,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Interactive benchmark failed: ${errorMsg}`);
    }

    return result;
  }
}
