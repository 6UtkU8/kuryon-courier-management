import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type UiToastType = 'success' | 'error' | 'info';

export type UiToast = {
  id: number;
  type: UiToastType;
  message: string;
  durationMs: number;
};

@Injectable({ providedIn: 'root' })
export class UiNoticeService {
  private readonly criticalMessageSubject = new BehaviorSubject<string | null>(null);
  readonly criticalMessage$ = this.criticalMessageSubject.asObservable();
  private readonly toastSubject = new BehaviorSubject<UiToast | null>(null);
  readonly toast$ = this.toastSubject.asObservable();
  private toastIdCounter = 1;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  setCriticalMessage(message: string): void {
    this.criticalMessageSubject.next(message);
  }

  clearCriticalMessage(): void {
    this.criticalMessageSubject.next(null);
  }

  showToast(message: string, type: UiToastType = 'info', durationMs = 2600): void {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    const toast: UiToast = {
      id: this.toastIdCounter++,
      type,
      message: trimmed,
      durationMs
    };

    this.toastSubject.next(toast);
    this.toastTimer = setTimeout(() => {
      this.dismissToast(toast.id);
    }, durationMs);
  }

  dismissToast(id?: number): void {
    const active = this.toastSubject.value;
    if (!active) {
      return;
    }
    if (id !== undefined && active.id !== id) {
      return;
    }
    this.toastSubject.next(null);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
}
