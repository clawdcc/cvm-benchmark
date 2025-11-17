#!/usr/bin/env node
/**
 * CVM Benchmark Plugin
 *
 * Comprehensive performance analysis for Claude Code versions
 */

const benchmarkVersion = require('./lib/benchmark-version');
const benchmarkInteractive = require('./lib/benchmark-interactive');
const compareRuns = require('./lib/compare-runs');
const comprehensiveSuite = require('./lib/comprehensive-suite');

module.exports = {
  name: 'benchmark',
  version: require('./package.json').version,
  description: 'Benchmark and analyze Claude Code performance',

  // CVM Plugin API
  commands: [
    {
      name: 'benchmark',
      description: 'Benchmark Claude Code startup time',
      options: [
        { flag: '--version-only', description: 'Run --version spawn test only' },
        { flag: '--interactive-only', description: 'Run interactive PTY test only' },
        { flag: '--all', description: 'Benchmark all installed versions' },
        { flag: '--runs <n>', description: 'Number of runs per version (default: 3)' },
        { flag: '--compare <runs...>', description: 'Compare multiple benchmark runs' }
      ],
      action: async (version, options) => {
        if (options.compare) {
          return compareRuns.compare(options.compare);
        }

        if (options.all) {
          return comprehensiveSuite.runAll(options);
        }

        if (options.versionOnly) {
          return benchmarkVersion.run(version, options.runs || 3);
        }

        if (options.interactiveOnly) {
          return benchmarkInteractive.run(version, options.runs || 3);
        }

        // Default: Run both
        console.log('🚀 Running comprehensive benchmark...\n');
        const versionResult = await benchmarkVersion.run(version, options.runs || 3);
        const interactiveResult = await benchmarkInteractive.run(version, options.runs || 3);

        return {
          version: versionResult,
          interactive: interactiveResult
        };
      }
    }
  ],

  // Optional lifecycle hooks
  hooks: {
    afterInstall: (version) => {
      console.log(`📊 Benchmark plugin: You can now benchmark version ${version}`);
      console.log('   Run: cvm benchmark <version>');
    }
  }
};

// Allow running standalone
if (require.main === module) {
  const [,, command, ...args] = process.argv;

  if (command === 'all') {
    comprehensiveSuite.runAll({ runs: 3 });
  } else if (command === 'compare') {
    compareRuns.compare(args);
  } else {
    console.log('CVM Benchmark Plugin v' + module.exports.version);
    console.log('');
    console.log('Usage:');
    console.log('  cvm benchmark <version>              # Benchmark a specific version');
    console.log('  cvm benchmark --all                  # Benchmark all versions');
    console.log('  cvm benchmark --compare 1 2          # Compare benchmark runs');
    console.log('');
    console.log('Standalone:');
    console.log('  node index.js all                    # Run comprehensive suite');
    console.log('  node index.js compare 1 2            # Compare runs');
  }
}
