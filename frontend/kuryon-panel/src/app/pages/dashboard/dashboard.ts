import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';

import { PanelCardComponent } from '../../shared/panel-card/panel-card';
import { StatCardComponent } from '../../shared/stat-card/stat-card';
import { LiveMapComponent } from '../../shared/live-map/live-map';
import { OrderElapsedComponent } from '../../shared/order-elapsed/order-elapsed.component';
import {
  CourierItem,
  CourierStateService,
  CourierStatus
} from '../../core/services/courier-state.service';
import { OrderStateService, SharedOrderItem } from '../../core/services/order-state.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppSettings } from '../../core/models/app-settings.model';
import { ActiveDirectorContextService } from '../../core/services/active-director-context.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';
import {
  AdminDashboardMetrics,
  AdminDashboardService
} from '../../core/services/admin-dashboard.service';

type ToastType = 'success' | 'error' | 'info';
type StatTheme = 'blue' | 'green' | 'orange' | 'red' | 'purple';

type StatItem = {
  label: string;
  value: string;
  trend: string;
  theme: StatTheme;
};

type BreakItem = {
  courier: string;
  reason: string;
  duration: string;
  request: string;
};

type CourierAssignItem = {
  id: number;
  name: string;
  distance: string;
  status: string;
};

type DashboardCourierMapItem = {
  id: number;
  name: string;
  status: CourierStatus;
  lat: number;
  lng: number;
};

type DashboardCourierViewItem = CourierItem & {
  statusClass: string;
};

type ActiveOrderViewItem = SharedOrderItem & {
  canDeleteReady: boolean;
  feeLabel: string;
};

type OrderMapStatus = 'Bekliyor' | 'Yolda' | 'Teslim Edilecek' | 'Teslim Edildi';

