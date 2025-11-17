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
  metadata: {
    name: 'benchmark',
    version: require('./package.json').version,
    description: 'Benchmark and analyze Claude Code performance',
    author: 'clawdcc'
  },

  // Lifecycle hooks
  afterInstall: async (version, context) => {
    console.log(`📊 You can now benchmark version ${version}`);
    console.log('   Run: cvm benchmark ${version}');
  },

  // Custom commands
  commands: [
    {
      name: 'benchmark',
      description: 'Benchmark Claude Code startup time (usage: cvm benchmark <version> [options])',
      handler: async (args, context) => {
        const version = args[0];
        const flags = args.slice(1);

        // Parse flags
        const options = {
          compare: flags.includes('--compare'),
          all: flags.includes('--all'),
          versionOnly: flags.includes('--version-only'),
          interactiveOnly: flags.includes('--interactive-only'),
          runs: parseInt(flags.find((f, i) => flags[i - 1] === '--runs') || '3')
        };

        if (options.compare) {
          const runs = flags.filter(f => !f.startsWith('--'));
          return compareRuns.compare(runs);
        }

        if (options.all) {
          return comprehensiveSuite.runAll(options);
        }

        if (!version) {
          console.error('❌ Version required');
          console.log('\nUsage:');
          console.log('  cvm benchmark <version>              # Benchmark specific version');
          console.log('  cvm benchmark --all                  # Benchmark all versions');
          console.log('  cvm benchmark --compare 1 2          # Compare runs');
          return;
        }

        if (options.versionOnly) {
          return benchmarkVersion.benchmarkVersion(version);
        }

        if (options.interactiveOnly) {
          return benchmarkInteractive.run(version, options.runs);
        }

        // Default: Run interactive benchmark
        console.log('🚀 Running interactive startup benchmark...\n');
        return benchmarkInteractive.run(version, options.runs);
      }
    }
  ]
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
