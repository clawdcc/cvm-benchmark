import ora, { Ora } from 'ora';

export class ProgressTracker {
  private spinner: Ora | null = null;
  private startTime: number = 0;
  private total: number = 0;

  start(message: string, total: number): void {
    this.total = total;
    this.startTime = Date.now();
    this.spinner = ora({
      text: message,
      spinner: 'dots',
    }).start();
  }

  update(current: number, message?: string): void {
    const percentage = Math.round((current / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    const eta = current > 0 ? Math.round((elapsed / current) * (this.total - current) / 1000) : 0;

    const text = message || `Progress: ${current}/${this.total} (${percentage}%) - ETA: ${eta}s`;
    if (this.spinner?.text) {
      this.spinner.text = text;
    }
  }

  succeed(message?: string): void {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    this.spinner?.succeed(message || `Completed ${this.total} items in ${elapsed}s`);
    this.spinner = null;
  }

  fail(message?: string): void {
    this.spinner?.fail(message || 'Failed');
    this.spinner = null;
  }

  stop(): void {
    this.spinner?.stop();
    this.spinner = null;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
