#!/usr/bin/env node
/**
 * Benchmark Interactive Startup for All Installed Versions
 *
 * Runs PTY-based interactive startup benchmarks for all CVM-installed versions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CVM_DIR = path.join(os.homedir(), '.cvm');
const VERSIONS_DIR = path.join(CVM_DIR, 'versions');

console.log('🚀 Benchmarking Interactive Startup for All Versions\n');

// Get all installed versions
const versions = fs.readdirSync(VERSIONS_DIR)
  .filter(v => {
    const installedDir = path.join(VERSIONS_DIR, v, 'installed');
    return fs.existsSync(installedDir);
  })
  .sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
    if (aMajor !== bMajor) return aMajor - bMajor;
    if (aMinor !== bMinor) return aMinor - bMinor;
    return aPatch - bPatch;
  });

console.log(`📦 Found ${versions.length} installed versions\n`);

// Run benchmarks sequentially
async function runAllBenchmarks() {
  const results = [];

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    const progress = `[${i + 1}/${versions.length}]`;

    console.log(`${progress} Benchmarking ${version}...`);

    try {
      // Run benchmark script for this version with timeout
      const result = await new Promise((resolve, reject) => {
        const proc = spawn('node', ['benchmark-startup.js', version], {
          stdio: 'inherit'
        });

        // Safety timeout: kill after 30 seconds
        const timeout = setTimeout(() => {
          proc.kill('SIGKILL');
          reject(new Error(`Benchmark timed out for ${version} after 30s`));
        }, 30000);

        proc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            resolve({ version, success: true });
          } else {
            reject(new Error(`Benchmark failed for ${version} with code ${code}`));
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      results.push(result);

    } catch (error) {
      console.error(`❌ Failed to benchmark ${version}:`, error.message);
      results.push({ version, success: false, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Benchmark Summary');
  console.log('='.repeat(60));
  console.log(`Total versions: ${versions.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  // Generate final report
  console.log('\n📈 Generating comparison report...');
  const reportProc = spawn('node', ['generate-startup-report.js'], {
    stdio: 'inherit'
  });

  reportProc.on('close', () => {
    console.log('\n✅ All benchmarks complete!');
    console.log('   Open STARTUP_COMPARISON.html to view results\n');
  });
}

module.exports = {
  runAllBenchmarks
};

// Allow running standalone
if (require.main === module) {
  runAllBenchmarks().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
