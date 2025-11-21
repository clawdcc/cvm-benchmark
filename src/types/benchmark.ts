import { z } from 'zod';

/**
 * Benchmark result states
 */
export const BenchmarkResultState = z.enum([
  'ready',              // Version started successfully and is interactive
  'error_detected',     // Version shows error message (< 1.0.24)
  'ui_then_exit',      // Shows UI but immediately exits
  'exited_early',      // Exited before showing prompt
  'timeout',           // Benchmark timed out
  'failed',            // Benchmark failed with error
]);

export type BenchmarkResultState = z.infer<typeof BenchmarkResultState>;

/**
 * Terminal signals detected during PTY benchmark
 */
export const TerminalSignalsSchema = z.object({
  bracketedPaste: z.boolean(),
  focusEvents: z.boolean(),
  prompt: z.boolean(),
});

export type TerminalSignals = z.infer<typeof TerminalSignalsSchema>;

/**
 * Single benchmark run result
 */
export const BenchmarkRunResultSchema = z.object({
  /** Time taken for this run (ms) */
  time: z.number(),

  /** Result state */
  result: BenchmarkResultState,

  /** Human-readable reason */
  reason: z.string(),

  /** Terminal signals (PTY benchmark only) */
  signals: TerminalSignalsSchema.optional(),

  /** Exit code (if exited) */
  exitCode: z.number().optional(),

  /** Session ID (if created) */
  sessionId: z.string().optional(),

  /** Minimum version required (if error_detected) */
  minVersionRequired: z.string().optional(),

  /** Error message (if error_detected) */
  errorMessage: z.string().optional(),

  /** Raw output for debugging */
  rawOutput: z.string().optional(),
});

export type BenchmarkRunResult = z.infer<typeof BenchmarkRunResultSchema>;

/**
 * Version spawn benchmark result
 */
export const VersionBenchmarkResultSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  runs: z.array(z.number()),
  avgTime: z.number(),
  minTime: z.number(),
  maxTime: z.number(),
  stdDev: z.number(),
});

export type VersionBenchmarkResult = z.infer<typeof VersionBenchmarkResultSchema>;

/**
 * Interactive PTY benchmark result
 */
export const InteractiveBenchmarkResultSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  runs: z.array(BenchmarkRunResultSchema),
  avgTime: z.number(),
  minTime: z.number(),
  maxTime: z.number(),
  stdDev: z.number(),
  result: BenchmarkResultState,
  reason: z.string(),
});

export type InteractiveBenchmarkResult = z.infer<typeof InteractiveBenchmarkResultSchema>;

/**
 * Combined benchmark results for a version
 */
export const CombinedBenchmarkResultSchema = z.object({
  version: z.string(),
  versionBenchmark: VersionBenchmarkResultSchema.optional(),
  interactiveBenchmark: InteractiveBenchmarkResultSchema.optional(),
  error: z.string().optional(),
});

export type CombinedBenchmarkResult = z.infer<typeof CombinedBenchmarkResultSchema>;

/**
 * Benchmark suite results
 */
export const BenchmarkSuiteResultSchema = z.object({
  runNumber: z.number(),
  timestamp: z.string(),
  config: z.any(), // BenchmarkConfig
  results: z.array(CombinedBenchmarkResultSchema),
  errors: z.array(z.object({
    version: z.string(),
    error: z.string(),
  })),
  metadata: z.object({
    totalVersions: z.number(),
    successfulVersions: z.number(),
    failedVersions: z.number(),
    duration: z.number(),
  }),
});

export type BenchmarkSuiteResult = z.infer<typeof BenchmarkSuiteResultSchema>;
