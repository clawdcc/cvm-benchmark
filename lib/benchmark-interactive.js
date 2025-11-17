#!/usr/bin/env node
/**
 * Benchmark: Claude Code Interactive Startup Time (NO TIMEOUTS)
 *
 * Measures time until Claude is ready for user input using PTY with explicit signals:
 * - ESC[?2004h - Bracketed paste mode
 * - ESC[?1004h - Focus events
 * - "> " - Prompt character
 *
 * Cleans up session history after each run for fair benchmarking.
 *
 * Usage:
 *   node benchmark-startup.js 2.0.42
 *   node benchmark-startup.js 0.2.9
 */

const pty = require('node-pty');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configuration
const RUNS = 3; // Number of runs to average
const CVM_DIR = path.join(os.homedir(), '.cvm');
const BENCHMARKS_DIR = path.join(CVM_DIR, 'benchmarks');

/**
 * Get the Claude projects directory for the current working directory
 */
function getProjectDir() {
  const cwd = process.cwd();
  // Claude encodes the project path in the directory name
  const encoded = cwd.replace(/\//g, '-');
  return path.join(os.homedir(), '.claude', 'projects', encoded);
}

/**
 * Clean up sessions created during benchmark
 */
function cleanupSessions(sessionIds) {
  const projectDir = getProjectDir();

  if (!fs.existsSync(projectDir)) {
    return;
  }

  sessionIds.forEach(sessionId => {
    const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      console.log(`   🗑️  Cleaned up session: ${sessionId}`);
    }
  });
}

/**
 * Benchmark PTY spawn (interactive terminal)
 * - Spawns Claude with PTY (pseudo-terminal)
 * - Detects explicit terminal ready signals (NO TIMEOUT):
 *   - ESC[?2004h - Bracketed paste mode
 *   - ESC[?1004h - Focus events
 *   - "> " - Prompt character
 * - Measures time until all signals received
 */
async function benchmarkStartup(claudePath) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    let signals = {
      bracketedPaste: false,
      focusEvents: false,
      prompt: false,
    };
    let readyDetected = false;
    let errorDetected = false;
    let sessionId = null;

    const ptyProcess = pty.spawn(claudePath, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    ptyProcess.onData((data) => {
      output += data;

      // Extract session ID if present (for cleanup)
      if (!sessionId) {
        const sessionMatch = output.match(/"session_id":"([a-f0-9-]+)"/);
        if (sessionMatch) {
          sessionId = sessionMatch[1];
        }
      }

      // Check for version requirement error message
      if ((output.includes('needs update') || output.includes('newer version')) && !errorDetected) {
        errorDetected = true;

        // Extract the full error message
        const lines = output.split('\n');
        const errorStartIdx = lines.findIndex(l => l.includes('needs update') || l.includes('newer version'));
        const errorLines = lines.slice(Math.max(0, errorStartIdx - 1), errorStartIdx + 5);
        const fullErrorMessage = errorLines.join('\n').trim();

        // Extract the minimum version requirement
        const versionMatch = output.match(/(\d+\.\d+\.\d+)\s+or higher/i) ||
                            output.match(/version\s+\((\d+\.\d+\.\d+)/i);
        const minVersion = versionMatch ? versionMatch[1] : null;

        // Validate expected minimum version
        const EXPECTED_MIN_VERSION = '1.0.24';
        if (minVersion && minVersion !== EXPECTED_MIN_VERSION) {
          console.error('\n⚠️  WARNING: Minimum version changed!');
          console.error(`   Expected: ${EXPECTED_MIN_VERSION}`);
          console.error(`   Found: ${minVersion}`);
          console.error('\n   Full error message:');
          console.error('   ' + fullErrorMessage.replace(/\n/g, '\n   '));
          console.error('');
        }

        ptyProcess.kill();
        resolve({
          time: Date.now() - startTime,
          result: 'error_detected',
          reason: 'needs update',
          minVersionRequired: minVersion || EXPECTED_MIN_VERSION,
          errorMessage: fullErrorMessage,
          sessionId,
        });
        return;
      }

      // Check for ready signals
      if (data.includes('\x1b[?2004h') && !signals.bracketedPaste) {
        signals.bracketedPaste = true;
      }

      if (data.includes('\x1b[?1004h') && !signals.focusEvents) {
        signals.focusEvents = true;
      }

      // Check for prompt (strip ANSI codes first)
      const stripped = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      if (/>\s/.test(stripped) && !signals.prompt) {
        signals.prompt = true;
      }

      // All signals received = ready (but wait a bit to confirm it doesn't immediately exit)
      if (signals.bracketedPaste && signals.focusEvents && signals.prompt && !readyDetected) {
        readyDetected = true;

        // Wait 500ms to see if process stays alive (distinguishes "ready" from "ui_then_exit")
        setTimeout(() => {
          ptyProcess.kill();
          resolve({
            time: Date.now() - startTime,
            result: 'ready',
            reason: 'all terminal signals received and process stable',
            signals: { ...signals },
            sessionId,
          });
        }, 500);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (errorDetected) return; // Already resolved via error

      const elapsed = Date.now() - startTime;

      // If we saw the prompt but process exited = "shows UI but exits"
      if (signals.prompt && !readyDetected) {
        resolve({
          time: elapsed,
          result: 'ui_then_exit',
          reason: 'showed prompt but immediately exited',
          signals: { ...signals },
          exitCode,
          sessionId,
        });
        return;
      }

      // Process exited without showing prompt
      resolve({
        time: elapsed,
        result: 'exited_early',
        reason: 'process exited before showing prompt',
        signals: { ...signals },
        exitCode,
        sessionId,
      });
    });
  });
}

