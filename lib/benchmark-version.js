#!/usr/bin/env node
/**
 * Benchmark --version spawn time for all installed versions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CVM_DIR = path.join(os.homedir(), '.cvm');
const VERSIONS_DIR = path.join(CVM_DIR, 'versions');
const RUNS_PER_VERSION = 3;

function getInstalledVersions() {
  if (!fs.existsSync(VERSIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(VERSIONS_DIR)
    .filter(v => fs.statSync(path.join(VERSIONS_DIR, v)).isDirectory())
    .sort((a, b) => {
      const [aMaj, aMin, aPat] = a.split('.').map(Number);
      const [bMaj, bMin, bPat] = b.split('.').map(Number);
      if (aMaj !== bMaj) return aMaj - bMaj;
      if (aMin !== bMin) return aMin - bMin;
      return aPat - bPat;
    });
}

async function benchmarkVersion(version) {
  const claudePath = path.join(VERSIONS_DIR, version, 'installed/node_modules/.bin/claude');

  if (!fs.existsSync(claudePath)) {
    return null;
  }

  const runs = [];

  for (let i = 0; i < RUNS_PER_VERSION; i++) {
    const start = Date.now();

    await new Promise((resolve, reject) => {
      const proc = spawn(claudePath, ['--version'], {
        stdio: 'pipe',
        env: { ...process.env, NO_COLOR: '1' }
      });

      let output = '';
      proc.stdout.on('data', data => output += data.toString());
      proc.stderr.on('data', data => output += data.toString());

      proc.on('close', () => resolve());
      proc.on('error', reject);

      // Timeout after 10s
      setTimeout(() => {
        proc.kill();
        reject(new Error('Timeout'));
      }, 10000);
    });

    const elapsed = Date.now() - start;
    runs.push(elapsed);
  }

  const avgTime = Math.round(runs.reduce((a, b) => a + b, 0) / runs.length);
  const minTime = Math.min(...runs);
  const maxTime = Math.max(...runs);
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  const variance = runs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / runs.length;
  const stdDev = Math.round(Math.sqrt(variance));

  return {
    version,
    timestamp: new Date().toISOString(),
    runs,
    avgTime,
    minTime,
    maxTime,
    stdDev
  };
}

async function runAll(options = {}) {
  const runsPerVersion = options.runs || RUNS_PER_VERSION;
  const versions = getInstalledVersions();

  console.log(`🚀 Benchmarking --version for ${versions.length} versions\n`);

  const results = [];

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    process.stdout.write(`[${i + 1}/${versions.length}] ${version}... `);

    try {
      const result = await benchmarkVersion(version);
      if (result) {
        results.push(result);
        console.log(`${result.avgTime}ms (${result.minTime}-${result.maxTime}ms)`);
      } else {
        console.log('SKIP (not installed)');
      }
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }
  }

  // Save results
  const output = {
    results,
    totalVersions: results.length,
    runsPerVersion,
    timestamp: new Date().toISOString()
  };

  const outputFile = path.join(CVM_DIR, 'benchmarks-all-3run.json');
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log(`\n✅ Benchmarked ${results.length} versions`);
  console.log(`💾 Results saved to: ${outputFile}`);

  return output;
}

module.exports = {
  run: runAll,
  benchmarkVersion
};

// Allow running standalone
if (require.main === module) {
  runAll().catch(console.error);
}
