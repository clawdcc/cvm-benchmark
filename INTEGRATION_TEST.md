# Integration Test & Benchmark Runner

The integration test doubles as the production benchmark runner. It validates the tool works correctly while producing real, usable benchmark data.

## Quick Start

```bash
# Test with latest 5 versions (fast ~5 minutes)
BENCH_LIMIT=5 npm run test:integration

# Test specific version range
BENCH_FROM=2.0.40 BENCH_TO=2.0.50 npm run test:integration

# Benchmark ALL installed versions (slow ~30-60 minutes)
npm run benchmark:all
```

## Configuration

Control benchmarks via environment variables:

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `BENCH_FROM` | Minimum version to test | `2.0.40` | first available |
| `BENCH_TO` | Maximum version to test | `2.0.50` | latest |
| `BENCH_LIMIT` | Limit to N latest versions | `10` | none |
| `BENCH_SAMPLES` | Samples per benchmark (for averaging) | `5` | `3` |

**Note:** The integration test runs ONE complete suite with SAMPLES taken per benchmark.
For multiple suite runs (e.g., "2 runs of 3 samples"), use `npm run benchmark:update`.

## Examples

### Quick validation (5 versions, 3 samples each)
```bash
BENCH_LIMIT=5 npm run test:integration
```

### Range benchmark (2.0.x versions only)
```bash
BENCH_FROM=2.0.0 BENCH_TO=2.0.50 npm run test:integration
```

### High-precision benchmark (5 samples per benchmark)
```bash
BENCH_LIMIT=10 BENCH_SAMPLES=5 npm run test:integration
```

### Multiple Suite Runs (2 runs of 3 samples)
```bash
# Use the update script for multiple runs
BENCH_RUNS=2 BENCH_SAMPLES=3 npm run benchmark:update
```

### Full production benchmark (all versions)
```bash
npm run benchmark:all
```

## Output

Results are saved to `~/.cvm/benchmarks/run-N/`:

```
~/.cvm/benchmarks/run-42/
├── metadata.json       # Run metadata
├── results.json        # All version results
├── version/            # Per-version --version benchmark
│   └── *.json
└── interactive/        # Per-version interactive benchmark
    └── *.json
```

## What Gets Tested

The integration test validates:

✅ **Core Functionality:**
- Version filtering (from/to/limit)
- Configurable runs (X runs of Y averages)
- Both benchmark types (--version spawn + interactive PTY)
- Trust prompt handling for older versions
- Session cleanup

✅ **Data Integrity:**
- Result structure validation
- File system persistence
- Data aggregation
- Metadata completeness

✅ **Error Resilience:**
- Continues on failures
- Collects error details
- Maintains partial results

## Duration Estimates

| Scope | Versions | Time |
|-------|----------|------|
| Quick test | 5 | ~5 min |
| Range test | 10-20 | ~10-20 min |
| Full suite | 249 | ~30-60 min |

Times assume 2 runs × 3 requests per version with ~2s per request.

## Usage Patterns

### Pre-Release Validation
```bash
# Quick sanity check before release
BENCH_LIMIT=5 npm run test:integration
```

### New Version Testing
```bash
# Test only the latest version
BENCH_LIMIT=1 npm run test:integration
```

### Full Dataset Generation
```bash
# Generate complete benchmark dataset
npm run benchmark:all
```

### Version Range Analysis
```bash
# Compare performance across 1.x vs 2.x
BENCH_FROM=1.0.0 BENCH_TO=1.0.128 npm run test:integration
BENCH_FROM=2.0.0 BENCH_TO=2.0.50 npm run test:integration
```

## Continuous Usage

As new Claude Code versions release:

```bash
# Install new version
cvm install 2.0.51

# Benchmark just the new version
BENCH_LIMIT=1 npm run test:integration

# Or use the update script to append to historical data
npm run benchmark:update
```

## Troubleshooting

**"No versions found"**
- Ensure CVM is installed: `cvm --version`
- Check installed versions: `cvm list`

**Timeouts**
- Older versions may be slower
- Increase timeout in config if needed
- Check trust prompts are being handled

**Session cleanup issues**
- Review `~/.claude/projects/` for leftover sessions
- Check `keepErrorSessions` setting in config
