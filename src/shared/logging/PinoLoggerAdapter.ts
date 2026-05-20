import pino from 'pino';
import { LoggerPort, LogBindings } from './LoggerPort';

export class PinoLoggerAdapter implements LoggerPort {
  constructor(readonly pino: pino.Logger) {}

  info(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pino.info(objOrMsg);
    } else {
      this.pino.info(objOrMsg, msg);
    }
  }

  warn(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pino.warn(objOrMsg);
    } else {
      this.pino.warn(objOrMsg, msg);
    }
  }

  error(objOrMsg: Record<string, unknown> | string, msg?: string): void {
    if (typeof objOrMsg === 'string') {
      this.pino.error(objOrMsg);
    } else {
      this.pino.error(objOrMsg, msg);
    }
  }

  child(bindings: LogBindings): LoggerPort {
    return new PinoLoggerAdapter(this.pino.child(bindings));
  }
}