/**
 * Run multiple benchmarks and average results
 */
async function runBenchmarks(version) {
  const claudePath = path.join(
    os.homedir(),
    '.cvm',
    'versions',
    version,
    'installed',
    'node_modules',
    '.bin',
    'claude'
  );

  console.log(`\n🔬 Benchmarking Claude ${version} (Interactive Startup)`);
  console.log(`📍 Path: ${claudePath}`);
  console.log(`🔁 Runs: ${RUNS}\n`);

  const results = [];
  const sessionIds = [];

  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`Run ${i + 1}/${RUNS}... `);
    const result = await benchmarkStartup(claudePath);
    results.push(result);

    if (result.sessionId) {
      sessionIds.push(result.sessionId);
    }

    console.log(`${result.time}ms (${result.result})`);

    // Small delay between runs
    await new Promise((r) => setTimeout(r, 500));
  }

  // Cleanup sessions
  if (sessionIds.length > 0) {
    console.log(`\n🧹 Cleaning up ${sessionIds.length} test sessions...`);
    cleanupSessions(sessionIds);
  }

  return { version, results };
}

/**
 * Calculate statistics and display results
 */
function analyzeResults(data) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));

  const times = data.results.map((r) => r.time);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const result = data.results[0].result;

  console.log(`\nVersion: ${data.version}`);
  console.log(`Average: ${avg.toFixed(2)}ms`);
  console.log(`Min:     ${min}ms`);
  console.log(`Max:     ${max}ms`);
  console.log(`Result:  ${result}`);
  console.log(`Reason:  ${data.results[0].reason}`);

  console.log('\n💡 Detection Method (NO TIMEOUTS):');
  console.log('   Waits for: ESC[?2004h + ESC[?1004h + "> " prompt');

  console.log('\n' + '='.repeat(60) + '\n');

  return {
    version: data.version,
    avg: avg,
    min: min,
    max: max,
    result: result,
  };
}

/**
 * Run benchmarks for a specific version
 */
async function run(version, runs = RUNS) {
  if (!version) {
    throw new Error('Version required');
  }

  try {
    const data = await runBenchmarks(version);
    const analysis = analyzeResults(data);

    // Ensure benchmarks directory exists
    fs.mkdirSync(BENCHMARKS_DIR, { recursive: true });

    // Save results to file
    const outputFile = path.join(BENCHMARKS_DIR, `benchmark-startup-${version.replace(/\./g, '-')}.json`);
    fs.writeFileSync(outputFile, JSON.stringify({ data, analysis }, null, 2));
    console.log(`💾 Results saved to: ${outputFile}\n`);

    return { data, analysis };
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    throw error;
  }
}

module.exports = {
  run,
  benchmarkStartup,
  runBenchmarks,
  analyzeResults,
  cleanupSessions,
  getProjectDir
};

// Allow running standalone
if (require.main === module) {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: node benchmark-interactive.js <version>');
    console.error('Example: node benchmark-interactive.js 2.0.42');
    process.exit(1);
  }

  run(version).catch(error => {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  });
}
