import { appConfig } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;
  private enableRequestLogging: boolean;

  constructor() {
    this.level = LOG_LEVELS[appConfig.options.logLevel];
    this.enableRequestLogging = appConfig.options.enableRequestLogging;
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (LOG_LEVELS[level] >= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      
      // Write all logs to stderr to avoid interfering with MCP protocol on stdout
      const logMessage = `${prefix} ${message}${args.length > 0 ? ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ') : ''}\n`;
      
      process.stderr.write(logMessage);
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  }

  request(method: string, url: string, data?: any) {
    if (this.enableRequestLogging) {
      this.debug(`Request: ${method} ${url}`, data ? { data } : undefined);
    }
  }

  response(method: string, url: string, status: number, data?: any) {
    if (this.enableRequestLogging) {
      this.debug(`Response: ${method} ${url} - ${status}`, data ? { data } : undefined);
    }
  }
}

export const logger = new Logger();