import { LoggerPort, LogBindings } from './LoggerPort';

export const noopLogger: LoggerPort = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: (_bindings: LogBindings) => noopLogger,
};
