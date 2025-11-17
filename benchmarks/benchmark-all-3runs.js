#!/usr/bin/env node

/**
 * Benchmark ALL Claude Code Versions (3 runs each)
 *
 * This script:
 * 1. Benchmarks all installed versions (3 runs per version for accuracy)
 * 2. Stores individual run times + average in JSON
 * 3. Generates comprehensive HTML performance report
 *
 * Estimated time: 30-45 minutes for 248 versions
 * Output: benchmarks-all-3run.json, PERFORMANCE_REPORT_3RUN.html
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const cvmDir = path.join(os.homedir(), '.cvm');
const cvmBin = path.join(__dirname, 'dist/cvm.js');
const benchmarkFile = path.join(cvmDir, 'benchmarks-all-3run.json');

// Configuration
const BENCHMARK_RUNS = 3; // 3 runs per version for accuracy

console.log('🚀 CVM: Benchmark ALL Versions (3 runs each)\n');
console.log('⚙️  Configuration:');
console.log(`   Benchmark runs: ${BENCHMARK_RUNS} per version`);
console.log('');

// Get all installed versions
console.log('📋 Getting installed versions...');
const versionsDir = path.join(cvmDir, 'versions');
const allVersions = fs.readdirSync(versionsDir).sort((a, b) => {
  // Sort versions numerically
  const parseVersion = (v) => {
    const parts = v.split('.').map(Number);
    return parts[0] * 10000 + parts[1] * 100 + parts[2];
  };
  return parseVersion(a) - parseVersion(b);
});

console.log(`✅ Found ${allVersions.length} installed versions\n`);

// Benchmark measurement
async function measureStartup(claudePath) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const proc = spawn(claudePath, ['--version'], {
      stdio: 'pipe',
      env: process.env,
    });

    // Close stdin immediately - old versions may wait for it
    proc.stdin.end();

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${output}`));
      } else {
        resolve(duration);
      }
    });

    proc.on('error', (error) => reject(error));

    setTimeout(() => {
      proc.kill();
      reject(new Error('Timeout'));
    }, 30000);
  });
}

async function benchmarkVersion(version) {
  const claudePath = path.join(cvmDir, 'versions', version, 'installed/node_modules/.bin/claude');

  if (!fs.existsSync(claudePath)) {
    console.log(`   ⚠️  ${version} - binary not found, skipping`);
    return null;
  }

  try {
    const times = [];
    for (let i = 0; i < BENCHMARK_RUNS; i++) {
      const time = await measureStartup(claudePath);
      times.push(time);
    }

    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate standard deviation
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length;
    const stdDev = Math.round(Math.sqrt(variance));

    return {
      version,
      timestamp: new Date().toISOString(),
      runs: times, // All 3 individual run times
      avgTime,
      minTime,
      maxTime,
      stdDev,
    };
  } catch (error) {
    console.log(`   ⚠️  ${version} - benchmark failed: ${error.message}`);
    return null;
  }
}

async function benchmarkAll(versions) {
  console.log(`⏱️  Benchmarking ${versions.length} versions (${BENCHMARK_RUNS} runs each)...\n`);

  const results = [];
  let benchmarked = 0;

  for (const version of versions) {
    const idx = versions.indexOf(version) + 1;
    console.log(`   [${idx}/${versions.length}] Benchmarking ${version}...`);

    const result = await benchmarkVersion(version);
    if (result) {
      results.push(result);
      benchmarked++;
      console.log(`   ✅ ${version}: ${result.runs.join('ms, ')}ms (avg: ${result.avgTime}ms, ±${result.stdDev}ms)`);
    }
  }

  console.log(`\n✅ Benchmarked ${benchmarked}/${versions.length} versions\n`);

  // Save results
  fs.writeFileSync(benchmarkFile, JSON.stringify({ results, benchmarkRuns: BENCHMARK_RUNS }, null, 2));
  console.log(`💾 Results saved to ${benchmarkFile}\n`);

  return results;
}

// Run everything
(async () => {
  const startTime = Date.now();

  const results = await benchmarkAll(allVersions);

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);

  // Generate summary
  console.log('📊 Summary:\n');
  console.log(`   Total time: ${totalTime} minutes`);
  console.log(`   Versions benchmarked: ${results.length}`);
  console.log(`   Total data points: ${results.length * BENCHMARK_RUNS}`);

  if (results.length > 0) {
    const times = results.map(r => r.avgTime);
    const fastest = results.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
    const slowest = results.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
    const avgAll = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

    console.log(`\n🏆 Performance Analysis:`);
    console.log(`   Fastest: ${fastest.version} (${fastest.avgTime}ms ±${fastest.stdDev}ms)`);
    console.log(`   Slowest: ${slowest.version} (${slowest.avgTime}ms ±${slowest.stdDev}ms)`);
    console.log(`   Average: ${avgAll}ms`);
    console.log(`   Improvement: ${Math.round((slowest.avgTime - fastest.avgTime) / slowest.avgTime * 100)}%`);
  }

  console.log('\n✅ All done! Next step:');
  console.log(`   Generate report: node generate-report-3run.js\n`);

})().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
