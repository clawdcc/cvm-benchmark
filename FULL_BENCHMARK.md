# Full Benchmark with Installation

Complete end-to-end benchmark workflow that installs versions, benchmarks them, and optionally cleans up.

## Quick Start

```bash
# Install all versions, benchmark, keep installed
npm run benchmark:full

# Install, benchmark, then cleanup
BENCH_CLEANUP=true npm run benchmark:full

# Incremental: only new versions
BENCH_INCREMENTAL=true npm run benchmark:full

# Quick test: latest 5 versions
BENCH_LIMIT=5 npm run benchmark:full
```

## How It Works

1. **Fetches** available versions from npm registry
2. **Checks** which versions are already installed
3. **Installs** missing versions (via `cvm install`)
4. **Benchmarks** all target versions
5. **Optionally cleans up** (uninstalls versions)

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `BENCH_FROM` | Minimum version | first available |
| `BENCH_TO` | Maximum version | latest |
| `BENCH_LIMIT` | Limit to N versions | none |
| `BENCH_SAMPLES` | Samples per benchmark | 3 |
| `BENCH_RUNS` | Complete suite runs | 2 |
| `BENCH_CLEANUP` | Uninstall after benchmark | false |
| `BENCH_INCREMENTAL` | Only new versions | false |

## Usage Examples

### First Time: Install and Benchmark Everything

```bash
# Install all 249 versions and benchmark (will take ~2-3 hours)
npm run benchmark:full

# Result: All versions installed and benchmarked
```

### Incremental Updates (New Versions Only)

```bash
# Install latest version
cvm install 2.0.51

# Benchmark only new versions
BENCH_INCREMENTAL=true npm run benchmark:full

# Result: Only 2.0.51 gets benchmarked
```

### Test Then Cleanup

```bash
# Test latest 5 versions, then uninstall them
BENCH_LIMIT=5 BENCH_CLEANUP=true npm run benchmark:full

# Result: Benchmark data saved, versions removed
```

### Range Testing

```bash
# Benchmark all 2.0.x versions
BENCH_FROM=2.0.0 BENCH_TO=2.0.50 npm run benchmark:full

# Result: Only 2.0.0 through 2.0.50 installed and benchmarked
```

### High-Precision Full Suite

```bash
# 5 runs of 5 samples each
BENCH_RUNS=5 BENCH_SAMPLES=5 npm run benchmark:full

# Result: Very high precision dataset
```

## Modes

### Full Mode (Default)

- Installs ALL filtered versions (if not already installed)
- Benchmarks ALL filtered versions
- Keeps versions installed (unless `BENCH_CLEANUP=true`)

```bash
npm run benchmark:full
```

### Incremental Mode

- Installs ONLY new versions (not previously benchmarked)
- Benchmarks ONLY new versions
- Perfect for routine updates

```bash
BENCH_INCREMENTAL=true npm run benchmark:full
```

## Workflows

### Initial Setup (Fresh Start)

```bash
# Install and benchmark everything
npm run benchmark:full

# Result: Complete baseline dataset
```

### Routine Updates (New Releases)

```bash
# Check for new versions
cvm list-remote

# Install them
cvm install 2.0.51
cvm install 2.0.52

# Benchmark only new versions
BENCH_INCREMENTAL=true npm run benchmark:full

# Result: Historical data updated with new versions
```

### CI/CD Testing (Quick Validation)

```bash
# Test latest 3 versions, cleanup after
BENCH_LIMIT=3 BENCH_CLEANUP=true npm run benchmark:full

# Result: Quick validation, no disk usage
```

### Version Range Analysis

```bash
# Compare 1.x vs 2.x performance
BENCH_FROM=1.0.0 BENCH_TO=1.0.128 npm run benchmark:full
BENCH_FROM=2.0.0 BENCH_TO=2.0.50 npm run benchmark:full

# Result: Side-by-side comparison data
```

## Duration Estimates

| Scope | Versions | Install Time | Benchmark Time | Total |
|-------|----------|--------------|----------------|-------|
| Quick (5) | 5 | ~2 min | ~5 min | ~7 min |
| Range (20) | 20 | ~8 min | ~20 min | ~28 min |
| Full (249) | 249 | ~1 hour | ~1-2 hours | ~2-3 hours |

Times assume:
- Installation: ~20-30s per version (npm download + install)
- Benchmark: 2 runs × 3 samples × ~2s per request

## Disk Space

Each version consumes ~50-100 MB installed:
- 5 versions: ~500 MB
- 20 versions: ~2 GB
- 249 versions: ~25 GB

Use `BENCH_CLEANUP=true` to reclaim space after benchmarking.

## Tips

**Save disk space:**
```bash
BENCH_CLEANUP=true npm run benchmark:full
```

**Speed up testing:**
```bash
BENCH_LIMIT=5 BENCH_SAMPLES=1 npm run benchmark:full
```

**High precision:**
```bash
BENCH_RUNS=5 BENCH_SAMPLES=5 npm run benchmark:full
```

**Watch progress:**
```bash
# In another terminal
watch -n 5 'cvm list | tail -10'
```

## Comparison with Other Scripts

| Script | Installs Versions | Benchmarks | Use Case |
|--------|------------------|------------|----------|
| `test:integration` | ❌ No | ✅ Yes | Test with installed versions |
| `benchmark:update` | ❌ No | ✅ Yes (incremental) | Update historical data |
| `benchmark:full` | ✅ Yes | ✅ Yes | Complete workflow |

## Troubleshooting

**"Version X.Y.Z not found"**
- The version doesn't exist in npm registry
- Use `cvm list-remote` to see available versions

**Out of disk space**
- Use `BENCH_CLEANUP=true` to auto-cleanup
- Or manually: `cvm list | xargs -n1 cvm uninstall`

**Installation failed**
- Network issues (retry)
- Version unavailable (check npm registry)
- Permission issues (check npm config)

**Benchmark timeout**
- Increase timeout in config
- Check if older versions need trust prompt handling
