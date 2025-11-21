import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { sortVersions } from '../utils/version-filter.js';
import { logger } from '../utils/logger.js';

export class VersionManager {
  private versionsDir: string;

  constructor(cvmDir: string = join(homedir(), '.cvm')) {
    this.versionsDir = join(cvmDir, 'versions');
  }

  /**
   * Get all installed Claude Code versions from CVM
   */
  async getInstalledVersions(): Promise<string[]> {
    try {
      const entries = await readdir(this.versionsDir);
      const versions: string[] = [];

      for (const entry of entries) {
        const entryPath = join(this.versionsDir, entry);
        const stats = await stat(entryPath);

        if (stats.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry)) {
          // Verify installation is complete
          const claudePath = join(
            entryPath,
            'installed',
            'node_modules',
            '.bin',
            'claude'
          );

          try {
            await stat(claudePath);
            versions.push(entry);
          } catch {
            logger.warn(`Version ${entry} not fully installed, skipping`);
          }
        }
      }

      return sortVersions(versions);
    } catch (error) {
      logger.error('Failed to read installed versions:', error);
      return [];
    }
  }

  /**
   * Get Claude binary path for a version
   */
  getClaudePath(version: string): string {
    return join(
      this.versionsDir,
      version,
      'installed',
      'node_modules',
      '.bin',
      'claude'
    );
  }

  /**
   * Check if a version is installed
   */
  async isInstalled(version: string): Promise<boolean> {
    try {
      await stat(this.getClaudePath(version));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get version installation directory
   */
  getVersionDir(version: string): string {
    return join(this.versionsDir, version);
  }
}
