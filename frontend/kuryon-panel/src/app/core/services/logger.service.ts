import { Injectable } from '@angular/core';
import { getLoggingConfig, LogLevel } from '../config/logging-config';
import { environment } from '../../../environments/environment';

type LogMeta = Record<string, unknown> | undefined;

@Injectable({ providedIn: 'root' })
export class LoggerService {
  info(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('info')) return;
    this.print('info', message, meta);
  }

  warn(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('warn')) return;
    this.print('warn', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    if (!this.shouldLog('error')) return;
    this.print('error', message, meta);
    this.reportIfNeeded(message, meta);
  }

  private shouldLog(level: LogLevel): boolean {
    const levelOrder: Record<LogLevel, number> = { info: 1, warn: 2, error: 3 };
    const cfg = getLoggingConfig();
    return levelOrder[level] >= levelOrder[cfg.logLevel];
  }

  private print(level: LogLevel, message: string, meta?: LogMeta): void {
    const payload = {
      level,
      message,
      time: new Date().toISOString(),
      ...(meta ? { meta: this.sanitize(meta) } : {})
    };

    if (!environment.production) {
      if (level === 'error') console.error(message, payload.meta ?? '');
      else if (level === 'warn') console.warn(message, payload.meta ?? '');
      else console.info(message, payload.meta ?? '');
      return;
    }

    // Production/test deploy: short, structured line.
    const line = `[${payload.level.toUpperCase()}] ${payload.message}`;
    if (level === 'error') console.error(line, payload.meta ?? '');
    else if (level === 'warn') console.warn(line, payload.meta ?? '');
    else console.info(line);
  }

  private reportIfNeeded(message: string, meta?: LogMeta): void {
    const cfg = getLoggingConfig();
    if (!cfg.enableErrorReporting || !cfg.errorReportEndpoint) {
      return;
    }

    const body = JSON.stringify({
      level: 'error',
      message,
      meta: meta ? this.sanitize(meta) : undefined,
      timestamp: Date.now()
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(cfg.errorReportEndpoint, blob);
        return;
      }
      void fetch(cfg.errorReportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {
      // no-op for lightweight logger
    }
  }

  private sanitize(meta: Record<string, unknown>): Record<string, unknown> {
    const blocked = ['password', 'token', 'authorization', 'accessToken'];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (blocked.some((b) => k.toLowerCase().includes(b.toLowerCase()))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
