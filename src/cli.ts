import { Command } from 'commander';
import { BenchmarkRunner } from './core/benchmark-runner.js';
import { DEFAULT_CONFIG, EXAMPLE_CONFIGS, BenchmarkConfigSchema } from './types/config.js';
import { logger } from './utils/logger.js';
import type { BenchmarkConfig } from './types/config.js';

const program = new Command();

program
  .name('cvm-benchmark')
  .description('Comprehensive benchmarking and performance analysis for Claude Code versions')
  .version('1.0.0');

/**
 * Run command - Execute benchmark suite
 */
program
  .command('run')
  .description('Run benchmark suite for installed versions')
  .option('--min <version>', 'Minimum version to benchmark (e.g., 1.0.0)')
  .option('--max <version>', 'Maximum version to benchmark (e.g., 2.0.50)')
  .option('--limit <number>', 'Maximum number of versions to test', parseInt)
  .option('--include <versions...>', 'Specific versions to include')
  .option('--exclude <versions...>', 'Specific versions to exclude')
  .option('--runs <number>', 'Number of runs per version', parseInt)
  .option('--timeout <ms>', 'Timeout per benchmark (ms)', parseInt)
  .option('--no-cleanup', 'Skip session cleanup')
  .option('--silent', 'Suppress progress output')
  .action(async (options) => {
    try {
      if (options.silent) {
        logger.setSilent(true);
      }

      const config: BenchmarkConfig = {
        ...DEFAULT_CONFIG,
        benchmark: {
          ...DEFAULT_CONFIG.benchmark,
          ...(options.runs && { runsPerVersion: options.runs }),
          ...(options.timeout && { timeout: options.timeout }),
        },
        versions: {
          ...DEFAULT_CONFIG.versions,
          ...(options.min && { min: options.min }),
          ...(options.max && { max: options.max }),
          ...(options.limit && { limit: options.limit }),
          ...(options.include && { include: options.include }),
          ...(options.exclude && { exclude: options.exclude }),
        },
        storage: {
          ...DEFAULT_CONFIG.storage,
          cleanupSessions: options.cleanup !== false,
        },
      };

      // Validate config
      const validConfig = BenchmarkConfigSchema.parse(config);

      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig);

      logger.success(`\nBenchmark complete!`);
      logger.info(`Run #${result.runNumber}: ${result.metadata.successfulVersions}/${result.metadata.totalVersions} successful`);
      logger.info(`Results saved to: ~/.cvm/benchmarks/run-${result.runNumber}/`);

    } catch (error) {
      logger.error('Benchmark failed:', error);
      process.exit(1);
    }
  });

/**
 * Quick command - Quick test with preset configs
 */
program
  .command('quick')
  .description('Quick benchmark test (1 run, limit 5 versions)')
  .action(async () => {
    try {
      const config: BenchmarkConfig = {
        ...DEFAULT_CONFIG,
        ...EXAMPLE_CONFIGS.quick,
      };

      const validConfig = BenchmarkConfigSchema.parse(config);

      logger.info('Running quick benchmark test...');
      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig);

      logger.success(`\nQuick test complete!`);
      logger.info(`${result.metadata.successfulVersions}/${result.metadata.totalVersions} versions tested`);

    } catch (error) {
      logger.error('Quick test failed:', error);
      process.exit(1);
    }
  });

/**
 * Latest command - Test only latest N versions
 */
program
  .command('latest')
  .description('Test only the latest N versions')
  .argument('[count]', 'Number of latest versions to test', '10')
  .action(async (count) => {
    try {
      const limit = parseInt(count);

      const config: BenchmarkConfig = {
        ...DEFAULT_CONFIG,
        versions: {
          ...DEFAULT_CONFIG.versions,
          limit,
        },
      };

      const validConfig = BenchmarkConfigSchema.parse(config);

      logger.info(`Testing latest ${limit} versions...`);
      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig);

      logger.success(`\nBenchmark complete!`);
      logger.info(`${result.metadata.successfulVersions}/${result.metadata.totalVersions} versions tested`);

    } catch (error) {
      logger.error('Latest benchmark failed:', error);
      process.exit(1);
    }
  });

/**
 * Suite command - Full comprehensive suite
 */
program
  .command('suite')
  .description('Run full comprehensive benchmark suite (all versions)')
  .option('--runs <number>', 'Number of runs per version', parseInt)
  .option('--no-cleanup', 'Skip session cleanup')
  .action(async (options) => {
    try {
      const config: BenchmarkConfig = {
        ...DEFAULT_CONFIG,
        benchmark: {
          ...DEFAULT_CONFIG.benchmark,
          ...(options.runs && { runsPerVersion: options.runs }),
        },
        storage: {
          ...DEFAULT_CONFIG.storage,
          cleanupSessions: options.cleanup !== false,
        },
      };

      const validConfig = BenchmarkConfigSchema.parse(config);

      logger.info('Running full comprehensive benchmark suite...');
      logger.warn('This may take 30-60 minutes depending on the number of versions');

      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig);

      logger.success(`\nFull suite complete!`);
      logger.info(`Run #${result.runNumber}: ${result.metadata.successfulVersions}/${result.metadata.totalVersions} successful`);
      logger.info(`Duration: ${Math.round(result.metadata.duration / 1000)}s`);
      logger.info(`Results: ~/.cvm/benchmarks/run-${result.runNumber}/`);

    } catch (error) {
      logger.error('Suite failed:', error);
      process.exit(1);
    }
  });

program.parse();
