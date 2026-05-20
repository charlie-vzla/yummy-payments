export type LogBindings = Record<string, string | number | boolean | undefined>;

export interface LoggerPort {
  info(obj: Record<string, unknown>, msg?: string): void;
  info(msg: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  warn(msg: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  error(msg: string): void;
  child(bindings: LogBindings): LoggerPort;
}
