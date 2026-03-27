import { inject, Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  APP_SETTINGS_STORAGE_KEY,
  AppSettings,
  DEFAULT_APP_SETTINGS
} from '../models/app-settings.model';
import {
  readJsonFromLocalStorage,
  subscribePanelSync,
  writeJsonToLocalStorage
} from '../utils/panel-sync.util';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private readonly ngZone = inject(NgZone);
  private readonly settingsSubject = new BehaviorSubject<AppSettings>(this.readInitialSettings());
  readonly settings$ = this.settingsSubject.asObservable();

  constructor() {
    this.attachCrossTabStorageListener();
    this.attachBroadcastSyncListener();
    this.applyBrandTokens(this.settingsSubject.value);
  }

  getSnapshot(): AppSettings {
    return this.settingsSubject.value;
  }

  update(mutator: (current: AppSettings) => AppSettings): void {
    const next = this.mergeWithDefaults(mutator(this.settingsSubject.value));
    this.nextSettings(next, true);
  }

  patch(patch: DeepPartial<AppSettings>): void {
    const next = this.deepMergeSettings(this.settingsSubject.value, patch, true);
    this.nextSettings(next, true);
  }

  updateByPath(path: string, value: string | number | boolean): void {
    const parts = path.split('.');
    if (parts.length === 0) {
      return;
    }

    const next = JSON.parse(JSON.stringify(this.settingsSubject.value)) as Record<string, unknown>;
    let cursor = next;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      const child = cursor[key];
      if (!child || typeof child !== 'object') {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;

    const merged = this.mergeWithDefaults(next as unknown as AppSettings);
    merged.meta = {
      ...merged.meta,
      updatedAtIso: new Date().toISOString()
    };
    this.nextSettings(merged, true);
  }

  reset(): void {
    const resetValue: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      meta: {
        ...DEFAULT_APP_SETTINGS.meta,
        updatedAtIso: new Date().toISOString()
      }
    };
    this.nextSettings(resetValue, true);
  }

  private readInitialSettings(): AppSettings {
    const parsed = readJsonFromLocalStorage<Partial<AppSettings>>(APP_SETTINGS_STORAGE_KEY);
    if (!parsed) {
      return DEFAULT_APP_SETTINGS;
    }
    return this.mergeWithDefaults(parsed);
  }

  private mergeWithDefaults(parsed: Partial<AppSettings>): AppSettings {
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      general: { ...DEFAULT_APP_SETTINGS.general, ...parsed.general },
      operations: { ...DEFAULT_APP_SETTINGS.operations, ...parsed.operations },
      automation: { ...DEFAULT_APP_SETTINGS.automation, ...parsed.automation },
      mapLocation: { ...DEFAULT_APP_SETTINGS.mapLocation, ...parsed.mapLocation },
      regionPricing: { ...DEFAULT_APP_SETTINGS.regionPricing, ...parsed.regionPricing },
      financePayment: { ...DEFAULT_APP_SETTINGS.financePayment, ...parsed.financePayment },
      shiftBreak: { ...DEFAULT_APP_SETTINGS.shiftBreak, ...parsed.shiftBreak },
      notifications: { ...DEFAULT_APP_SETTINGS.notifications, ...parsed.notifications },
      brandAppearance: { ...DEFAULT_APP_SETTINGS.brandAppearance, ...parsed.brandAppearance },
      securityLogs: { ...DEFAULT_APP_SETTINGS.securityLogs, ...parsed.securityLogs },
      meta: { ...DEFAULT_APP_SETTINGS.meta, ...parsed.meta }
    };
  }

  private deepMergeSettings(
    base: AppSettings,
    patch: DeepPartial<AppSettings>,
    touchUpdatedAt: boolean
  ): AppSettings {
    const next: AppSettings = {
      ...base,
      ...patch,
      general: { ...base.general, ...patch.general },
      operations: { ...base.operations, ...patch.operations },
      automation: { ...base.automation, ...patch.automation },
      mapLocation: { ...base.mapLocation, ...patch.mapLocation },
      regionPricing: { ...base.regionPricing, ...patch.regionPricing },
      financePayment: { ...base.financePayment, ...patch.financePayment },
      shiftBreak: { ...base.shiftBreak, ...patch.shiftBreak },
      notifications: { ...base.notifications, ...patch.notifications },
      brandAppearance: { ...base.brandAppearance, ...patch.brandAppearance },
      securityLogs: { ...base.securityLogs, ...patch.securityLogs },
      meta: {
        ...base.meta,
        ...patch.meta
      }
    };

    if (touchUpdatedAt) {
      next.meta = {
        ...next.meta,
        updatedAtIso: new Date().toISOString()
      };
    }

    return this.mergeWithDefaults(next);
  }

  private nextSettings(next: AppSettings, persist: boolean): void {
    this.settingsSubject.next(next);
    if (persist) {
      writeJsonToLocalStorage(APP_SETTINGS_STORAGE_KEY, next);
    }
    this.applyBrandTokens(next);
  }

  private attachCrossTabStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', this.onSettingsStorage);
  }

  private readonly onSettingsStorage = (ev: StorageEvent): void => {
    if (ev.key !== APP_SETTINGS_STORAGE_KEY || ev.newValue == null) return;
    try {
      const parsed = JSON.parse(ev.newValue) as Partial<AppSettings>;
      this.ngZone.run(() => {
        this.nextSettings(this.mergeWithDefaults(parsed), false);
      });
    } catch {
      // ignore
    }
  };

  private attachBroadcastSyncListener(): void {
    subscribePanelSync(APP_SETTINGS_STORAGE_KEY, (valueJson) => {
      try {
        const parsed = JSON.parse(valueJson) as Partial<AppSettings>;
        this.ngZone.run(() => {
          this.nextSettings(this.mergeWithDefaults(parsed), false);
        });
      } catch {
        // ignore
      }
    });
  }

  private applyBrandTokens(value: AppSettings): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const accent = value.brandAppearance.accentPreset;

    if (accent === 'violet') {
      root.style.setProperty('--brand-accent-1', '#8b5cf6');
      root.style.setProperty('--brand-accent-2', '#6366f1');
    } else if (accent === 'emerald') {
      root.style.setProperty('--brand-accent-1', '#10b981');
      root.style.setProperty('--brand-accent-2', '#06b6d4');
    } else if (accent === 'amber') {
      root.style.setProperty('--brand-accent-1', '#f59e0b');
      root.style.setProperty('--brand-accent-2', '#f97316');
    } else {
      root.style.setProperty('--brand-accent-1', '#21c7b7');
      root.style.setProperty('--brand-accent-2', '#7b61ff');
    }

    body.classList.toggle('kuryon-compact', value.brandAppearance.cardDensity === 'compact');
    body.classList.toggle('kuryon-glass-soft', value.brandAppearance.useGlassSurfaces);
  }
}
