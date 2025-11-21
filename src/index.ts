/**
 * CVM Benchmark - Programmatic API
 *
 * This module exports the core functionality for programmatic use.
 * For CLI usage, use the `cvm-benchmark` command.
 */

export { BenchmarkRunner } from './core/benchmark-runner.js';
export { VersionManager } from './core/version-manager.js';
export { ResultStore } from './storage/result-store.js';

export { benchmarkVersion } from './benchmarks/version-spawn.js';
export { benchmarkInteractive } from './benchmarks/interactive-pty.js';

export {
  filterVersions,
  compareVersions,
  sortVersions,
  describeVersionFilter,
} from './utils/version-filter.js';

export { cleanupSessions, getSessionSize, countSessions } from './utils/cleanup.js';

export { logger } from './utils/logger.js';
export { ProgressTracker, formatDuration, formatBytes } from './utils/progress.js';

export * from './types/config.js';
export * from './types/benchmark.js';

/**
 * CVM Plugin Export
 *
 * This export is used when the package is loaded as a CVM plugin.
 */
export const plugin = {
  metadata: {
    name: 'benchmark',
    version: '2.0.0',
    description: 'Benchmark and analyze Claude Code performance',
    author: 'clawdcc',
  },

  commands: [
    {
      name: 'benchmark',
      description: 'Run benchmarks on Claude Code versions',
      handler: async (_args: string[]) => {
        const { BenchmarkRunner } = await import('./core/benchmark-runner.js');
        const { DEFAULT_CONFIG } = await import('./types/config.js');
        const { logger } = await import('./utils/logger.js');

        try {
          const runner = new BenchmarkRunner();
          const result = await runner.runSuite(DEFAULT_CONFIG);

          logger.success('Benchmark complete!');
          logger.info(`Results: ~/.cvm/benchmarks/run-${result.runNumber}/`);

          return result;
        } catch (error) {
          logger.error('Benchmark failed:', error);
          throw error;
        }
      },
    },
  ],

  hooks: {
    afterInstall: async (version: string) => {
      const { logger } = await import('./utils/logger.js');
      logger.info(`Version ${version} installed. Run: cvm benchmark`);
    },
  },
};
