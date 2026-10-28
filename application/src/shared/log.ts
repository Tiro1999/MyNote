export interface Logger {
  debug(...a: unknown[]): void
  info(...a: unknown[]): void
  warn(...a: unknown[]): void
  error(...a: unknown[]): void
}

// Release is Vite mode 'production'; dev and experimental keep debug, see documentation/software/architecture.md
export function createLogger(module: string, mode: string = import.meta.env.MODE): Logger {
  const prefix = `[${module}]`
  const keepDebug = mode !== 'production'
  return {
    debug: (...a) => {
      if (keepDebug) console.debug(prefix, ...a)
    },
    info: (...a) => console.info(prefix, ...a),
    warn: (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a)
  }
}
