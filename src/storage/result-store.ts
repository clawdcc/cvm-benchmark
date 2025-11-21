import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type {
  BenchmarkSuiteResult,
  InteractiveBenchmarkResult,
  VersionBenchmarkResult,
} from '../types/benchmark.js';

export class ResultStore {
  constructor(private baseDir: string = join(homedir(), '.cvm', 'benchmarks')) {}

  /**
   * Save suite results to run directory
   */
  async saveSuiteResults(
    runNumber: number,
    results: BenchmarkSuiteResult
  ): Promise<void> {
    const runDir = join(this.baseDir, `run-${runNumber}`);
    await mkdir(runDir, { recursive: true });

    const filePath = join(runDir, 'results.json');
    await writeFile(filePath, JSON.stringify(results, null, 2));
  }

  /**
   * Save version benchmark results
   */
  async saveVersionResults(
    runNumber: number,
    results: VersionBenchmarkResult[]
  ): Promise<void> {
    const versionDir = join(this.baseDir, `run-${runNumber}`, 'version');
    await mkdir(versionDir, { recursive: true });

    const filePath = join(versionDir, 'benchmarks-all.json');
    await writeFile(
      filePath,
      JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2)
    );
  }

  /**
   * Save interactive benchmark results (individual files)
   */
  async saveInteractiveResults(
    runNumber: number,
    results: InteractiveBenchmarkResult[]
  ): Promise<void> {
    const interactiveDir = join(this.baseDir, `run-${runNumber}`, 'interactive');
    await mkdir(interactiveDir, { recursive: true });

    for (const result of results) {
      const fileName = `benchmark-startup-${result.version.replace(/\./g, '-')}.json`;
      const filePath = join(interactiveDir, fileName);
      await writeFile(
        filePath,
        JSON.stringify(
          {
            data: {
              version: result.version,
              results: result.runs,
            },
            analysis: {
              version: result.version,
              avg: result.avgTime,
              min: result.minTime,
              max: result.maxTime,
              result: result.result,
            },
            timestamp: result.timestamp,
          },
          null,
          2
        )
      );
    }
  }

  /**
   * Save metadata for a run
   */
  async saveMetadata(
    runNumber: number,
    metadata: {
      timestamp: string;
      versionsCount: number;
      config: any;
    }
  ): Promise<void> {
    const runDir = join(this.baseDir, `run-${runNumber}`);
    await mkdir(runDir, { recursive: true });

    const filePath = join(runDir, 'metadata.json');
    await writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load suite results from run directory
   */
  async loadSuiteResults(runNumber: number): Promise<BenchmarkSuiteResult | null> {
    try {
      const filePath = join(this.baseDir, `run-${runNumber}`, 'results.json');
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Get next run number
   */
  async getNextRunNumber(): Promise<number> {
    try {
      const { readdir } = await import('fs/promises');
      const entries = await readdir(this.baseDir);
      const runs = entries
        .filter((f) => f.startsWith('run-'))
        .map((f) => parseInt(f.replace('run-', '')))
        .filter((n) => !isNaN(n));

      return runs.length > 0 ? Math.max(...runs) + 1 : 1;
    } catch {
      return 1;
    }
  }
}
