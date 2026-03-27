import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CourierStateService } from '../../core/services/courier-state.service';
import { OrderStateService, SharedOrderItem } from '../../core/services/order-state.service';
import { OrderElapsedComponent } from '../../shared/order-elapsed/order-elapsed.component';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Component({
  selector: 'app-courier-tools-page',
  standalone: true,
  imports: [CommonModule, OrderElapsedComponent],
  templateUrl: './courier-tools-page.html',
  styleUrls: ['./courier-tools-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierToolsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;
  poolOrders: SharedOrderItem[] = [];

  constructor(
    private orderState: OrderStateService,
    private courierState: CourierStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderState.poolOrders$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((poolOrders) => {
        this.poolOrders = poolOrders;
        this.cdr.markForCheck();
      });
  }

  claimOrder(order: SharedOrderItem, ev: Event): void {
    ev.stopPropagation();
    const courier = this.courierState.getCurrentCourier();
    if (!courier) {
      return;
    }
    if (order.courierId !== null || order.status !== 'Bekliyor') {
      return;
    }
    this.courierState.assignPendingOrderToCourier(order.id, courier.id, courier.name);
  }

  formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  trackByOrderId(_: number, order: SharedOrderItem): string {
    return order.id;
  }
}
