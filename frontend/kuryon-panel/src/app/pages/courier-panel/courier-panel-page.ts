import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BreakReason,
  CourierItem,
  CourierStateService,
  CourierStatus
} from '../../core/services/courier-state.service';
import { OrderStateService, SharedOrderItem } from '../../core/services/order-state.service';

@Component({
  selector: 'app-courier-panel-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './courier-panel-page.html',
  styleUrls: ['./courier-panel-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierPanelPageComponent implements OnInit {
  private readonly courierState = inject(CourierStateService);
  private readonly orderState = inject(OrderStateService);
  private readonly destroyRef = inject(DestroyRef);

  courier: CourierItem | null = null;
  history: SharedOrderItem[] = [];
  historyTotalLabels: Record<string, string> = {};

  deliveredCount = 0;
  totalRevenue = 0;
  onlineMinutes = 0;

  statusOptions: CourierStatus[] = ['Çevrimiçi', 'Çevrimdışı', 'Mola'];
  breakOptions: Exclude<BreakReason, null>[] = ['Benzin', 'Yemek', 'Tamir'];

  isBreakModalOpen = false;
  isStatusConfirmModalOpen = false;

  pendingStatusSelection: CourierStatus | null = null;
  selectedBreakOption: Exclude<BreakReason, null> | null = null;
  pendingBreakMinutes: number | null = null;

  ngOnInit(): void {
    this.refreshData();

    this.courierState.couriers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshData();
      });

    this.orderState.orders$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshData();
      });
  }

  refreshData(): void {
    this.courier = this.courierState.getCurrentCourier() ?? null;
    const courierId = this.courierState.getCurrentCourierId();
    this.history = this.orderState.getCourierDeliveredOrders(courierId).slice(0, 6);
    this.historyTotalLabels = this.history.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = this.formatAmount(item.fee);
      return acc;
    }, {});
    this.deliveredCount = this.history.length;
    this.totalRevenue = this.history.reduce((sum, item) => sum + item.fee, 0);
    this.onlineMinutes = 0;
  }

  setCourierStatus(status: CourierStatus): void {
    if (!this.courier || status === this.courier.status) {
      return;
    }

    if (status === 'Mola') {
      this.isBreakModalOpen = true;
      return;
    }

    this.pendingStatusSelection = status;
    this.isStatusConfirmModalOpen = true;
  }

  confirmPendingStatus(): void {
    if (!this.courier || !this.pendingStatusSelection) {
      return;
    }

    this.courierState.setCourierOnlineStatus(
      this.courier.id,
      this.pendingStatusSelection as 'Çevrimiçi' | 'Çevrimdışı'
    );

    this.pendingStatusSelection = null;
    this.isStatusConfirmModalOpen = false;
  }

  closeStatusConfirmModal(): void {
    this.pendingStatusSelection = null;
    this.isStatusConfirmModalOpen = false;
  }

  selectBreakReason(reason: Exclude<BreakReason, null>): void {
    this.selectedBreakOption = reason;
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
  }

  formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  getStatusIndex(): number {
    if (!this.courier) {
      return 0;
    }

    return this.statusOptions.indexOf(this.courier.status);
  }

  trackByOrderId(_: number, item: SharedOrderItem): string {
    return item.id;
  }

  trackByStatus(_: number, status: CourierStatus): CourierStatus {
    return status;
  }

  trackByBreakReason(_: number, reason: Exclude<BreakReason, null>): Exclude<BreakReason, null> {
    return reason;
  }
}