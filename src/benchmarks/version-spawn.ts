import { spawn } from 'child_process';

export interface VersionBenchmarkOptions {
  claudePath: string;
  timeout?: number;
}

/**
 * Version Spawn Benchmark
 *
 * Quick benchmark that spawns `claude --version` and measures execution time.
 * This is a fast performance indicator for basic spawn overhead.
 */
export async function benchmarkVersion(
  options: VersionBenchmarkOptions
): Promise<number> {
  const { claudePath, timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const proc = spawn(claudePath, ['--version'], {
      stdio: 'ignore',
      timeout,
    });

    proc.on('close', (code) => {
      const elapsed = Date.now() - startTime;

      if (code === 0) {
        resolve(elapsed);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}
