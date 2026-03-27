import { Injectable, NgZone } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

type MetricSample = {
  metric: string;
  durationMs: number;
  at: string;
  details?: Record<string, unknown>;
};

type RoutePending = {
  fromUrl: string;
  toUrl: string;
  startedAt: number;
};

const DEV_PROFILE_STORAGE_KEY = 'kuryon_dev_profile_enabled';
const ADMIN_ROUTE_PREFIXES = ['/dashboard', '/orders', '/couriers', '/reports', '/settings'];

declare global {
  interface Window {
    __kuryonProfiler?: {
      enable: () => void;
      disable: () => void;
      clear: () => void;
      samples: () => MetricSample[];
      report: () => {
        byMetric: Array<{ metric: string; avgMs: number; p95Ms: number; count: number }>;
        slowest: MetricSample[];
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class DevProfilerService {
  private readonly enabled = this.resolveEnabled();
  private readonly samples: MetricSample[] = [];
  private pendingRoute: RoutePending | null = null;

  constructor(
    private readonly router: Router,
    private readonly zone: NgZone
  ) {
    if (!this.enabled) {
      return;
    }

    this.attachRouterProfiling();
    this.attachWindowApi();
    console.info('[Profiler] enabled. Add ?profileCourier=1 or localStorage key to toggle.');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  record(metric: string, durationMs: number, details?: Record<string, unknown>): void {
    if (!this.enabled || !Number.isFinite(durationMs)) {
      return;
    }
    const rounded = Number(durationMs.toFixed(2));
    const sample: MetricSample = {
      metric,
      durationMs: rounded,
      at: new Date().toISOString(),
      ...(details ? { details } : {})
    };
    this.samples.push(sample);
    console.debug(`[Profiler] ${metric}: ${rounded}ms`, details ?? {});
  }

  measure<T>(metric: string, run: () => T, details?: Record<string, unknown>): T {
    if (!this.enabled) {
      return run();
    }
    const started = performance.now();
    const result = run();
    this.record(metric, performance.now() - started, details);
    return result;
  }

  measureToNextFrame(metric: string, details?: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }
    const started = performance.now();
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.record(metric, performance.now() - started, details);
      });
    });
  }

  reportSummary(): { byMetric: Array<{ metric: string; avgMs: number; p95Ms: number; count: number }>; slowest: MetricSample[] } {
    const grouped = new Map<string, number[]>();
    for (const sample of this.samples) {
      const existing = grouped.get(sample.metric) ?? [];
      existing.push(sample.durationMs);
      grouped.set(sample.metric, existing);
    }

    const byMetric = Array.from(grouped.entries())
      .map(([metric, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const total = sorted.reduce((sum, current) => sum + current, 0);
        const avg = sorted.length ? total / sorted.length : 0;
        const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
        const p95 = sorted.length ? sorted[p95Index] : 0;
        return {
          metric,
          avgMs: Number(avg.toFixed(2)),
          p95Ms: Number(p95.toFixed(2)),
          count: sorted.length
        };
      })
      .sort((a, b) => b.avgMs - a.avgMs);

    const slowest = [...this.samples].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
    return { byMetric, slowest };
  }

  private resolveEnabled(): boolean {
    if (environment.production || typeof window === 'undefined') {
      return false;
    }
    const queryEnabled = new URLSearchParams(window.location.search).get('profileCourier') === '1';
    const storedEnabled = window.localStorage.getItem(DEV_PROFILE_STORAGE_KEY) === '1';
    return queryEnabled || storedEnabled;
  }

  private attachRouterProfiling(): void {
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        this.pendingRoute = {
          fromUrl: this.router.url || '',
          toUrl: event.url,
          startedAt: performance.now()
        };
      });

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        if (!this.pendingRoute) {
          return;
        }
        const pending = this.pendingRoute;
        const navDuration = performance.now() - pending.startedAt;
        this.record('route-change-render', navDuration, {
          from: pending.fromUrl,
          to: event.urlAfterRedirects || pending.toUrl
        });

        const isCourierTarget = (event.urlAfterRedirects || pending.toUrl).startsWith('/courier-panel');
        const isAdminSource = ADMIN_ROUTE_PREFIXES.some((prefix) => pending.fromUrl.startsWith(prefix));
        if (isCourierTarget && isAdminSource) {
          this.record('admin-to-courier-navigation', navDuration, {
            from: pending.fromUrl,
            to: event.urlAfterRedirects || pending.toUrl
          });
        }

        this.pendingRoute = null;
      });
  }

  private attachWindowApi(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.__kuryonProfiler = {
      enable: () => window.localStorage.setItem(DEV_PROFILE_STORAGE_KEY, '1'),
      disable: () => window.localStorage.removeItem(DEV_PROFILE_STORAGE_KEY),
      clear: () => {
        this.samples.length = 0;
      },
      samples: () => [...this.samples],
      report: () => this.reportSummary()
    };
  }
}
