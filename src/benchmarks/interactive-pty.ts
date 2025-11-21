import * as pty from 'node-pty';
import type { BenchmarkRunResult } from '../types/benchmark.js';
import { logger } from '../utils/logger.js';

export interface InteractiveBenchmarkOptions {
  claudePath: string;
  cwd: string;
  timeout?: number;
}

/**
 * Interactive PTY Benchmark
 *
 * Spawns Claude in a pseudo-terminal and measures startup time
 * using terminal signals (bracketed paste, focus events, prompt).
 *
 * Handles:
 * - Trust prompts (auto-accepts with Enter)
 * - Version requirement errors (< 1.0.24)
 * - Terminal signal detection
 * - Session cleanup
 */
export async function benchmarkInteractive(
  options: InteractiveBenchmarkOptions
): Promise<BenchmarkRunResult> {
  const { claudePath, cwd, timeout = 30000 } = options;

  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = '';
    const signals = {
      bracketedPaste: false,
      focusEvents: false,
      prompt: false,
    };
    let readyDetected = false;
    let errorDetected = false;
    let sessionId: string | undefined = undefined;
    let trustPromptHandled = false;

    // Spawn Claude in PTY
    const ptyProcess = pty.spawn(claudePath, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env: process.env as Record<string, string>,
    });

    // Timeout handler
    const timeoutId = setTimeout(() => {
      ptyProcess.kill();
      resolve({
        time: Date.now() - startTime,
        result: 'timeout',
        reason: `Benchmark timed out after ${timeout}ms`,
        signals,
        sessionId,
      });
    }, timeout);

    // Data handler
    ptyProcess.onData((data) => {
      output += data;

      // Handle trust prompt (older versions)
      if (!trustPromptHandled && output.includes('Do you trust the files')) {
        trustPromptHandled = true;
        logger.debug('Trust prompt detected, auto-accepting...');
        // Send Enter to accept trust prompt
        setTimeout(() => ptyProcess.write('\r'), 100);
      }

      // Extract session ID if present (for cleanup)
      if (!sessionId) {
        const sessionMatch = output.match(/"session_id":"([a-f0-9-]+)"/);
        if (sessionMatch) {
          sessionId = sessionMatch[1];
        }
      }

      // Check for version requirement error message
      if (
        (output.includes('needs update') ||
          output.includes('newer version') ||
          output.includes('requires') ||
          output.includes('minimum version')) &&
        !errorDetected
      ) {
        errorDetected = true;

        // Extract the full error message (strip ANSI codes for cleaner output)
        const cleanOutput = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        const lines = cleanOutput.split('\n');
        const errorStartIdx = lines.findIndex(
          (l) =>
            l.includes('needs update') ||
            l.includes('newer version') ||
            l.includes('requires') ||
            l.includes('minimum version')
        );
        const errorLines = lines.slice(Math.max(0, errorStartIdx - 1), errorStartIdx + 6);
        const fullErrorMessage = errorLines.join('\n').trim();

        // Extract the minimum version requirement with multiple patterns
        const versionMatch =
          cleanOutput.match(/(\d+\.\d+\.\d+)\s+or higher/i) ||
          cleanOutput.match(/version\s+\((\d+\.\d+\.\d+)/i) ||
          cleanOutput.match(/requires\s+(\d+\.\d+\.\d+)/i) ||
          cleanOutput.match(/minimum\s+version[:\s]+(\d+\.\d+\.\d+)/i) ||
          cleanOutput.match(/v?(\d+\.\d+\.\d+)\+/);
        const minVersion = versionMatch ? versionMatch[1] : null;

        const EXPECTED_MIN_VERSION = '1.0.24';
        if (minVersion && minVersion !== EXPECTED_MIN_VERSION) {
          logger.warn(`Minimum version changed: expected ${EXPECTED_MIN_VERSION}, found ${minVersion}`);
        }

        clearTimeout(timeoutId);
        ptyProcess.kill();
        resolve({
          time: Date.now() - startTime,
          result: 'error_detected',
          reason: 'version_requirement_not_met',
          minVersionRequired: minVersion || EXPECTED_MIN_VERSION,
          errorMessage: fullErrorMessage,
          rawOutput: cleanOutput.substring(0, 2000),
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
          clearTimeout(timeoutId);
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

    // Exit handler
    ptyProcess.onExit(({ exitCode }) => {
      if (errorDetected || readyDetected) return; // Already resolved

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      // If we saw the prompt but process exited = "shows UI but exits"
      if (signals.prompt) {
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
