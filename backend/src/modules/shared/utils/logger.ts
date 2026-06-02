const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof logLevels;

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = (process.env["LOG_LEVEL"] as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return logLevels[level] <= logLevels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => this.serializeArg(arg)).join(' ')}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
  }

  // JSON.stringify hides Error fields (message/name/stack are non-enumerable),
  // which silently turns "logger.error('foo', err)" into "foo {}". Serialize
  // Errors (and nested Errors) explicitly so logs actually show the cause.
  private serializeArg(arg: any): string {
    if (arg instanceof Error) {
      return JSON.stringify(this.errorToObject(arg));
    }
    try {
      return JSON.stringify(arg, (_key, value) =>
        value instanceof Error ? this.errorToObject(value) : value
      );
    } catch {
      return String(arg);
    }
  }

  private errorToObject(err: Error): Record<string, unknown> {
    const base: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
    for (const key of Object.keys(err)) {
      const value = (err as unknown as Record<string, unknown>)[key];
      base[key] = value instanceof Error ? this.errorToObject(value) : value;
    }
    if ((err as any).cause) {
      const cause = (err as any).cause;
      base["cause"] = cause instanceof Error ? this.errorToObject(cause) : cause;
    }
    return base;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, ...args));
    }
  }
}

export const logger = new Logger(); 