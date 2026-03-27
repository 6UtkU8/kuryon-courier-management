import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { OrderElapsedComponent } from '../../shared/order-elapsed/order-elapsed.component';
import {
  DeliveryState,
  OrderStateService,
  SharedOrderItem
} from '../../core/services/order-state.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppSettings } from '../../core/models/app-settings.model';
import { DirectorPermissionService } from '../../core/services/director-permission.service';
import { ActiveDirectorContextService } from '../../core/services/active-director-context.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';
import { CourierStateService } from '../../core/services/courier-state.service';
import { UiNoticeService } from '../../core/services/ui-notice.service';

type OrderViewItem = SharedOrderItem & {
  totalLabel: string;
  statusLabel: string;
  statusClass: string;
  autoAssignHint: string | null;
  hasDeliveryNote: boolean;
  deliveryNotePreview: string;
  deliveryNoteFull: string;
};

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderElapsedComponent],
  templateUrl: './orders-page.html',
  styleUrls: ['./orders-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;
  searchTerm = '';
  /** 'Tümü' veya DeliveryState */
  statusFilter: DeliveryState | 'Tümü' = 'Tümü';
  originFilter: 'all' | 'store_call' = 'all';
  noteFilter: 'all' | 'with_note' | 'long_note' = 'all';

  readonly statusOptions: { key: DeliveryState | 'Tümü'; label: string }[] = [
    { key: 'Tümü', label: 'Tümü' },
    { key: 'Bekliyor', label: 'Bekliyor' },
    { key: 'Atandı', label: 'Kurye Atandı' },
    { key: 'Hazır Alınacak', label: 'Hazır Alınacak' },
    { key: 'Yolda', label: 'Yolda' },
    { key: 'Teslim Edildi', label: 'Teslim Edildi' }
  ];

  orders: SharedOrderItem[] = [];
  orderViews: OrderViewItem[] = [];
  filteredOrders: OrderViewItem[] = [];
  overCancelWindowCount = 0;
  canAssignOrder = false;
  canViewAllOrders = false;
  isLoading = true;
  pageError = '';
  assigningOrderId: string | null = null;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly orderState: OrderStateService,
    private readonly courierState: CourierStateService,
    private readonly appSettings: AppSettingsService,
    private readonly uiNotice: UiNoticeService,
    private readonly directorPermissions: DirectorPermissionService,
    private readonly activeDirectorContext: ActiveDirectorContextService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.pageError = '';
    void this.loadOrders();
    this.canAssignOrder = this.directorPermissions.can('assign_order');
    this.canViewAllOrders = this.directorPermissions.can('view_all_orders');
    combineLatest([
      this.orderState.orders$,
      this.appSettings.settings$,
      this.activeDirectorContext.activeDirectorId$
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([orders, settings, directorId]) => {
        this.orders = this.activeDirectorContext.filterOrders(orders, directorId);
        this.orderViews = this.orders.map((order) => ({
          ...this.mapDeliveryNote(order),
          ...order,
          totalLabel: this.formatTotal(order.fee),
          statusLabel: this.displayStatus(order.status),
          statusClass: this.getStatusClass(order.status),
          autoAssignHint: null
        }));
        this.settings = settings;
        this.recomputeFilteredOrders();
        this.cdr.markForCheck();
    });
    this.directorPermissions.currentDirector$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.canAssignOrder = this.directorPermissions.can('assign_order');
        this.canViewAllOrders = this.directorPermissions.can('view_all_orders');
        this.recomputeFilteredOrders();
        this.cdr.markForCheck();
      });
    this.countdownIntervalId = setInterval(() => {
      this.recomputeFilteredOrders();
      this.cdr.markForCheck();
    }, 1000);
  }

  settings!: AppSettings;

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private recomputeFilteredOrders(): void {
    const list = this.orderViews.filter((order) => {
      const search = this.searchTerm.trim().toLowerCase();
      const courierLabel = order.courierName ?? '-';

      const matchesSearch =
        !search ||
        order.id.toLowerCase().includes(search) ||
        order.company.toLowerCase().includes(search) ||
        order.customer.toLowerCase().includes(search) ||
        order.address.toLowerCase().includes(search) ||
        courierLabel.toLowerCase().includes(search);

      const matchesStatus =
        this.statusFilter === 'Tümü' || order.status === this.statusFilter;
      const matchesOrigin =
        this.originFilter === 'all' || order.origin === this.originFilter;
      const matchesNote =
        this.noteFilter === 'all' ||
        (this.noteFilter === 'with_note' && order.hasDeliveryNote) ||
        (this.noteFilter === 'long_note' && order.deliveryNoteFull.length > 90);

      return matchesSearch && matchesStatus && matchesOrigin && matchesNote;
    }).sort((a, b) => this.getOrderSortValue(b) - this.getOrderSortValue(a));
    const visible = this.canViewAllOrders ? list : list.slice(0, 8);
    this.filteredOrders = visible.map((order) => ({
      ...order,
      autoAssignHint: this.getAutoAssignHint(order)
    }));

    const thresholdMs = this.settings.operations.orderCancelWindowMinutes * 60_000;
    const now = Date.now();
    this.overCancelWindowCount = this.orders.filter((order) => {
      if (order.status !== 'Bekliyor' || typeof order.createdAtMs !== 'number') {
        return false;
      }
      return now - order.createdAtMs > thresholdMs;
    }).length;
  }

  formatTotal(fee: number): string {
    return `₺${fee.toFixed(2).replace('.', ',')}`;
  }

  displayStatus(status: DeliveryState): string {
    switch (status) {
      case 'Atandı':
        return 'Kurye Atandı';
      default:
        return status;
    }
  }

  setStatusFilter(key: DeliveryState | 'Tümü'): void {
    this.statusFilter = key;
    this.recomputeFilteredOrders();
  }

  setOriginFilter(filter: 'all' | 'store_call'): void {
    this.originFilter = filter;
    this.recomputeFilteredOrders();
  }

  setNoteFilter(filter: 'all' | 'with_note' | 'long_note'): void {
    this.noteFilter = filter;
    this.recomputeFilteredOrders();
  }

  getStatusClass(status: DeliveryState): string {
    switch (status) {
      case 'Bekliyor':
        return 'status-warning';
      case 'Atandı':
      case 'Hazır Alınacak':
        return 'status-preparing';
      case 'Yolda':
        return 'status-success';
      case 'Teslim Edildi':
        return 'status-delivered';
      default:
        return '';
    }
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
    }
    this.searchDebounceId = setTimeout(() => {
      this.recomputeFilteredOrders();
      this.searchDebounceId = null;
      this.cdr.markForCheck();
    }, 140);
  }

  trackByOrderId(_: number, order: OrderViewItem): string {
    return order.id;
  }

  trackByStatusOption(_: number, option: { key: DeliveryState | 'Tümü'; label: string }): string {
    return option.key;
  }

  canShowAssignAction(order: OrderViewItem): boolean {
    if (!this.canAssignOrder) {
      return false;
    }
    return order.status === 'Bekliyor' || order.status === 'Atandı';
  }

  getAssignActionLabel(order: OrderViewItem): string {
    if (order.status === 'Atandı' && order.courierId !== null) {
      return 'Yeniden Ata';
    }
    return this.t.orders.assignOrder;
  }

  async onAssignOrderClick(order: OrderViewItem): Promise<void> {
    if (!this.canShowAssignAction(order) || this.assigningOrderId) {
      return;
    }
    this.assigningOrderId = order.id;
    const result = await this.courierState.assignOrderToBestCourier(order.id);
    if (result.ok) {
      this.uiNotice.showToast(`${order.id} siparişi ${result.courierName ?? ''} kuryesine atandı.`, 'success');
    } else {
      this.uiNotice.showToast(result.message, 'error');
    }
    this.assigningOrderId = null;
  }

  async reloadOrders(): Promise<void> {
    await this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    this.isLoading = true;
    this.pageError = '';
    try {
      await this.orderState.reloadFromBackend();
    } catch (error: unknown) {
      this.pageError = error instanceof Error ? error.message : 'Siparişler yüklenemedi.';
      this.uiNotice.showToast(this.pageError, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private getAutoAssignHint(order: OrderViewItem): string | null {
    if (order.status !== 'Bekliyor' || order.courierId !== null) {
      return order.assignmentSource === 'auto' ? 'Otomatik atandı' : null;
    }
    if (!this.settings.automation.autoAssignCourier) {
      return 'Manuel atama bekliyor';
    }
    const delayMs = Math.max(0, Math.floor(this.settings.automation.autoAssignDelaySeconds)) * 1000;
    const createdAtMs = typeof order.createdAtMs === 'number' ? order.createdAtMs : Date.now();
    const remainingMs = createdAtMs + delayMs - Date.now();
    if (remainingMs > 0) {
      return `Otomatik atamaya kalan: ${Math.ceil(remainingMs / 1000)} sn`;
    }
    return 'Uygun kurye bulunursa otomatik atanacak';
  }

  private getOrderSortValue(order: OrderViewItem): number {
    if (typeof order.storeCallRequestedAtMs === 'number') {
      return order.storeCallRequestedAtMs;
    }
    if (typeof order.createdAtMs === 'number') {
      return order.createdAtMs;
    }
    return 0;
  }

  private mapDeliveryNote(order: SharedOrderItem): Pick<OrderViewItem, 'hasDeliveryNote' | 'deliveryNotePreview' | 'deliveryNoteFull'> {
    const deliveryNoteFull = (order.deliveryNote ?? order.customerNote ?? order.note ?? '').trim();
    return {
      hasDeliveryNote: deliveryNoteFull.length > 0,
      deliveryNotePreview:
        deliveryNoteFull.length > 90 ? `${deliveryNoteFull.slice(0, 90).trimEnd()}...` : deliveryNoteFull,
      deliveryNoteFull
    };
  }
}
