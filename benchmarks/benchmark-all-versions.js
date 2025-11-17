#!/usr/bin/env node

/**
 * Download and Benchmark ALL Claude Code Versions
 *
 * This script:
 * 1. Fetches all 249 available versions from npm
 * 2. Downloads each version with retry logic
 * 3. Benchmarks each version (1 run for speed)
 * 4. Generates comprehensive performance report
 *
 * Estimated time: 60-90 minutes
 * Disk usage (peak): ~50GB
 * Final (after cleanup): ~10GB (249 tarballs + 4 installed)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const cvmDir = path.join(os.homedir(), '.cvm');
const cvmBin = path.join(__dirname, 'dist/cvm.js');
const benchmarkFile = path.join(cvmDir, 'benchmarks-all.json');

// Configuration
const DOWNLOAD_DELAY = 1000; // 1 second between downloads
const MAX_RETRIES = 3;
const BENCHMARK_RUNS = 1; // Quick mode - 1 run per version

console.log('🚀 CVM: Download and Benchmark ALL Versions\n');
console.log('⚙️  Configuration:');
console.log(`   Download delay: ${DOWNLOAD_DELAY}ms`);
console.log(`   Max retries: ${MAX_RETRIES}`);
console.log(`   Benchmark runs: ${BENCHMARK_RUNS} per version`);
console.log('');

// Step 1: Configure CVM
console.log('📋 Step 1: Configuring CVM...');
try {
  execSync(`${cvmBin} config set keepTarballs true`, { stdio: 'inherit' });
  console.log('✅ Config set: keepTarballs = true\n');
} catch (error) {
  console.error('❌ Failed to set config');
  process.exit(1);
}

// Step 2: Get all versions
console.log('📦 Step 2: Fetching available versions...');
let allVersions;
try {
  const output = execSync('npm view @anthropic-ai/claude-code versions --json', {
    encoding: 'utf-8',
  });
  allVersions = JSON.parse(output);
  console.log(`✅ Found ${allVersions.length} versions\n`);
} catch (error) {
  console.error('❌ Failed to fetch versions');
  process.exit(1);
}

// Step 3: Download all versions
console.log(`⬇️  Step 3: Downloading ${allVersions.length} versions...\n`);

async function downloadVersion(version, attempt = 1) {
  try {
    console.log(`   📥 [${allVersions.indexOf(version) + 1}/${allVersions.length}] Downloading ${version}...`);

    execSync(`${cvmBin} install ${version}`, {
      stdio: 'pipe',
      timeout: 120000, // 2 min timeout
    });

    console.log(`   ✅ ${version} installed`);
    return true;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.log(`   ⚠️  ${version} failed, retry ${attempt}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return downloadVersion(version, attempt + 1);
    } else {
      console.error(`   ❌ ${version} failed after ${MAX_RETRIES} attempts`);
      return false;
    }
  }
}

async function downloadAll() {
  let downloaded = 0;
  let failed = [];

  for (const version of allVersions) {
    const success = await downloadVersion(version);
    if (success) {
      downloaded++;
    } else {
      failed.push(version);
    }

    // Delay between downloads
    if (DOWNLOAD_DELAY > 0) {
      await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY));
    }
  }

  console.log(`\n✅ Downloaded ${downloaded}/${allVersions.length} versions`);
  if (failed.length > 0) {
    console.log(`⚠️  Failed: ${failed.join(', ')}`);
  }
  console.log('');

  return { downloaded, failed };
}

// Step 4: Benchmark all
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

    return {
      version,
      timestamp: new Date().toISOString(),
      avgTime,
      runs: BENCHMARK_RUNS,
    };
  } catch (error) {
    console.log(`   ⚠️  ${version} - benchmark failed: ${error.message}`);
    return null;
  }
}

async function benchmarkAll(versions) {
  console.log(`⏱️  Step 4: Benchmarking ${versions.length} versions...\n`);

  const results = [];
  let benchmarked = 0;

  for (const version of versions) {
    console.log(`   [${versions.indexOf(version) + 1}/${versions.length}] Benchmarking ${version}...`);

    const result = await benchmarkVersion(version);
    if (result) {
      results.push(result);
      benchmarked++;
      console.log(`   ✅ ${version}: ${result.avgTime}ms`);
    }
  }

  console.log(`\n✅ Benchmarked ${benchmarked}/${versions.length} versions\n`);

  // Save results
  fs.writeFileSync(benchmarkFile, JSON.stringify({ results }, null, 2));
  console.log(`💾 Results saved to ${benchmarkFile}\n`);

  return results;
}

// Run everything
(async () => {
  const startTime = Date.now();

  // Download all
  const { downloaded, failed } = await downloadAll();

  // Benchmark all (only successful downloads)
  const successfulVersions = allVersions.filter(v => !failed.includes(v));
  const results = await benchmarkAll(successfulVersions);

  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);

  // Generate summary
  console.log('📊 Summary:\n');
  console.log(`   Total time: ${totalTime} minutes`);
  console.log(`   Versions downloaded: ${downloaded}`);
  console.log(`   Versions benchmarked: ${results.length}`);
  console.log(`   Total data points: ${results.length * BENCHMARK_RUNS}`);

  if (results.length > 0) {
    const times = results.map(r => r.avgTime);
    const fastest = results.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
    const slowest = results.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
    const avgAll = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

    console.log(`\n🏆 Performance Analysis:`);
    console.log(`   Fastest: ${fastest.version} (${fastest.avgTime}ms)`);
    console.log(`   Slowest: ${slowest.version} (${slowest.avgTime}ms)`);
    console.log(`   Average: ${avgAll}ms`);
    console.log(`   Improvement: ${Math.round((slowest.avgTime - fastest.avgTime) / slowest.avgTime * 100)}%`);
  }

  console.log('\n✅ All done! Next steps:');
  console.log(`   1. Clean up: cvm clean --except 1.0.128,2.0.0,2.0.37,2.0.42`);
  console.log(`   2. View results: cat ${benchmarkFile}`);
  console.log(`   3. Generate report: node generate-report.js\n`);

})().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
