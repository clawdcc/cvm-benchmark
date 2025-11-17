#!/usr/bin/env node
/**
 * Comprehensive Benchmark Runner
 *
 * Runs both --version and interactive startup benchmarks for all versions
 * Organizes results by run number for comparison
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CVM_DIR = path.join(os.homedir(), '.cvm');
const VERSIONS_DIR = path.join(CVM_DIR, 'versions');


function getNextRunNumber() {
  const benchmarkDir = './benchmarks';
  if (!fs.existsSync(benchmarkDir)) return '1';

  const runs = fs.readdirSync(benchmarkDir)
    .filter(f => f.startsWith('run-'))
    .map(f => parseInt(f.replace('run-', '')))
    .filter(n => !isNaN(n));

  return runs.length > 0 ? String(Math.max(...runs) + 1) : '1';
}

function setupRunDirectory(runNum) {
  const runDir = `./benchmarks/run-${runNum}`;
  const versionDir = path.join(runDir, 'version');
  const interactiveDir = path.join(runDir, 'interactive');

  fs.mkdirSync(versionDir, { recursive: true });
  fs.mkdirSync(interactiveDir, { recursive: true });

  return { runDir, versionDir, interactiveDir };
}

async function runCommand(cmd, args, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${description}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${description} failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function runAll(options = {}) {
  const runNum = options.runNumber || process.argv[2] || getNextRunNumber();
  const { runDir, versionDir, interactiveDir } = setupRunDirectory(runNum);

  console.log(`📁 Run directory: ${runDir}`);
  console.log(`   - Version benchmarks: ${versionDir}`);
  console.log(`   - Interactive benchmarks: ${interactiveDir}\n`);

  try {
    // Step 1: Run interactive startup benchmarks for all versions
    console.log('🔵 Phase 1: Interactive Startup Benchmarks');
    await runCommand('node', ['benchmark-startup-all.js'], 'Interactive startup benchmarks (all versions)');

    // Move interactive results
    const interactiveFiles = fs.readdirSync('.').filter(f => f.startsWith('benchmark-startup-') && f.endsWith('.json'));
    interactiveFiles.forEach(f => {
      fs.renameSync(f, path.join(interactiveDir, f));
    });
    console.log(`\n✅ Moved ${interactiveFiles.length} interactive benchmark files to ${interactiveDir}`);

    // Step 2: Run --version benchmarks for all versions
    console.log('\n🔵 Phase 2: --version Spawn Benchmarks');
    console.log('⚠️  This step requires running the original benchmark script');
    console.log('   Please run manually: npm run benchmark:all');
    console.log(`   Then copy ~/.cvm/benchmarks-all-3run.json to ${versionDir}/`);

    // Copy if exists
    const versionBenchFile = path.join(CVM_DIR, 'benchmarks-all-3run.json');
    if (fs.existsSync(versionBenchFile)) {
      fs.copyFileSync(versionBenchFile, path.join(versionDir, 'benchmarks-all-3run.json'));
      console.log(`\n✅ Copied --version benchmarks to ${versionDir}`);
    }

    // Step 3: Generate comparison report
    console.log('\n🔵 Phase 3: Generate Comparison Report');

    // Create metadata
    const metadata = {
      runNumber: runNum,
      timestamp: new Date().toISOString(),
      versionBenchmarks: fs.existsSync(path.join(versionDir, 'benchmarks-all-3run.json')),
      interactiveBenchmarks: interactiveFiles.length,
      totalVersions: interactiveFiles.length,
      notes: `Benchmark run ${runNum}${parseInt(runNum) <= 2 ? ' - Runs 1-2 based on ~/.claude with ~1GB of chat history files' : ' - Runs 3-4 based on empty ~/.claude (no session files)'}`,
    };

    fs.writeFileSync(
      path.join(runDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`\n✅ Run ${runNum} Complete!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Interactive benchmarks: ${metadata.interactiveBenchmarks}`);
    console.log(`   - Version benchmarks: ${metadata.versionBenchmarks ? 'Yes' : 'No'}`);
    console.log(`\n📁 Results saved to: ${runDir}`);
    console.log(`\n🔄 To compare runs, use: node compare-benchmark-runs.js ${runNum} [other-run]`);

    return metadata;

  } catch (error) {
    console.error(`\n❌ Benchmark suite failed:`, error.message);
    throw error;
  }
}

module.exports = {
  runAll,
  setupRunDirectory,
  runCommand,
  getNextRunNumber
};

// Allow running standalone
if (require.main === module) {
  const runNumber = process.argv[2] || getNextRunNumber();
  console.log(`🚀 Comprehensive Benchmark Suite - Run ${runNumber}\n`);

  runAll({ runNumber }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
