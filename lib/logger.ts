type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogMetadata {
  [key: string]: unknown;
}

class Logger {
  private enabled: boolean;
  private logLevel: LogLevel;
  private isServer: boolean;

  constructor() {
    this.isServer = typeof window === 'undefined';
    this.enabled = process.env.ENABLE_DEBUG_LOGS === 'true';
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'DEBUG';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(
    level: LogLevel,
    context: string,
    message: string,
    metadata?: LogMetadata
  ): string {
    const timestamp = new Date().toISOString();
    const env = this.isServer ? '[SERVER]' : '[CLIENT]';
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} ${env} [${level}] [${context}] ${message}${metadataStr}`;
  }

  debug(context: string, message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('DEBUG')) {
      console.debug(this.formatMessage('DEBUG', context, message, metadata));
    }
  }

  info(context: string, message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('INFO')) {
      console.info(this.formatMessage('INFO', context, message, metadata));
    }
  }

  warn(context: string, message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', context, message, metadata));
    }
  }

  error(context: string, message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('ERROR')) {
      const formatted = this.formatMessage('ERROR', context, message, metadata);
      console.error(formatted);

      // Include stack trace if error object is provided
      if (metadata?.error instanceof Error) {
        console.error('Stack trace:', metadata.error.stack);
      }
    }
  }
}

// Singleton instance
export const logger = new Logger();
