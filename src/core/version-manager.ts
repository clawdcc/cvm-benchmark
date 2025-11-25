import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { execSync, spawn } from 'child_process';
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
   * Get all available versions from npm registry
   */
  async getAvailableVersions(): Promise<string[]> {
    try {
      const output = execSync(
        'npm view @anthropic-ai/claude-code versions --json',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const versions: string[] = JSON.parse(output);
      return sortVersions(versions);
    } catch (error) {
      logger.error('Failed to fetch available versions from npm:', error);
      return [];
    }
  }

  /**
   * Get versions that are available but not installed
   */
  async getMissingVersions(): Promise<string[]> {
    const installed = new Set(await this.getInstalledVersions());
    const available = await this.getAvailableVersions();
    return available.filter(v => !installed.has(v));
  }

  /**
   * Install a version using CVM
   * Returns true if installation succeeded
   */
  async installVersion(version: string): Promise<boolean> {
    return new Promise((resolve) => {
      logger.info(`Installing version ${version}...`);

      const proc = spawn('cvm', ['install', version], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.success(`Installed ${version}`);
          resolve(true);
        } else {
          logger.error(`Failed to install ${version}: ${stderr}`);
          resolve(false);
        }
      });

      proc.on('error', (error) => {
        logger.error(`Failed to install ${version}: ${error.message}`);
        resolve(false);
      });
    });
  }

  /**
   * Install multiple versions
   * Returns array of successfully installed versions
   */
  async installVersions(versions: string[]): Promise<string[]> {
    const installed: string[] = [];

    for (const version of versions) {
      const success = await this.installVersion(version);
      if (success) {
        installed.push(version);
      }
    }

    return installed;
  }

  /**
   * Parse a version range string (e.g., "2.0.40-2.0.53" or "2.0.40-latest")
   * Returns [minVersion, maxVersion] or null if not a range
   */
  parseVersionRange(range: string): { min: string; max: string } | null {
    const match = range.match(/^(\d+\.\d+\.\d+)-(\d+\.\d+\.\d+|latest)$/);
    if (!match) return null;
    return { min: match[1], max: match[2] };
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
