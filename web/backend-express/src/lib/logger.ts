import pino, { type Logger } from 'pino';

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: {
      paths: ['req.headers.authorization', '*.authorization', '*.token', '*.password', 'extras.token'],
      censor: '[redacted]',
    },
  });
}
