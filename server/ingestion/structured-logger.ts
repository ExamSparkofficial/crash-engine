type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogger = {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

function emit(level: LogLevel, namespace: string, message: string, context?: Record<string, unknown>) {
  const entry = {
    level,
    namespace,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(namespace: string): StructuredLogger {
  return {
    debug(message, context) {
      if (process.env.LOG_LEVEL === "debug") emit("debug", namespace, message, context);
    },
    info(message, context) {
      emit("info", namespace, message, context);
    },
    warn(message, context) {
      emit("warn", namespace, message, context);
    },
    error(message, context) {
      emit("error", namespace, message, context);
    }
  };
}
