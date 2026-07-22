type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const isDev = process.env.NODE_ENV === 'development';

function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, data } = entry;
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  return `${prefix} ${message}${dataStr}`;
}

const logger = {
  info(message: string, data?: unknown): void {
    if (isDev) {
      console.log(formatLog({ timestamp: new Date().toISOString(), level: 'info', message, data }));
    }
  },

  warn(message: string, data?: unknown): void {
    console.warn(formatLog({ timestamp: new Date().toISOString(), level: 'warn', message, data }));
  },

  error(message: string, data?: unknown): void {
    console.error(formatLog({ timestamp: new Date().toISOString(), level: 'error', message, data }));
  },

  debug(message: string, data?: unknown): void {
    if (isDev) {
      console.debug(formatLog({ timestamp: new Date().toISOString(), level: 'debug', message, data }));
    }
  },
};

export default logger;
