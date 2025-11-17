#!/usr/bin/env node

/**
 * Integration Test: Benchmark Plugin
 *
 * Tests the benchmark plugin across multiple Claude Code versions:
 * - 1.0.128 (last 1.x version)
 * - 2.0.0 (first 2.x version)
 * - 2.0.37 (mid 2.x version)
 * - 2.0.42 (recent 2.x version)
 *
 * This validates:
 * - CVM can install multiple versions
 * - Benchmark plugin can measure all versions
 * - Chart visualization works with 4+ data points
 * - Performance trends are visible
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const cvmDir = path.join(os.homedir(), '.cvm');
const benchmarkFile = path.join(cvmDir, 'benchmarks.json');
const cvmBin = path.join(__dirname, 'dist/cvm.js');

// Test versions
const testVersions = [
  '1.0.128', // Last 1.x
  '2.0.0',   // First 2.x
  '2.0.37',  // Mid 2.x (already installed)
  '2.0.42',  // Recent 2.x (already installed)
];

console.log('🧪 CVM Integration Test: Benchmark Plugin\n');
console.log('Testing versions:', testVersions.join(', '));
console.log('');

// Step 1: Ensure CVM is built
console.log('📦 Step 1: Building CVM...');
try {
  execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ Build complete\n');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 2: Install benchmark plugin
console.log('🔌 Step 2: Installing benchmark plugin...');
const pluginSource = path.join(__dirname, 'dist/plugins/benchmark.js');
const pluginDest = path.join(cvmDir, 'plugins/benchmark.js');
fs.mkdirSync(path.dirname(pluginDest), { recursive: true });
fs.copyFileSync(pluginSource, pluginDest);
console.log('✅ Plugin installed\n');

// Step 3: Install test versions (skip if already installed)
console.log('⬇️  Step 3: Installing test versions...');
for (const version of testVersions) {
  const versionDir = path.join(cvmDir, 'versions', version);
  if (fs.existsSync(versionDir)) {
    console.log(`   ⏭️  ${version} already installed`);
    continue;
  }

  console.log(`   📥 Installing ${version}...`);
  try {
    execSync(`${cvmBin} install ${version}`, {
      stdio: 'inherit',
      timeout: 120000, // 2 min timeout per install
    });
    console.log(`   ✅ ${version} installed`);
  } catch (error) {
    console.error(`   ❌ Failed to install ${version}`);
    process.exit(1);
  }
}
console.log('✅ All versions installed\n');

// Step 4: Benchmark each version
console.log('⏱️  Step 4: Benchmarking all versions...\n');

async function measureStartup(claudePath) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const proc = spawn(claudePath, ['--version'], {
      stdio: 'pipe',
      env: process.env,
    });

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

async function benchmarkVersion(version, runNumber) {
  const claudePath = path.join(cvmDir, 'versions', version, 'installed/node_modules/.bin/claude');

  if (!fs.existsSync(claudePath)) {
    console.log(`   ❌ Version ${version} binary not found`);
    return null;
  }

  console.log(`   ⏱️  Benchmarking ${version} (run ${runNumber}/3)...`);

  // Cold start
  const coldStart = await measureStartup(claudePath);
  console.log(`      Cold: ${coldStart}ms`);

  // Warm starts (3 runs)
  const warmTimes = [];
  for (let i = 0; i < 3; i++) {
    const time = await measureStartup(claudePath);
    warmTimes.push(time);
  }
  const warmStart = Math.round(warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length);
  console.log(`      Warm: ${warmStart}ms (avg of 3)`);

  const averageStart = Math.round((coldStart + warmStart) / 2);

  return {
    version,
    timestamp: new Date().toISOString(),
    coldStart,
    warmStart,
    averageStart,
    runs: 4,
  };
}

async function runBenchmarks() {
  const allResults = [];

  // Run each version 3 times
  for (const version of testVersions) {
    const versionResults = [];

    for (let run = 1; run <= 3; run++) {
      const result = await benchmarkVersion(version, run);
      if (result) {
        versionResults.push(result);
        allResults.push(result);
        console.log(`   ✅ Run ${run}: ${result.averageStart}ms avg`);
      }
    }

    // Calculate average across all runs for this version
    if (versionResults.length > 0) {
      const avgCold = Math.round(versionResults.reduce((sum, r) => sum + r.coldStart, 0) / versionResults.length);
      const avgWarm = Math.round(versionResults.reduce((sum, r) => sum + r.warmStart, 0) / versionResults.length);
      const avgOverall = Math.round(versionResults.reduce((sum, r) => sum + r.averageStart, 0) / versionResults.length);
      console.log(`   📊 ${version} average across 3 runs: ${avgOverall}ms (cold: ${avgCold}ms, warm: ${avgWarm}ms)\n`);
    }
  }

  // Save all results
  const history = { results: allResults };
  fs.writeFileSync(benchmarkFile, JSON.stringify(history, null, 2));
  console.log(`✅ All benchmarks saved to ${benchmarkFile}\n`);

  return allResults;
}

// Step 5: Run benchmarks
runBenchmarks().then((results) => {
  console.log('📊 Step 5: Generating chart...\n');

  // Run the chart command
  try {
    execSync(`${cvmBin} benchmark chart`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Chart generation failed');
    process.exit(1);
  }

  console.log('\n✅ Integration Test Complete!\n');

  // Calculate averages per version
  const versionAverages = {};
  testVersions.forEach(version => {
    const versionResults = results.filter(r => r.version === version);
    if (versionResults.length > 0) {
      versionAverages[version] = Math.round(
        versionResults.reduce((sum, r) => sum + r.averageStart, 0) / versionResults.length
      );
    }
  });

  // Summary
  console.log('📈 Summary (averaged across 3 runs each):');
  Object.entries(versionAverages).forEach(([version, avg], i) => {
    const prevVersion = testVersions[i - 1];
    const label = i === 0 ? 'Baseline' :
                  versionAverages[prevVersion] === avg ? 'No change' :
                  versionAverages[prevVersion] > avg ? 'Faster ⚡' : 'Slower 🐌';
    console.log(`   ${version}: ${avg}ms - ${label}`);
  });

  const versions = Object.keys(versionAverages);
  const avgValues = Object.values(versionAverages);
  const fastest = versions[avgValues.indexOf(Math.min(...avgValues))];
  const slowest = versions[avgValues.indexOf(Math.max(...avgValues))];
  const improvement = ((versionAverages[slowest] - versionAverages[fastest]) / versionAverages[slowest] * 100).toFixed(1);

  console.log('\n🏆 Performance Analysis:');
  console.log(`   Total data points: ${results.length} (${testVersions.length} versions × 3 runs)`);
  console.log(`   Fastest version: ${fastest} (${versionAverages[fastest]}ms avg)`);
  console.log(`   Slowest version: ${slowest} (${versionAverages[slowest]}ms avg)`);
  console.log(`   Total improvement: ${improvement}% from ${slowest} to ${fastest}`);

}).catch((error) => {
  console.error('\n❌ Integration test failed:', error.message);
  process.exit(1);
});
