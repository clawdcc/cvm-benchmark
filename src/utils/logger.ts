import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

class Logger {
  private level: LogLevel = 'info';
  private silent = false;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  debug(message: string, ...args: any[]): void {
    if (!this.silent && this.shouldLog('debug')) {
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (!this.silent && this.shouldLog('info')) {
      console.log(chalk.blue(`ℹ ${message}`), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (!this.silent && this.shouldLog('warn')) {
      console.warn(chalk.yellow(`⚠ ${message}`), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (!this.silent && this.shouldLog('error')) {
      console.error(chalk.red(`✖ ${message}`), ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (!this.silent && this.shouldLog('success')) {
      console.log(chalk.green(`✓ ${message}`), ...args);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'success'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

export const logger = new Logger();
