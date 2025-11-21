import { z } from 'zod';

/**
 * Benchmark Configuration Schema
 *
 * Supports version filtering:
 * - min: Minimum version to test (e.g., "1.0.0")
 * - max: Maximum version to test (e.g., "2.0.50")
 * - limit: Maximum number of versions to test
 * - include: Specific versions to include
 * - exclude: Specific versions to exclude
 */

export const BenchmarkConfigSchema = z.object({
  /** Benchmark configuration */
  benchmark: z.object({
    /** Number of runs per version */
    runsPerVersion: z.number().min(1).max(10).default(3),

    /** Timeout for each benchmark run (ms) */
    timeout: z.number().min(1000).max(600000).default(120000),

    /** Run both version and interactive benchmarks */
    runBoth: z.boolean().default(true),
  }).default({}),

  /** Version filtering */
  versions: z.object({
    /** Minimum version to benchmark (inclusive) */
    min: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),

    /** Maximum version to benchmark (inclusive) */
    max: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),

    /** Maximum number of versions to benchmark */
    limit: z.number().min(1).optional(),

    /** Specific versions to include (overrides min/max) */
    include: z.array(z.string()).optional(),

    /** Specific versions to exclude */
    exclude: z.array(z.string()).default([]),
  }).default({}),

  /** Storage configuration */
  storage: z.object({
    /** Base directory for benchmark results */
    baseDir: z.string().default('~/.cvm/benchmarks'),

    /** Clean up old sessions after each run */
    cleanupSessions: z.boolean().default(true),

    /** Keep session files for error analysis */
    keepErrorSessions: z.boolean().default(true),
  }).default({}),

  /** Reporting configuration */
  reporting: z.object({
    /** Generate HTML reports automatically */
    autoGenerate: z.boolean().default(true),

    /** Report output directory */
    outputDir: z.string().default('./reports'),

    /** Include error details in reports */
    includeErrors: z.boolean().default(true),
  }).default({}),
});

export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: BenchmarkConfig = {
  benchmark: {
    runsPerVersion: 3,
    timeout: 120000,
    runBoth: true,
  },
  versions: {
    exclude: [],
  },
  storage: {
    baseDir: '~/.cvm/benchmarks',
    cleanupSessions: true,
    keepErrorSessions: true,
  },
  reporting: {
    autoGenerate: true,
    outputDir: './reports',
    includeErrors: true,
  },
};

/**
 * Example configurations for common use cases
 */
export const EXAMPLE_CONFIGS = {
  /** Test only latest 10 versions */
  latest10: {
    versions: {
      limit: 10,
    },
  } as Partial<BenchmarkConfig>,

  /** Test only 2.x versions */
  v2Only: {
    versions: {
      min: '2.0.0',
    },
  } as Partial<BenchmarkConfig>,

  /** Test range */
  range: {
    versions: {
      min: '1.0.24',
      max: '2.0.50',
    },
  } as Partial<BenchmarkConfig>,

  /** Quick test (1 run per version, limit 5) */
  quick: {
    benchmark: {
      runsPerVersion: 1,
    },
    versions: {
      limit: 5,
    },
  } as Partial<BenchmarkConfig>,
};
