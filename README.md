# @clawdcc/cvm-benchmark

Comprehensive benchmarking and performance analysis tools for Claude Code versions managed by CVM.

## Features

- **--version Spawn Benchmarks**: Measure Claude startup time using `--version` flag
- **Interactive PTY Benchmarks**: Measure full interactive startup time with terminal signals
- **Multi-Run Comparison**: Compare multiple benchmark runs to verify consistency
- **HTML Reports**: Beautiful Chart.js-powered performance visualization
- **Session Cleanup**: Automatic cleanup of test sessions for fair benchmarking
- **Viability Detection**: Identify minimum viable Claude Code versions

## Installation

```bash
# Install as CVM plugin
cvm plugin install @clawdcc/cvm-benchmark

# Or install globally
npm install -g @clawdcc/cvm-benchmark
```

## Usage

### As CVM Plugin

```bash
# Benchmark a specific version
cvm benchmark 2.0.42

# Benchmark all installed versions
cvm benchmark --all

# Run only --version tests
cvm benchmark 2.0.42 --version-only

# Run only interactive PTY tests
cvm benchmark 2.0.42 --interactive-only

# Custom number of runs
cvm benchmark 2.0.42 --runs 5

# Compare multiple benchmark runs
cvm benchmark --compare 1 2 3
```

### Standalone Usage

```bash
# Run comprehensive benchmark suite
node index.js all

# Compare benchmark runs
node index.js compare 1 2

# Run specific benchmarks
node lib/benchmark-version.js
node lib/benchmark-interactive.js 2.0.42
node lib/benchmark-interactive-all.js
node lib/comprehensive-suite.js 3
```

## Benchmark Types

### 1. --version Spawn Test
- Spawns Claude with `--version` flag
- Measures process spawn and execution time
- Fast, simple performance indicator
- Ideal for quick version comparison

### 2. Interactive PTY Test
- Spawns Claude in pseudo-terminal (PTY)
- Detects ready state via terminal signals:
  - `ESC[?2004h` - Bracketed paste mode
  - `ESC[?1004h` - Focus events
  - `> ` - Prompt character
- No timeout-based detection (signal-based only)
- Measures real interactive startup time
- Cleans up session files after each run

## Output Structure

```
benchmarks/
├── run-1/
│   ├── version/
│   │   └── benchmarks-all-3run.json
│   ├── interactive/
│   │   ├── benchmark-startup-0-2-9.json
│   │   ├── benchmark-startup-2-0-42.json
│   │   └── ...
│   └── metadata.json
└── run-2/
    └── ...
```

## Reports

### Performance Report
Generated from individual benchmark runs, showing:
- --version spawn times across all versions
- Interactive startup times across all versions
- Version viability markers (1.0.24+)
- Performance trends and outliers

### Comparison Report
Overlays multiple benchmark runs to show:
- Measurement consistency across runs
- Performance variance
- Reliability of benchmark data

## Version States

The benchmark tool detects three version states:

1. **error_detected**: Pre-0.2.103 versions that show error before UI
2. **ui_then_exit**: Versions 0.2.103-1.0.23 that show UI with error but immediately close
3. **ready**: Versions 1.0.24+ that are actually interactive

Minimum viable version: **1.0.24**

## Performance Data

Example benchmark results:

```json
{
  "version": "2.0.42",
  "results": [
    {
      "time": 980,
      "result": "ready",
      "reason": "all terminal signals received and process stable",
      "signals": {
        "bracketedPaste": true,
        "focusEvents": true,
        "prompt": true
      }
    }
  ]
}
```

## API

### Plugin API

```javascript
module.exports = {
  name: 'benchmark',
  version: '0.1.0',
  description: 'Benchmark and analyze Claude Code performance',
  commands: [...],
  hooks: {
    afterInstall: (version) => { /* ... */ }
  }
};
```

### Module API

```javascript
const benchmarkVersion = require('@clawdcc/cvm-benchmark/lib/benchmark-version');
const benchmarkInteractive = require('@clawdcc/cvm-benchmark/lib/benchmark-interactive');
const compareRuns = require('@clawdcc/cvm-benchmark/lib/compare-runs');
const comprehensiveSuite = require('@clawdcc/cvm-benchmark/lib/comprehensive-suite');

// Run benchmarks
await benchmarkVersion.run({ runs: 3 });
await benchmarkInteractive.run('2.0.42', 3);
await comprehensiveSuite.runAll({ runNumber: 3 });
compareRuns.compare(['1', '2', '3']);
```

## Requirements

- Node.js >= 14.0.0
- CVM installed with at least one Claude Code version
- `node-pty` for interactive benchmarks

## Development

```bash
# Clone the repo
git clone https://github.com/clawdcc/cvm-benchmark.git
cd cvm-benchmark

# Install dependencies
npm install

# Run tests
npm test

# Run benchmarks
node lib/benchmark-interactive.js 2.0.42
```

## License

MIT

## Related Projects

- [@clawdcc/cvm](https://github.com/clawdcc/cvm) - Claude Version Manager
- [Claude Code](https://claude.com/code) - Official CLI for Claude

## Credits

Built by the CVM team to enable comprehensive performance testing across all Claude Code versions.

---

**Status**: Production-ready, actively used for benchmarking 249 Claude Code versions (0.2.x → 2.0.x)
