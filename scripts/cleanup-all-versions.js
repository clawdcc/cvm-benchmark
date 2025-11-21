#!/usr/bin/env node
/**
 * Cleanup All CVM Versions
 *
 * Uninstalls all Claude Code versions managed by CVM.
 * Useful for:
 * - Reclaiming disk space (~25 GB for all 249 versions)
 * - Starting fresh before full benchmark
 * - Cleaning up after testing
 *
 * Usage:
 *   npm run cvm:cleanup           # Interactive confirmation
 *   npm run cvm:cleanup -- --force # Skip confirmation
 */

import { spawn } from 'child_process';
import readline from 'readline';

const FORCE = process.argv.includes('--force');

/**
 * Execute shell command
 */
function exec(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Get installed versions
 */
async function getInstalledVersions() {
  return new Promise((resolve, reject) => {
    const proc = spawn('cvm', ['list'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.on('close', () => {
      const lines = stdout.split('\n');
      const versions = [];
      for (const line of lines) {
        const match = line.match(/^\s*(?:\*)?\s*(\d+\.\d+\.\d+)/);
        if (match) {
          versions.push(match[1]);
        }
      }
      resolve(versions);
    });
    proc.on('error', reject);
  });
}

/**
 * Ask for confirmation
 */
function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🗑️  CVM CLEANUP: Uninstall All Versions');
  console.log('='.repeat(70) + '\n');

  // Get installed versions
  const versions = await getInstalledVersions();

  if (versions.length === 0) {
    console.log('✅ No versions installed, nothing to cleanup\n');
    return;
  }

  console.log(`Found ${versions.length} installed versions:\n`);

  // Show first 10 and last 10 if there are many
  if (versions.length <= 20) {
    versions.forEach(v => console.log(`  - ${v}`));
  } else {
    versions.slice(0, 10).forEach(v => console.log(`  - ${v}`));
    console.log(`  ... (${versions.length - 20} more) ...`);
    versions.slice(-10).forEach(v => console.log(`  - ${v}`));
  }

  // Calculate disk space estimate
  const diskSpaceMB = versions.length * 80; // ~80 MB per version avg
  const diskSpaceGB = (diskSpaceMB / 1024).toFixed(1);

  console.log(`\n⚠️  This will uninstall ${versions.length} versions`);
  console.log(`💾 Estimated disk space to reclaim: ~${diskSpaceGB} GB\n`);

  // Confirm
  if (!FORCE) {
    const confirmed = await confirm('Are you sure you want to uninstall all versions? (y/N) ');
    if (!confirmed) {
      console.log('\n❌ Cancelled\n');
      return;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🗑️  UNINSTALLING VERSIONS');
  console.log('='.repeat(70) + '\n');

  // Uninstall each version
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];
    console.log(`[${i + 1}/${versions.length}] Uninstalling ${version}...`);

    try {
      await exec('cvm', ['uninstall', version]);
      succeeded++;
      console.log(`✅ Uninstalled ${version}\n`);
    } catch (error) {
      failed++;
      console.error(`❌ Failed to uninstall ${version}\n`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n✅ Successfully uninstalled: ${succeeded}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  console.log(`💾 Disk space reclaimed: ~${diskSpaceGB} GB\n`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
