import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  BreakReason,
  CourierItem,
  CourierStateService,
  CourierStatus
} from '../../core/services/courier-state.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppSettings } from '../../core/models/app-settings.model';

@Component({
  selector: 'app-courier-layout-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './courier-layout-page.html',
  styleUrls: [
    './courier-layout-page.css',
    './courier-layout-modal.css',
    '../../shared/styles/panel-page-enter.css'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierLayoutPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private centerPanelCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly centerPanelAnimMs = 200;
  courier: CourierItem | null = null;

  /** Salt okunur örnek vardiya özeti (panel verisiyle bağlanmaz). */
  readonly shiftInfoLines = [
    'Bugünkü vardiya: 09:00 – 18:00',
    'Hafta içi planlı çalışma; detaylı plan operasyon tarafından yönetilir.',
    'Bu ekran yalnızca bilgilendirme amaçlıdır; değişiklik talepleri için yöneticinize başvurun.'
  ];

  isShiftInfoOpen = false;

  statusOptions: CourierStatus[] = ['Çevrimiçi', 'Çevrimdışı', 'Mola'];
  breakOptions: Exclude<BreakReason, null>[] = ['Benzin', 'Yemek', 'Tamir'];
  /** Sabit mola süreleri (dakika). */
  readonly breakDurationMinutesOptions = [2, 5, 10, 15, 20, 25, 30];

  centerPanelMode: 'none' | 'confirm' = 'none';
  isCenterPanelRendered = false;
  isCenterPanelClosing = false;
  isBreakModalOpen = false;
  centerMessage = '';

  pendingStatusSelection: CourierStatus | null = null;
  selectedBreakOption: Exclude<BreakReason, null> | null = null;
  pendingBreakMinutes: number | null = null;
  settings: AppSettings;
  statusSliderTransform = 'translateX(0%)';

  constructor(
    private courierState: CourierStateService,
    private appSettings: AppSettingsService,
    private cdr: ChangeDetectorRef
  ) {
    this.settings = this.appSettings.getSnapshot();
  }

  ngOnInit(): void {
    this.refreshCourier();

    this.courierState.couriers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshCourier();
        this.cdr.markForCheck();
      });

    this.appSettings.settings$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.settings = settings;
        this.cdr.markForCheck();
      });

    this.destroyRef.onDestroy(() => {
      if (this.centerPanelCloseTimer) {
        clearTimeout(this.centerPanelCloseTimer);
        this.centerPanelCloseTimer = null;
      }
      if (typeof document !== 'undefined') {
        document.body.classList.remove('modal-scroll-lock');
      }
    });
  }

  openShiftInfo(): void {
    this.isShiftInfoOpen = true;
    this.syncModalScrollLock();
  }

  closeShiftInfo(): void {
    this.isShiftInfoOpen = false;
    this.syncModalScrollLock();
  }

  refreshCourier(): void {
    this.courier = this.courierState.getCurrentCourier() ?? null;
    const statusIndex = this.courier ? this.statusOptions.indexOf(this.courier.status) : 0;
    this.statusSliderTransform = `translateX(${Math.max(statusIndex, 0) * 100}%)`;
  }

  setCourierStatus(status: CourierStatus): void {
    if (!this.courier || status === this.courier.status) {
      return;
    }

    if (status === 'Mola') {
      if (!this.settings.shiftBreak.allowBreakRequests) {
        this.centerMessage = 'Mola talebi ayarlardan devre dışı bırakılmış.';
        this.pendingStatusSelection = null;
        this.openCenterPanel('confirm');
        return;
      }
      if (this.settings.shiftBreak.peakHoursBreakRestriction && this.isPeakHour()) {
        this.centerMessage = 'Yoğun saat aralığında mola kısıtı aktif.';
        this.pendingStatusSelection = null;
        this.openCenterPanel('confirm');
        return;
      }
      this.pendingStatusSelection = null;
      this.centerMessage = '';
      this.openCenterPanel('none');
      this.pendingBreakMinutes = this.settings.shiftBreak.defaultBreakMinutes;
      this.isBreakModalOpen = true;
      this.syncModalScrollLock();
      return;
    }

    this.pendingStatusSelection = status;
    this.centerMessage = '';
    this.openCenterPanel('confirm');
  }

  confirmPendingStatus(): void {
    if (!this.courier || !this.pendingStatusSelection) {
      return;
    }
    const nextStatus = this.pendingStatusSelection;

    this.courierState.setCourierOnlineStatus(this.courier.id, nextStatus as 'Çevrimiçi' | 'Çevrimdışı');
    this.pendingStatusSelection = null;
    this.closeCenterPanel();
  }

  cancelPendingStatus(): void {
    this.pendingStatusSelection = null;
    this.closeCenterPanel();
  }

  closeCenterPanel(): void {
    if (!this.isCenterPanelRendered) {
      this.pendingStatusSelection = null;
      this.centerPanelMode = 'none';
      this.isCenterPanelClosing = false;
      return;
    }

    this.isCenterPanelClosing = true;
    if (this.centerPanelCloseTimer) {
      clearTimeout(this.centerPanelCloseTimer);
    }
    this.centerPanelCloseTimer = setTimeout(() => {
      this.pendingStatusSelection = null;
      this.selectedBreakOption = null;
      this.pendingBreakMinutes = null;
      this.isCenterPanelRendered = false;
      this.centerPanelMode = 'none';
      this.isCenterPanelClosing = false;
      this.centerPanelCloseTimer = null;
    }, this.centerPanelAnimMs);
  }

  selectBreakReason(reason: Exclude<BreakReason, null>): void {
    this.selectedBreakOption = reason;
  }

  selectBreakMinutes(minutes: number): void {
    this.pendingBreakMinutes = minutes;
  }

  submitBreakSelection(): void {
    if (!this.courier || !this.selectedBreakOption || !this.pendingBreakMinutes || this.pendingBreakMinutes <= 0) {
      return;
    }

    this.courierState.setCourierBreak(
      this.courier.id,
      this.selectedBreakOption,
      this.pendingBreakMinutes
    );

    this.closeBreakModal();
  }

  closeBreakModal(): void {
    this.isBreakModalOpen = false;
    this.selectedBreakOption = null;
    this.pendingBreakMinutes = null;
    this.syncModalScrollLock();
  }

  trackByString(_: number, value: string): string {
    return value;
  }

  trackByNumber(_: number, value: number): number {
    return value;
  }

  private openCenterPanel(mode: 'confirm' | 'none'): void {
    if (this.centerPanelCloseTimer) {
      clearTimeout(this.centerPanelCloseTimer);
      this.centerPanelCloseTimer = null;
    }
    if (mode === 'none') {
      this.isCenterPanelRendered = false;
      this.centerPanelMode = 'none';
      this.isCenterPanelClosing = false;
      return;
    }
    this.isCenterPanelRendered = true;
    this.centerPanelMode = mode;
    this.isCenterPanelClosing = false;
  }

  private syncModalScrollLock(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const shouldLock = this.isBreakModalOpen || this.isShiftInfoOpen;
    document.body.classList.toggle('modal-scroll-lock', shouldLock);
  }

  private isPeakHour(): boolean {
    const hour = new Date().getHours();
    return (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
  }
}