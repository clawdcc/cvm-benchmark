import { readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';

/**
 * Get the Claude projects directory for the current working directory
 */
export function getProjectDir(cwd: string): string {
  // Claude encodes the project path in the directory name
  const encoded = cwd.replace(/\//g, '-');
  return join(homedir(), '.claude', 'projects', encoded);
}

/**
 * Clean up sessions created during benchmark
 */
export async function cleanupSessions(
  sessionIds: string[],
  cwd: string
): Promise<{ cleaned: number; failed: number }> {
  const projectDir = getProjectDir(cwd);
  let cleaned = 0;
  let failed = 0;

  for (const sessionId of sessionIds) {
    try {
      const sessionFile = join(projectDir, `${sessionId}.jsonl`);

      // Check if file exists
      try {
        await stat(sessionFile);
      } catch {
        // File doesn't exist, skip
        continue;
      }

      await unlink(sessionFile);
      cleaned++;
      logger.debug(`Cleaned up session: ${sessionId}`);
    } catch (error) {
      failed++;
      logger.warn(`Failed to cleanup session ${sessionId}:`, error);
    }
  }

  return { cleaned, failed };
}

/**
 * Get size of Claude session directory
 */
export async function getSessionSize(cwd: string): Promise<number> {
  const projectDir = getProjectDir(cwd);

  try {
    const files = await readdir(projectDir);
    let totalSize = 0;

    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = join(projectDir, file);
        const stats = await stat(filePath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Count session files in Claude project directory
 */
export async function countSessions(cwd: string): Promise<number> {
  const projectDir = getProjectDir(cwd);

  try {
    const files = await readdir(projectDir);
    return files.filter(f => f.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}
