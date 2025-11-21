import type { BenchmarkConfig } from '../types/config.js';

/**
 * Parse semantic version string into comparable parts
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  if (vA.major !== vB.major) return vA.major - vB.major;
  if (vA.minor !== vB.minor) return vA.minor - vB.minor;
  return vA.patch - vB.patch;
}

/**
 * Sort versions in ascending order
 */
export function sortVersions(versions: string[]): string[] {
  return [...versions].sort(compareVersions);
}

/**
 * Filter versions based on configuration
 *
 * @param allVersions All available versions
 * @param config Benchmark configuration with version filters
 * @returns Filtered and sorted versions to benchmark
 */
export function filterVersions(allVersions: string[], config: BenchmarkConfig): string[] {
  let filtered = [...allVersions];

  // If include is specified, use only those versions
  if (config.versions.include && config.versions.include.length > 0) {
    filtered = filtered.filter(v => config.versions.include!.includes(v));
  }

  // Apply min version filter
  if (config.versions.min) {
    filtered = filtered.filter(v => compareVersions(v, config.versions.min!) >= 0);
  }

  // Apply max version filter
  if (config.versions.max) {
    filtered = filtered.filter(v => compareVersions(v, config.versions.max!) <= 0);
  }

  // Apply exclusions
  if (config.versions.exclude.length > 0) {
    filtered = filtered.filter(v => !config.versions.exclude.includes(v));
  }

  // Sort versions
  filtered = sortVersions(filtered);

  // Apply limit (take last N versions for "latest N")
  if (config.versions.limit) {
    filtered = filtered.slice(-config.versions.limit);
  }

  return filtered;
}

/**
 * Get version range description for logging
 */
export function describeVersionFilter(config: BenchmarkConfig, totalVersions: number, filteredVersions: number): string {
  const filters: string[] = [];

  if (config.versions.include && config.versions.include.length > 0) {
    filters.push(`include=${config.versions.include.join(', ')}`);
  }
  if (config.versions.min) {
    filters.push(`min=${config.versions.min}`);
  }
  if (config.versions.max) {
    filters.push(`max=${config.versions.max}`);
  }
  if (config.versions.exclude.length > 0) {
    filters.push(`exclude=${config.versions.exclude.length} versions`);
  }
  if (config.versions.limit) {
    filters.push(`limit=${config.versions.limit}`);
  }

  const filterDesc = filters.length > 0 ? ` (${filters.join(', ')})` : '';
  return `${filteredVersions}/${totalVersions} versions${filterDesc}`;
}

// Inline vitest tests
if (import.meta.vitest != null) {
  const { describe, it, expect } = import.meta.vitest;

  describe('parseVersion', () => {
    it('should parse semantic versions correctly', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion('0.2.120')).toEqual({ major: 0, minor: 2, patch: 120 });
      expect(parseVersion('2.0.50')).toEqual({ major: 2, minor: 0, patch: 50 });
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should compare minor versions', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
      expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
    });

    it('should compare patch versions', () => {
      expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
      expect(compareVersions('1.0.9', '1.0.10')).toBeLessThan(0);
    });

    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });
  });

  describe('sortVersions', () => {
    it('should sort versions in ascending order', () => {
      const unsorted = ['2.0.10', '1.0.5', '2.0.1', '0.2.120', '1.0.24'];
      const sorted = sortVersions(unsorted);
      expect(sorted).toEqual(['0.2.120', '1.0.5', '1.0.24', '2.0.1', '2.0.10']);
    });

    it('should not mutate original array', () => {
      const original = ['2.0.10', '1.0.5'];
      const sorted = sortVersions(original);
      expect(original).toEqual(['2.0.10', '1.0.5']);
      expect(sorted).toEqual(['1.0.5', '2.0.10']);
    });
  });

  describe('filterVersions', () => {
    const allVersions = ['0.2.120', '1.0.5', '1.0.24', '2.0.1', '2.0.10', '2.0.37', '2.0.50'];

    it('should filter by min version', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { min: '2.0.0', exclude: [] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['2.0.1', '2.0.10', '2.0.37', '2.0.50']);
    });

    it('should filter by max version', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { max: '1.0.24', exclude: [] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['0.2.120', '1.0.5', '1.0.24']);
    });

    it('should filter by min and max', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { min: '1.0.0', max: '2.0.10', exclude: [] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['1.0.5', '1.0.24', '2.0.1', '2.0.10']);
    });

    it('should apply limit (latest N)', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { limit: 3, exclude: [] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['2.0.10', '2.0.37', '2.0.50']);
    });

    it('should apply exclusions', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { exclude: ['1.0.5', '2.0.10'] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['0.2.120', '1.0.24', '2.0.1', '2.0.37', '2.0.50']);
    });

    it('should prioritize include list', () => {
      const config = {
        benchmark: { runsPerVersion: 3, timeout: 120000, runBoth: true },
        versions: { include: ['2.0.37', '2.0.50'], exclude: [] },
        storage: { baseDir: '~/.cvm/benchmarks', cleanupSessions: true, keepErrorSessions: true },
        reporting: { autoGenerate: true, outputDir: './reports', includeErrors: true },
      };
      const result = filterVersions(allVersions, config);
      expect(result).toEqual(['2.0.37', '2.0.50']);
    });
  });
}
