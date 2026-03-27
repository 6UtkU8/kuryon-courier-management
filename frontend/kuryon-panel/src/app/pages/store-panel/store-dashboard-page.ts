import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SESSION_STORE_ID_KANATCI } from '../../core/models/user-session.model';
import { AuthService } from '../../core/services/auth.service';
import { CourierStateService } from '../../core/services/courier-state.service';
import {
  CreateOrderInput,
  DeliveryState,
  OrderStateService,
  SharedOrderItem
} from '../../core/services/order-state.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Component({
  selector: 'app-store-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './store-dashboard-page.html',
  styleUrls: ['./store-dashboard-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoreDashboardPageComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;
  readonly tabs = ['Anasayfa', 'Siparişler', 'Müşterilerim', 'Raporlar', 'Yorumlar', 'Performans'] as const;
  activeTab: (typeof this.tabs)[number] = 'Anasayfa';
  displayedTab: (typeof this.tabs)[number] = 'Anasayfa';
  orderFilter: 'all' | DeliveryState = 'all';

  /** Oturumdaki mağaza; demo Kanatçı Bahattin. */
  storeId = SESSION_STORE_ID_KANATCI;
  orders: Array<
    SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }
  > = [];
  reportCards: { title: string; count: string; total: string }[] = [];
  visibleOrders: Array<
    SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }
  > = [];
  summaryCardsData: { title: string; value: string }[] = [];
  customersData: Array<{ name: string; orderCount: number; total: number; totalLabel: string; lastStatus: string }> = [];
  commentsData: { customer: string; text: string; tone: 'positive' | 'neutral' }[] = [];
  performanceCardsData: { title: string; value: string }[] = [];
  dailyReport = { totalOrders: 0, totalRevenue: 0, totalRevenueLabel: '₺0,00', delivered: 0 };
  weeklyReport = { totalOrders: 0, totalRevenue: 0, totalRevenueLabel: '₺0,00', delivered: 0 };
  callFeedback: { type: 'success' | 'error'; text: string } | null = null;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly auth: AuthService,
    private readonly courierState: CourierStateService,
    private readonly orderState: OrderStateService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const session = this.auth.getSession();
    if (session?.role === 'store' && session.contextStoreId) {
      this.storeId = session.contextStoreId;
    }

    this.orderState.orders$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshFromService());
    this.refreshFromService();
  }

  ngOnDestroy(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
  }

  refreshFromService(): void {
    const baseOrders = this.orderState.getOrdersForStore(this.storeId);
    this.orders = baseOrders.map((order) => {
      const statusLabel = this.storeStatusLabel(order.status);
      const courierLabel = this.courierCell(order);
      return {
        ...order,
        statusLabel,
        courierLabel,
        feeLabel: this.formatMoney(order.fee),
        paymentLabel: order.paymentType ?? '—'
      };
    });
    this.reportCards = this.buildReportCards(this.orders);
    this.recomputeDerivedState();
  }

  private buildReportCards(rows: SharedOrderItem[]): { title: string; count: string; total: string }[] {
    const byPayment = new Map<string, { count: number; sum: number }>();
    for (const o of rows) {
      const key = o.paymentType ?? 'Diğer';
      const cur = byPayment.get(key) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += o.fee;
      byPayment.set(key, cur);
    }

    return Array.from(byPayment.entries()).map(([title, v]) => ({
      title,
      count: String(v.count),
      total: this.formatMoney(v.sum)
    }));
  }

  formatMoney(fee: number): string {
    return `₺${fee.toFixed(2).replace('.', ',')}`;
  }

  /** Dükkan tablosu için kısa durum metni */
  storeStatusLabel(status: DeliveryState): string {
    switch (status) {
      case 'Bekliyor':
        return 'Hazırlanıyor';
      case 'Atandı':
      case 'Hazır Alınacak':
        return 'Kurye atanacak';
      case 'Yolda':
        return 'Kurye yolda';
      case 'Teslim Edildi':
        return 'Teslim edildi';
      default:
        return status;
    }
  }

  courierCell(order: SharedOrderItem): string {
    if (order.courierName) {
      return order.courierName;
    }
    if (order.status === 'Bekliyor' || order.status === 'Atandı' || order.status === 'Hazır Alınacak') {
      return 'Kurye bekleniyor';
    }
    return '—';
  }

  paymentNote(order: SharedOrderItem): string {
    return order.paymentType ?? '—';
  }

  selectTab(tab: (typeof this.tabs)[number]): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.displayedTab = tab;
  }

  setOrderFilter(filter: 'all' | DeliveryState): void {
    this.orderFilter = filter;
    this.visibleOrders = this.filterOrdersByStatus(this.orders, filter);
  }

  private buildSummaryCards(rows: SharedOrderItem[]): { title: string; value: string }[] {
    const active = rows.filter((o) => o.status !== 'Teslim Edildi').length;
    const delivered = rows.filter((o) => o.status === 'Teslim Edildi').length;
    const waiting = rows.filter((o) => o.status === 'Bekliyor').length;
    const revenue = rows
      .filter((o) => o.status === 'Teslim Edildi')
      .reduce((sum, o) => sum + o.fee, 0);
    return [
      { title: 'Toplam Sipariş', value: String(rows.length) },
      { title: 'Aktif Sipariş', value: String(active) },
      { title: 'Bekleyen', value: String(waiting) },
      { title: 'Teslim Edilen', value: String(delivered) },
      { title: 'Ciro', value: this.formatMoney(revenue) }
    ];
  }

  private buildCustomers(
    rows: Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }>
  ): Array<{ name: string; orderCount: number; total: number; totalLabel: string; lastStatus: string }> {
    const map = new Map<string, { orderCount: number; total: number; lastStatus: DeliveryState }>();
    for (const o of rows) {
      const cur = map.get(o.customer) ?? { orderCount: 0, total: 0, lastStatus: o.status };
      cur.orderCount += 1;
      cur.total += o.fee;
      cur.lastStatus = o.status;
      map.set(o.customer, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        orderCount: v.orderCount,
        total: v.total,
        totalLabel: this.formatMoney(v.total),
        lastStatus: this.storeStatusLabel(v.lastStatus)
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
  }

  private buildReportSummary(
    rows: Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }>,
    period: 'daily' | 'weekly'
  ): { totalOrders: number; totalRevenue: number; totalRevenueLabel: string; delivered: number } {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const rangeMs = period === 'daily' ? dayMs : 7 * dayMs;
    const inRange = rows.filter((o) => {
      const ts = o.createdAtMs ?? now;
      return now - ts <= rangeMs;
    });
    const totalRevenue = inRange.reduce((sum, o) => sum + o.fee, 0);
    return {
      totalOrders: inRange.length,
      totalRevenue,
      totalRevenueLabel: this.formatMoney(totalRevenue),
      delivered: inRange.filter((o) => o.status === 'Teslim Edildi').length
    };
  }

  private buildComments(
    rows: Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }>
  ): { customer: string; text: string; tone: 'positive' | 'neutral' }[] {
    const delivered = rows.filter((o) => o.status === 'Teslim Edildi').slice(0, 5);
    if (delivered.length === 0) {
      return [];
    }
    return delivered.map((o) => ({
      customer: o.customer,
      text: `${this.formatMoney(o.fee)} tutarlı sipariş teslim edildi (${o.paymentType ?? this.t.storePanel.paymentInfoMissing}).`,
      tone: 'positive'
    }));
  }

  private buildPerformanceCards(
    rows: Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }>
  ): { title: string; value: string }[] {
    const total = rows.length || 1;
    const delivered = rows.filter((o) => o.status === 'Teslim Edildi').length;
    const assigned = rows.filter((o) => o.courierId != null).length;
    const avgBasket = rows.reduce((sum, o) => sum + o.fee, 0) / total;
    return [
      { title: 'Teslim Oranı', value: `%${Math.round((delivered / total) * 100)}` },
      { title: 'Kurye Atama Oranı', value: `%${Math.round((assigned / total) * 100)}` },
      { title: 'Ortalama Sepet', value: this.formatMoney(avgBasket) }
    ];
  }

  callCourier(): void {
    const payload: CreateOrderInput = {
      storeId: this.storeId,
      company: 'Kanatçı Bahattin',
      customer: `Hızlı Talep ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
      address: 'Kayseri / Melikgazi',
      eta: '15 dk',
      fee: 0,
      paymentType: 'Diğer Online Ödeme'
    };
    const target = this.courierState.requestStoreOrderIntoPool(payload);

    if (!target) {
      this.showFeedback('error', this.t.storePanel.callCourierNoOrder);
      return;
    }

    // Dükkan çağrısı havuza düşer: atanabilir sipariş olarak bekler.
    // Atama admin/kuryeler tarafından mevcut "Bekliyor" akışıyla yapılır.
    this.refreshFromService();
    this.showFeedback('success', `${target.id} ${this.t.storePanel.callCourierSuccess}`);
  }

  private showFeedback(type: 'success' | 'error', text: string): void {
    this.callFeedback = { type, text };
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
    this.feedbackTimer = setTimeout(() => {
      this.callFeedback = null;
    }, 2800);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }

  private filterOrdersByStatus(
    rows: Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }>,
    filter: 'all' | DeliveryState
  ): Array<SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }> {
    if (filter === 'all') {
      return rows;
    }
    return rows.filter((o) => o.status === filter);
  }

  private recomputeDerivedState(): void {
    this.visibleOrders = this.filterOrdersByStatus(this.orders, this.orderFilter);
    this.summaryCardsData = this.buildSummaryCards(this.orders);
    this.customersData = this.buildCustomers(this.orders);
    this.commentsData = this.buildComments(this.orders);
    this.performanceCardsData = this.buildPerformanceCards(this.orders);
    this.dailyReport = this.buildReportSummary(this.orders, 'daily');
    this.weeklyReport = this.buildReportSummary(this.orders, 'weekly');
  }

  trackByTab(_: number, tab: (typeof this.tabs)[number]): (typeof this.tabs)[number] {
    return tab;
  }

  trackByOrderId(
    _: number,
    item: SharedOrderItem & { statusLabel: string; courierLabel: string; feeLabel: string; paymentLabel: string }
  ): string {
    return item.id;
  }

  trackBySummaryCard(_: number, card: { title: string }): string {
    return card.title;
  }

  trackByCustomer(_: number, customer: { name: string }): string {
    return customer.name;
  }

  trackByReportCard(_: number, card: { title: string }): string {
    return card.title;
  }

  trackByComment(_: number, comment: { customer: string; text: string }): string {
    return `${comment.customer}-${comment.text}`;
  }
}
