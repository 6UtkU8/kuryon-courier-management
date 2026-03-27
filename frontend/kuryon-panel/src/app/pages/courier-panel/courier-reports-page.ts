import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CourierReportHistoryService } from '../../core/services/courier-report-history.service';
import { CourierStateService } from '../../core/services/courier-state.service';
import { CourierPanelService } from '../../core/services/courier-panel.service';
import { DailyReportDetailService } from '../../core/services/daily-report-detail.service';
import {
  CourierDeliveredDaySummary,
  CourierDeliveredPaymentBreakdown,
  OrderStateService,
  SharedOrderItem
} from '../../core/services/order-state.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

/** Gün satırından açılan ödeme özeti (paymentType + reduce ile hesaplanır). */
type DayPaymentPreview = {
  dayKey: string;
  label: string;
  breakdown: CourierDeliveredPaymentBreakdown;
};

@Component({
  selector: 'app-courier-reports-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './courier-reports-page.html',
  styleUrls: ['./courier-reports-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierReportsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly orderState = inject(OrderStateService);
  private readonly courierState = inject(CourierStateService);
  private readonly reportDetail = inject(DailyReportDetailService);
  private readonly reportHistory = inject(CourierReportHistoryService);
  private readonly courierPanelService = inject(CourierPanelService);
  readonly t = UI_TEXTS;

  readonly revenueDetail = toSignal(this.reportDetail.revenueDetail$, { initialValue: null });
  readonly daySummaries = toSignal(this.reportHistory.observeDaySummariesForCurrentCourier(), {
    initialValue: [] as CourierDeliveredDaySummary[]
  });

  /** Günlere göz at → seçilen günün ödeme dağılımı modalı */
  dayPaymentPreview: DayPaymentPreview | null = null;

  deliveredCount = 0;
  totalRevenue = 0;
  totalRevenueLabel = '₺0,00';
  onlineMinutes = 0;
  averageTicket = 0;
  averageTicketLabel = '₺0,00';
  courierId = 0;

  ngOnInit(): void {
    this.courierId = this.courierState.getCurrentCourierId();
    this.loadReport();

    this.orderState.orders$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadReport();
      });
  }

  async loadReport(): Promise<void> {
    this.courierId = this.courierState.getCurrentCourierId();
    const backendReport = await this.courierPanelService.getMyReport();
    if (backendReport) {
      this.deliveredCount = backendReport.deliveredCount;
      this.totalRevenue = backendReport.totalRevenue;
      this.averageTicket = backendReport.averagePrice;
      this.totalRevenueLabel = this.formatAmount(this.totalRevenue);
      this.averageTicketLabel = this.formatAmount(this.averageTicket);
      this.onlineMinutes = 420;
      return;
    }

    const history = this.orderState.getCourierDeliveredOrders(this.courierId);
    this.deliveredCount = history.length;
    this.totalRevenue = history.reduce((sum, item) => sum + item.fee, 0);
    this.totalRevenueLabel = this.formatAmount(this.totalRevenue);
    this.onlineMinutes = 420;
    this.averageTicket = this.deliveredCount ? this.totalRevenue / this.deliveredCount : 0;
    this.averageTicketLabel = this.formatAmount(this.averageTicket);
  }

  formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  openRevenueDetail(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.reportDetail.openRevenueDetail(this.courierId);
  }

  closeRevenueDetail(): void {
    this.reportDetail.close();
  }

  /**
   * Teslim edilen siparişlerden günlük nakit/kart/toplam (paymentType alanına göre).
   * Kurallar OrderStateService.getPaymentBreakdownFromOrders ile uyumludur.
   */
  private computeBreakdownFromOrders(orders: SharedOrderItem[]): CourierDeliveredPaymentBreakdown {
    return orders.reduce(
      (acc, o) => {
        const fee = o.fee;
        const p = (o.paymentType ?? '').trim();
        const isCash = p === 'Nakit';
        const isCard = p === 'Kredi Kartı' || p.includes('Kart');
        return {
          total: acc.total + fee,
          cashTotal: acc.cashTotal + (isCash ? fee : 0),
          cardTotal: acc.cardTotal + (isCard ? fee : 0),
          packageCount: acc.packageCount + 1
        };
      },
      { total: 0, cashTotal: 0, cardTotal: 0, packageCount: 0 }
    );
  }

  openDayPaymentPreview(day: CourierDeliveredDaySummary, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const orders = this.orderState.getCourierDeliveredOrdersForDay(this.courierId, day.dayKey);
    const breakdown = this.computeBreakdownFromOrders(orders);
    this.dayPaymentPreview = {
      dayKey: day.dayKey,
      label: day.label,
      breakdown
    };
  }

  closeDayPaymentPreview(): void {
    this.dayPaymentPreview = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dayPaymentPreview) {
      this.closeDayPaymentPreview();
    } else if (this.revenueDetail()) {
      this.closeRevenueDetail();
    }
  }
}
