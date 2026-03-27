import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { CourierStateService } from './courier-state.service';
import {
  CourierDeliveredDaySummary,
  CourierDeliveredPaymentBreakdown,
  OrderStateService,
  SharedOrderItem
} from './order-state.service';

export type CourierReportDayDetail = {
  dayKey: string;
  label: string;
  breakdown: CourierDeliveredPaymentBreakdown;
  orders: SharedOrderItem[];
};

@Injectable({
  providedIn: 'root'
})
export class CourierReportHistoryService {
  private readonly orderState = inject(OrderStateService);
  private readonly courierState = inject(CourierStateService);

  /** Mevcut kurye için `orders$` ile güncellenen günlük özet listesi. */
  observeDaySummariesForCurrentCourier(): Observable<CourierDeliveredDaySummary[]> {
    return this.orderState.orders$.pipe(
      map(() =>
        this.orderState.getCourierDeliveredDaySummaries(this.courierState.getCurrentCourierId())
      )
    );
  }

  getDayDetail(courierId: number, dayKey: string): CourierReportDayDetail {
    const orders = this.orderState.getCourierDeliveredOrdersForDay(courierId, dayKey);
    const breakdown = this.orderState.getPaymentBreakdownFromOrders(orders);
    return {
      dayKey,
      label: this.orderState.getCourierDayLabel(dayKey),
      breakdown,
      orders
    };
  }
}
