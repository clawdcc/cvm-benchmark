import { Command } from 'commander';
import { BenchmarkRunner } from './core/benchmark-runner.js';
import { VersionManager } from './core/version-manager.js';
import { DEFAULT_CONFIG, EXAMPLE_CONFIGS, BenchmarkConfigSchema } from './types/config.js';
import { logger } from './utils/logger.js';
import { filterVersions } from './utils/version-filter.js';
import type { BenchmarkConfig } from './types/config.js';

const program = new Command();

program
  .name('cvm-benchmark')
  .description('Comprehensive benchmarking and performance analysis for Claude Code versions')
  .version('1.0.3');

/**
 * Helper to handle auto-install logic
 */
async function handleAutoInstall(
  versionManager: VersionManager,
  config: BenchmarkConfig,
  options: { autoInstall?: boolean; incremental?: boolean }
): Promise<void> {
  if (!options.autoInstall) return;

  const installed = await versionManager.getInstalledVersions();
  const available = await versionManager.getAvailableVersions();

  // Filter available versions based on config
  let toInstall = filterVersions(available, config);

  // Remove already installed
  const installedSet = new Set(installed);
  toInstall = toInstall.filter(v => !installedSet.has(v));

  if (toInstall.length === 0) {
    logger.info('All matching versions are already installed');
    return;
  }

  logger.info(`Installing ${toInstall.length} missing versions...`);
  const results = await versionManager.installVersions(toInstall);
  logger.success(`Installed ${results.length}/${toInstall.length} versions`);
}

/**
 * Run command - Execute benchmark suite
 */
