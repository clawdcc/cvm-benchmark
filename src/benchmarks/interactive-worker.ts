#!/usr/bin/env node
/**
 * Interactive Benchmark Worker
 *
 * Runs a single interactive PTY benchmark in isolation.
 * This avoids node-pty threading bugs when running multiple benchmarks sequentially.
 *
 * Usage: node interactive-worker.js <claudePath> <cwd> [timeout]
 */

import { benchmarkInteractive } from './interactive-pty.js';

const [claudePath, cwd, timeout] = process.argv.slice(2);

if (!claudePath || !cwd) {
  console.error('Usage: interactive-worker.js <claudePath> <cwd> [timeout]');
  process.exit(1);
}

benchmarkInteractive({
  claudePath,
  cwd,
  timeout: timeout ? parseInt(timeout) : 30000,
})
  .then((result) => {
    // Output result as JSON to stdout
    console.log(JSON.stringify(result));
    process.exit(0);
  })
  .catch((error) => {
    console.error('Benchmark error:', error);
    process.exit(1);
  });