type OrderMapItem = {
  id: string;
  company: string;
  address: string;
  status: OrderMapStatus;
  courierId: number | null;
  lat: number;
  lng: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StatCardComponent,
    PanelCardComponent,
    LiveMapComponent,
    OrderElapsedComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;
  pendingSearchTerm = '';
  pendingStatusFilter = 'Tümü';
  courierStatusFilter: 'Tümü' | CourierStatus = 'Tümü';

  pendingStatusOptions: string[] = ['Tümü', 'Bekliyor'];

  courierStatusOptions: Array<'Tümü' | CourierStatus> = [
    'Tümü',
    'Çevrimiçi',
    'Çevrimdışı',
    'Mola'
  ];

  selectedPendingOrder: SharedOrderItem | null = null;
  isOrderDetailOpen = false;
  selectedCourier: CourierAssignItem | null = null;
  isAssigningCourier = false;
  confirmDeleteOrderId: string | null = null;

  couriers: CourierItem[] = [];
  orders: SharedOrderItem[] = [];
  pendingOrders: SharedOrderItem[] = [];
  filteredPendingOrders: SharedOrderItem[] = [];
  activeOrders: ActiveOrderViewItem[] = [];
  filteredCouriers: DashboardCourierViewItem[] = [];
  breakList: BreakItem[] = [];
  availableCouriers: CourierAssignItem[] = [];
  stats: StatItem[] = [];
  courierStatusBreakdown = { online: 0, offline: 0, onBreak: 0 };
  mapCouriers: DashboardCourierMapItem[] = [];
  mapOrders: OrderMapItem[] = [];

  mapCouriersBase: DashboardCourierMapItem[] = [
    { id: 1, name: 'Mehmet Kaya', status: 'Çevrimiçi', lat: 38.7315, lng: 35.4788 },
    { id: 2, name: 'Zeynep Taş', status: 'Çevrimiçi', lat: 38.7202, lng: 35.4951 },
    { id: 3, name: 'Ali Yıldız', status: 'Mola', lat: 38.7138, lng: 35.4864 },
    { id: 4, name: 'Fatma Demir', status: 'Çevrimdışı', lat: 38.7261, lng: 35.4704 }
  ];

  showToast = false;
  toastMessage = '';
  toastType: ToastType = 'info';
  metricsLoading = false;
  metricsError = '';
  backendMetrics: AdminDashboardMetrics | null = null;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private courierState: CourierStateService,
    private orderState: OrderStateService,
    private appSettings: AppSettingsService,
    private activeDirectorContext: ActiveDirectorContextService,
    private adminDashboardService: AdminDashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.loadBackendMetrics();
    this.settings = this.appSettings.getSnapshot();
    combineLatest([
      this.courierState.couriers$,
      this.orderState.orders$,
      this.appSettings.settings$,
      this.activeDirectorContext.activeDirectorId$
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([couriers, orders, settings, directorId]) => {
        this.couriers = this.activeDirectorContext.filterCouriers(couriers, directorId);
        this.orders = this.activeDirectorContext.filterOrders(orders, directorId);
        this.settings = settings;
        this.recomputeViewModel();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    if (this.pendingSearchDebounceId) {
      clearTimeout(this.pendingSearchDebounceId);
      this.pendingSearchDebounceId = null;
    }
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  settings!: AppSettings;
  cancelWindowLabel = '';
  mapRefreshLabel = '';
  private pendingSearchDebounceId: ReturnType<typeof setTimeout> | null = null;

  private recomputeViewModel(): void {
    this.recomputeDataDrivenState();
    this.applyPendingFilters();
    this.applyCourierFilters();
  }

  private recomputeDataDrivenState(): void {
    const fallbackTotalCouriers = this.couriers.length;
    const fallbackOnlineCouriers = this.couriers.filter((c) => c.status === 'Çevrimiçi').length;
    const fallbackBreakCouriers = this.couriers.filter((c) => c.status === 'Mola').length;
    const fallbackOfflineCouriers = this.couriers.filter((c) => c.status === 'Çevrimdışı').length;

    const totalCouriers = this.backendMetrics?.totalCouriers ?? fallbackTotalCouriers;
    const onlineCouriers = this.backendMetrics?.onlineCouriers ?? fallbackOnlineCouriers;
    const breakCouriers = this.backendMetrics?.onBreakCouriers ?? fallbackBreakCouriers;
    const offlineCouriers = this.backendMetrics?.offlineCouriers ?? fallbackOfflineCouriers;
    const totalPackages = this.backendMetrics?.totalPackages ?? this.orders.length;
    const deliveredToday = this.backendMetrics?.deliveredToday ?? 0;

    this.pendingOrders = this.orders.filter((o) => o.courierId === null && o.status === 'Bekliyor');
    this.pendingOrders.sort((a, b) => {
      const aTs = typeof a.storeCallRequestedAtMs === 'number' ? a.storeCallRequestedAtMs : (a.createdAtMs ?? 0);
      const bTs = typeof b.storeCallRequestedAtMs === 'number' ? b.storeCallRequestedAtMs : (b.createdAtMs ?? 0);
      return bTs - aTs;
    });
    this.activeOrders = this.orders.filter(
      (o) => o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda'
    ).map((order) => ({
      ...order,
      canDeleteReady: order.status === 'Hazır Alınacak',
      feeLabel: `${order.fee} ₺`
    }));
    this.breakList = this.couriers
      .filter((courier) => courier.status === 'Mola')
      .map((courier) => ({
        courier: courier.name,
        reason: courier.breakReason || 'Belirtilmedi',
        duration: courier.breakMinutes ? `${courier.breakMinutes} dk` : '-',
        request: 'Onaylandı'
      }));
    this.availableCouriers = this.couriers.map((courier, index) => ({
      id: courier.id,
      name: courier.name,
      distance: `${(1.2 + index * 0.7).toFixed(1)} km`,
      status:
        courier.status === 'Çevrimiçi' &&
        courier.activeOrders < this.settings.operations.maxActivePackagesPerCourier
          ? this.t.dashboard.statusAvailable
          : courier.status === 'Çevrimiçi'
            ? this.t.dashboard.statusFull
            : courier.status
    }));
    const courierById = new Map(this.couriers.map((courier) => [courier.id, courier]));
    this.mapCouriers = this.mapCouriersBase.map((mapCourier) => {
      const matched = courierById.get(mapCourier.id);
      return matched
        ? {
            ...mapCourier,
            name: matched.name,
            status: matched.status
          }
        : mapCourier;
    });
    this.mapOrders = this.orders.map((order, index) => ({
      id: order.id,
      company: order.company,
      address: order.address,
      status:
        order.status === 'Yolda'
          ? 'Yolda'
          : order.status === 'Teslim Edildi'
            ? 'Teslim Edildi'
          : order.status === 'Hazır Alınacak'
            ? 'Teslim Edilecek'
            : 'Bekliyor',
      courierId: order.courierId,
      lat: 38.7272 + index * 0.003,
      lng: 35.4898 + index * 0.003
    }));
    this.courierStatusBreakdown = {
      online: onlineCouriers,
      offline: offlineCouriers,
      onBreak: breakCouriers
    };
    this.stats = [
      {
        label: 'Toplam Paket',
        value: String(totalPackages),
        trend: `${this.backendMetrics?.assignedPackages ?? this.pendingOrders.length} atama bekliyor`,
        theme: 'blue'
      },
      {
        label: this.t.dashboard.statTotalCouriers,
        value: String(totalCouriers),
        trend: `${onlineCouriers} çevrimiçi`,
        theme: 'purple'
      },
      {
        label: this.t.dashboard.statOnlineCouriers,
        value: String(onlineCouriers),
        trend: this.t.dashboard.trendActive,
        theme: 'green'
      },
      {
        label: this.t.dashboard.statOfflineCouriers,
        value: String(offlineCouriers),
        trend: this.t.dashboard.trendPassive,
        theme: 'red'
      },
      {
        label: 'Bugün Teslim',
        value: String(deliveredToday),
        trend: `${(this.backendMetrics?.totalRevenueToday ?? 0).toFixed(2)} ₺ ciro`,
        theme: 'orange'
      },
      {
        label: 'Bekleyen Başvuru',
        value: String(this.backendMetrics?.pendingApplications ?? 0),
        trend: this.t.dashboard.trendLiveData,
        theme: 'red'
      },
      {
        label: this.t.dashboard.statBreakCouriers,
        value: String(breakCouriers),
        trend: this.t.dashboard.trendLiveData,
        theme: 'purple'
      }
    ];
    this.cancelWindowLabel = `İptal penceresi: ${this.settings.operations.orderCancelWindowMinutes} dk`;
    this.mapRefreshLabel = `Harita yenileme: ${this.settings.mapLocation.liveRefreshSeconds} sn`;
  }

  private applyPendingFilters(): void {
    const searchValue = this.pendingSearchTerm.trim().toLowerCase();
    this.filteredPendingOrders = this.pendingOrders.filter((order) => {
      const matchesStatus =
        this.pendingStatusFilter === 'Tümü' || order.status === this.pendingStatusFilter;
      const matchesSearch =
        !searchValue ||
        order.id.toLowerCase().includes(searchValue) ||
        order.company.toLowerCase().includes(searchValue) ||
        order.address.toLowerCase().includes(searchValue);
      return matchesStatus && matchesSearch;
    });
  }

  private applyCourierFilters(): void {
    this.filteredCouriers = this.couriers
      .filter((courier) => {
        if (this.courierStatusFilter === 'Tümü') {
          return true;
        }
        return courier.status === this.courierStatusFilter;
      })
      .map((courier) => ({
        ...courier,
        statusClass: this.buildCourierStatusClass(courier.status)
      }));
  }

  setPendingStatusFilter(status: string): void {
    this.pendingStatusFilter = status;
    this.applyPendingFilters();
  }

  setCourierStatusFilter(status: 'Tümü' | CourierStatus): void {
    this.courierStatusFilter = status;
    this.applyCourierFilters();
  }

  private buildCourierStatusClass(status: CourierStatus): string {
    switch (status) {
      case 'Çevrimiçi':
        return 'live-status online';
      case 'Çevrimdışı':
        return 'live-status offline';
      case 'Mola':
        return 'live-status break';
      default:
        return 'live-status';
    }
  }

  openOrderDetail(order: SharedOrderItem): void {
    const fresh = this.orders.find((o) => o.id === order.id);
    if (!fresh || fresh.courierId !== null || fresh.status !== 'Bekliyor') {
      this.openToast(this.t.dashboard.orderUnavailable, 'info');
      return;
    }
    this.selectedPendingOrder = fresh;
    this.selectedCourier = null;
    this.isOrderDetailOpen = true;
  }

  closeOrderDetail(): void {
    if (this.isAssigningCourier) {
      return;
    }

    this.isOrderDetailOpen = false;
    this.selectedPendingOrder = null;
    this.selectedCourier = null;
  }

  selectCourier(courier: CourierAssignItem): void {
    if (courier.status !== 'Müsait') {
      return;
    }

    this.selectedCourier = courier;
  }

  async assignCourier(): Promise<void> {
    if (!this.selectedPendingOrder || !this.selectedCourier || this.isAssigningCourier) {
      return;
    }

    this.isAssigningCourier = true;

    const selectedOrder = { ...this.selectedPendingOrder };
    const selectedCourier = { ...this.selectedCourier };

    try {
      const assigned = await this.courierState.assignPendingOrderToCourier(
        selectedOrder.id,
        selectedCourier.id,
        selectedCourier.name
      );

      this.isAssigningCourier = false;
      if (!assigned) {
        this.openToast(this.t.dashboard.orderNotAssignable, 'info');
        return;
      }

      this.isOrderDetailOpen = false;
      this.selectedPendingOrder = null;
      this.selectedCourier = null;
      this.openToast(
        `${selectedOrder.id} siparişi ${selectedCourier.name} kuryesine atandı.`,
        'success'
      );
    } catch {
      this.isAssigningCourier = false;
      this.openToast(this.t.dashboard.assignError, 'error');
    }
  }

  openDeleteConfirm(orderId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.confirmDeleteOrderId = orderId;
  }

  cancelDelete(): void {
    this.confirmDeleteOrderId = null;
  }

  confirmDeleteReadyForPickup(order: SharedOrderItem, event: MouseEvent): void {
    event.stopPropagation();
    const removed = this.orderState.removeReadyForPickupOrder(order.id);
    this.confirmDeleteOrderId = null;
    if (removed) {
      this.openToast(`${order.id} ${this.t.dashboard.orderDeleted}`, 'success');
    } else {
      this.openToast(this.t.dashboard.onlyReadyPickupDelete, 'info');
    }
  }

  trackByOrderId(_: number, order: SharedOrderItem): string {
    return order.id;
  }

  trackByCourierId(_: number, courier: CourierItem): number {
    return courier.id;
  }

  trackByCourierAssignId(_: number, courier: CourierAssignItem): number {
    return courier.id;
  }

  trackByStatLabel(_: number, item: StatItem): string {
    return item.label;
  }

  trackByStatus(_: number, status: string): string {
    return status;
  }

  trackByBreakCourier(_: number, item: BreakItem): string {
    return item.courier;
  }

  onPendingSearchChange(value: string): void {
    this.pendingSearchTerm = value;
    if (this.pendingSearchDebounceId) {
      clearTimeout(this.pendingSearchDebounceId);
    }
    this.pendingSearchDebounceId = setTimeout(() => {
      this.applyPendingFilters();
      this.pendingSearchDebounceId = null;
      this.cdr.markForCheck();
    }, 140);
  }

  openToast(message: string, type: ToastType): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }

    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;

    this.toastTimeoutId = setTimeout(() => {
      this.closeToast();
      this.cdr.markForCheck();
    }, 3000);
  }

  closeToast(): void {
    this.showToast = false;
    this.toastMessage = '';

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  private async loadBackendMetrics(): Promise<void> {
    this.metricsLoading = true;
    this.metricsError = '';
    try {
      this.backendMetrics = await this.adminDashboardService.getMetrics();
    } catch (error: unknown) {
      this.metricsError = error instanceof Error ? error.message : 'Dashboard metrikleri yüklenemedi.';
      this.backendMetrics = null;
    } finally {
      this.metricsLoading = false;
      this.recomputeViewModel();
      this.cdr.markForCheck();
    }
  }

}