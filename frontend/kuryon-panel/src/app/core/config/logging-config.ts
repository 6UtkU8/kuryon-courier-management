import { environment } from '../../../environments/environment';

export type LogLevel = 'info' | 'warn' | 'error';

type RuntimeConfigShape = {
  enableErrorReporting?: boolean;
  logLevel?: LogLevel;
  errorReportEndpoint?: string;
};

export type LoggingConfig = {
  enableErrorReporting: boolean;
  logLevel: LogLevel;
  errorReportEndpoint: string;
};

function readRuntimeConfig(): RuntimeConfigShape {
  const g = globalThis as typeof globalThis & {
    __KURYON_RUNTIME_CONFIG__?: RuntimeConfigShape;
  };
  return g.__KURYON_RUNTIME_CONFIG__ ?? {};
}

function normalizeLogLevel(v: unknown): LogLevel {
  if (v === 'warn' || v === 'error') {
    return v;
  }
  return 'info';
}

export function getLoggingConfig(): LoggingConfig {
  const runtime = readRuntimeConfig();
  return {
    enableErrorReporting:
      runtime.enableErrorReporting ?? environment.enableErrorReporting ?? false,
    logLevel: normalizeLogLevel(runtime.logLevel ?? environment.logLevel),
    errorReportEndpoint: (runtime.errorReportEndpoint ?? environment.errorReportEndpoint ?? '').trim()
  };
}
