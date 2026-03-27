import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { CourierReportHistoryService } from '../../core/services/courier-report-history.service';
import { CourierStateService } from '../../core/services/courier-state.service';
import { OrderStateService } from '../../core/services/order-state.service';

@Component({
  selector: 'app-courier-report-day-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './courier-report-day-page.html',
  styleUrls: ['./courier-report-day-page.css', '../../shared/styles/panel-page-enter.css']
})
export class CourierReportDayPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly courierState = inject(CourierStateService);
  private readonly history = inject(CourierReportHistoryService);
  private readonly orderState = inject(OrderStateService);

  readonly detail = toSignal(
    combineLatest([this.route.paramMap, this.orderState.orders$]).pipe(
      map(([params]) => {
        const raw = params.get('dayKey') ?? '';
        const dayKey = decodeURIComponent(raw);
        const courierId = this.courierState.getCurrentCourierId();
        const d = this.history.getDayDetail(courierId, dayKey);
        return {
          ...d,
          breakdown: {
            ...d.breakdown,
            totalLabel: this.formatAmount(d.breakdown.total),
            cashLabel: this.formatAmount(d.breakdown.cashTotal),
            cardLabel: this.formatAmount(d.breakdown.cardTotal)
          },
          orders: d.orders.map((o) => {
            const deliveryNoteFull = this.resolveDeliveryNote(o);
            return {
              ...o,
              feeLabel: this.formatAmount(o.fee),
              deliveryNoteFull,
              deliveryNotePreview: this.truncateNote(deliveryNoteFull),
              hasDeliveryNote: deliveryNoteFull.length > 0
            };
          })
        };
      })
    )
  );

  formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  private resolveDeliveryNote(order: {
    deliveryNote?: string;
    customerNote?: string;
    note?: string;
  }): string {
    return (order.deliveryNote ?? order.customerNote ?? order.note ?? '').trim();
  }

  private truncateNote(note: string): string {
    return note.length > 80 ? `${note.slice(0, 80).trimEnd()}...` : note;
  }
}
