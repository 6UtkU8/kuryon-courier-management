import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OrderStateService } from './order-state.service';

/** Açık ödeme detayı; `orders$` ile senkron kalır. */
export type DailyReportRevenueDetail = {
  courierId: number;
  total: number;
  cashTotal: number;
  cardTotal: number;
  packageCount: number;
};

@Injectable({
  providedIn: 'root'
})
export class DailyReportDetailService {
  private readonly orderState = inject(OrderStateService);
  private readonly detailSubject = new BehaviorSubject<DailyReportRevenueDetail | null>(null);

  /** null = kapalı; ortak reaktif state (modal / detay paneli). */
  readonly revenueDetail$ = this.detailSubject.asObservable();

  constructor() {
    this.orderState.orders$.subscribe(() => {
      const open = this.detailSubject.value;
      if (open !== null) {
        this.detailSubject.next(this.buildSnapshot(open.courierId));
      }
    });
  }

  openRevenueDetail(courierId: number): void {
    this.detailSubject.next(this.buildSnapshot(courierId));
  }

  close(): void {
    this.detailSubject.next(null);
  }

  private buildSnapshot(courierId: number): DailyReportRevenueDetail {
    const b = this.orderState.getCourierDeliveredPaymentBreakdown(courierId);
    return {
      courierId,
      total: b.total,
      cashTotal: b.cashTotal,
      cardTotal: b.cardTotal,
      packageCount: b.packageCount
    };
  }
}