program
  .command('run')
  .description('Run benchmark suite for versions')
  .option('--min <version>', 'Minimum version to benchmark (e.g., 1.0.0)')
  .option('--max <version>', 'Maximum version to benchmark (e.g., 2.0.50)')
  .option('--range <range>', 'Version range (e.g., 2.0.40-2.0.53 or 2.0.40-latest)')
  .option('--limit <number>', 'Maximum number of versions to test', parseInt)
  .option('--include <versions...>', 'Specific versions to include')
  .option('--exclude <versions...>', 'Specific versions to exclude')
  .option('--runs <number>', 'Number of runs per version', parseInt)
  .option('--timeout <ms>', 'Timeout per benchmark (ms)', parseInt)
  .option('--no-cleanup', 'Skip session cleanup')
  .option('--silent', 'Suppress progress output')
  .option('--auto-install', 'Automatically install missing versions via CVM')
  .option('--incremental', 'Only benchmark versions not yet benchmarked')
  .action(async (options) => {
    try {
      if (options.silent) {
        logger.setSilent(true);
      }

      // Parse version range if provided
      let min = options.min;
      let max = options.max;
      if (options.range) {
        const versionManager = new VersionManager();
        const parsed = versionManager.parseVersionRange(options.range);
        if (parsed) {
          min = parsed.min;
          max = parsed.max === 'latest' ? undefined : parsed.max;
        } else {
          logger.error(`Invalid range format: ${options.range}. Use format: 2.0.40-2.0.53 or 2.0.40-latest`);
          process.exit(1);
        }
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
          ...(min && { min }),
          ...(max && { max }),
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

      // Handle auto-install
      const versionManager = new VersionManager();
      await handleAutoInstall(versionManager, validConfig, options);

      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig, { incremental: options.incremental });

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
  .option('--auto-install', 'Automatically install missing versions via CVM')
  .action(async (options) => {
    try {
      const config: BenchmarkConfig = {
        ...DEFAULT_CONFIG,
        ...EXAMPLE_CONFIGS.quick,
      };

      const validConfig = BenchmarkConfigSchema.parse(config);

      // Handle auto-install
      if (options.autoInstall) {
        const versionManager = new VersionManager();
        await handleAutoInstall(versionManager, validConfig, options);
      }

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
  .option('--auto-install', 'Automatically install missing versions via CVM')
  .action(async (count, options) => {
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

      // Handle auto-install - for latest, install missing and take last N
      if (options.autoInstall) {
        const versionManager = new VersionManager();
        const available = await versionManager.getAvailableVersions();
        const latestVersions = available.slice(-limit);

        // Check which need to be installed
        const installed = new Set(await versionManager.getInstalledVersions());
        const toInstall = latestVersions.filter(v => !installed.has(v));

        if (toInstall.length > 0) {
          logger.info(`Installing ${toInstall.length} missing versions...`);
          await versionManager.installVersions(toInstall);
        }
      }

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
  .option('--auto-install', 'Automatically install ALL available versions via CVM')
  .option('--incremental', 'Only benchmark versions not yet in any previous run')
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

      // Handle auto-install for full suite
      if (options.autoInstall) {
        const versionManager = new VersionManager();
        logger.info('Checking for missing versions...');
        const missing = await versionManager.getMissingVersions();

        if (missing.length > 0) {
          logger.info(`Installing ${missing.length} missing versions...`);
          logger.warn('This may take a while...');
          await versionManager.installVersions(missing);
        } else {
          logger.info('All versions are already installed');
        }
      }

      logger.info('Running full comprehensive benchmark suite...');
      if (!options.incremental) {
        logger.warn('This may take 30-60 minutes depending on the number of versions');
      }

      const runner = new BenchmarkRunner();
      const result = await runner.runSuite(validConfig, { incremental: options.incremental });

      logger.success(`\nFull suite complete!`);
      logger.info(`Run #${result.runNumber}: ${result.metadata.successfulVersions}/${result.metadata.totalVersions} successful`);
      logger.info(`Duration: ${Math.round(result.metadata.duration / 1000)}s`);
      logger.info(`Results: ~/.cvm/benchmarks/run-${result.runNumber}/`);

    } catch (error) {
      logger.error('Suite failed:', error);
      process.exit(1);
    }
  });

/**
 * Install command - Install versions without benchmarking
 */
program
  .command('install')
  .description('Install versions via CVM without benchmarking')
  .option('--range <range>', 'Version range (e.g., 2.0.40-2.0.53 or 2.0.40-latest)')
  .option('--min <version>', 'Minimum version')
  .option('--max <version>', 'Maximum version')
  .option('--all', 'Install all available versions')
  .option('--missing', 'Install only missing versions')
  .argument('[versions...]', 'Specific versions to install')
  .action(async (versions, options) => {
    try {
      const versionManager = new VersionManager();
      let toInstall: string[] = [];

      if (versions && versions.length > 0) {
        // Specific versions provided
        toInstall = versions;
      } else if (options.all || options.missing) {
        // Install all/missing
        const available = await versionManager.getAvailableVersions();
        const installed = new Set(await versionManager.getInstalledVersions());

        if (options.missing) {
          toInstall = available.filter(v => !installed.has(v));
        } else {
          toInstall = available;
        }
      } else if (options.range || options.min || options.max) {
        // Range-based installation
        let min = options.min;
        let max = options.max;

        if (options.range) {
          const parsed = versionManager.parseVersionRange(options.range);
          if (parsed) {
            min = parsed.min;
            max = parsed.max === 'latest' ? undefined : parsed.max;
          }
        }

        const available = await versionManager.getAvailableVersions();
        const config: BenchmarkConfig = {
          ...DEFAULT_CONFIG,
          versions: {
            ...DEFAULT_CONFIG.versions,
            ...(min && { min }),
            ...(max && { max }),
          },
        };
        toInstall = filterVersions(available, config);

        // Remove already installed
        const installed = new Set(await versionManager.getInstalledVersions());
        toInstall = toInstall.filter(v => !installed.has(v));
      } else {
        logger.error('Please specify versions, --range, --all, or --missing');
        process.exit(1);
      }

      if (toInstall.length === 0) {
        logger.info('No versions to install');
        return;
      }

      logger.info(`Installing ${toInstall.length} versions...`);
      const results = await versionManager.installVersions(toInstall);
      logger.success(`\nInstalled ${results.length}/${toInstall.length} versions`);

    } catch (error) {
      logger.error('Install failed:', error);
      process.exit(1);
    }
  });

/**
 * Status command - Show installed vs available
 */
program
  .command('status')
  .description('Show installed vs available versions')
  .action(async () => {
    try {
      const versionManager = new VersionManager();

      logger.info('Checking versions...');
      const installed = await versionManager.getInstalledVersions();
      const available = await versionManager.getAvailableVersions();
      const missing = available.filter(v => !new Set(installed).has(v));

      console.log('\n📊 Version Status');
      console.log('─'.repeat(40));
      console.log(`Installed:  ${installed.length}`);
      console.log(`Available:  ${available.length}`);
      console.log(`Missing:    ${missing.length}`);

      if (missing.length > 0 && missing.length <= 10) {
        console.log(`\nMissing versions: ${missing.join(', ')}`);
      } else if (missing.length > 10) {
        console.log(`\nLatest missing: ${missing.slice(-5).join(', ')}`);
      }

      console.log('─'.repeat(40));

      if (missing.length > 0) {
        console.log(`\nRun 'cvm-benchmark install --missing' to install missing versions`);
        console.log(`Or 'cvm-benchmark suite --auto-install' to install and benchmark all`);
      }

    } catch (error) {
      logger.error('Status check failed:', error);
      process.exit(1);
    }
  });

program.parse();
