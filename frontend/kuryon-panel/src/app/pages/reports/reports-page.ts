import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { CourierStateService } from '../../core/services/courier-state.service';
import { OrderStateService, SharedOrderItem } from '../../core/services/order-state.service';
import { DirectorPermissionService } from '../../core/services/director-permission.service';
import { DevProfilerService } from '../../core/dev/dev-profiler.service';
import { ActiveDirectorContextService } from '../../core/services/active-director-context.service';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

type ReportRange = 'Günlük' | 'Haftalık' | 'Aylık';

type SummaryCard = {
  label: string;
  value: string;
  trend: string;
};

type RegionReport = {
  region: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenueLabel: string;
  completionRate: number;
};

type PaymentSummary = {
  cashTotal: number;
  cardTotal: number;
  total: number;
  cashTotalLabel: string;
  cardTotalLabel: string;
  totalLabel: string;
};

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports-page.html',
  styleUrls: ['./reports-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPageComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly profiler = inject(DevProfilerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  readonly t = UI_TEXTS;
  @ViewChild('detailsSection') private detailsSectionRef?: ElementRef<HTMLElement>;
  @ViewChild('tableSection') private tableSectionRef?: ElementRef<HTMLElement>;
  private pendingDetailsComputeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastOrdersSignature = '';
  private lastCouriersSignature = '';
  private detailsObserver: IntersectionObserver | null = null;
  private tableObserver: IntersectionObserver | null = null;
  private rangeOrdersCache = new Map<string, SharedOrderItem[]>();
  private rangeDerivedCache = new Map<string, { regionReports: RegionReport[]; recentNotes: string[] }>();
  private hasInitialCompute = false;
  canViewLogs = false;
  canExportLogs = false;
  isDetailsReady = false;
  isTableReady = false;
  isDataLoading = true;
  selectedRange: ReportRange = 'Haftalık';
  rangeOptions: ReportRange[] = ['Günlük', 'Haftalık', 'Aylık'];

  summaryCards: SummaryCard[] = [];
  regionReports: RegionReport[] = [];
  recentNotes: string[] = [];
  paymentSummary: PaymentSummary = {
    cashTotal: 0,
    cardTotal: 0,
    total: 0,
    cashTotalLabel: this.formatMoney(0),
    cardTotalLabel: this.formatMoney(0),
    totalLabel: this.formatMoney(0)
  };
  regionCurrentPage = 1;
  readonly regionPageSize = 25;
  regionTotalPages = 1;
  pagedRegionReports: RegionReport[] = [];

  constructor(
    private readonly orderState: OrderStateService,
    private readonly courierState: CourierStateService,
    private readonly directorPermissions: DirectorPermissionService,
    private readonly activeDirectorContext: ActiveDirectorContextService
  ) {}

  ngOnInit(): void {
    const pageOpenStarted = performance.now();
    this.directorPermissions.currentDirector$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.canViewLogs = this.directorPermissions.can('view_logs');
        this.canExportLogs = this.directorPermissions.can('export_log_details');
        this.cdr.markForCheck();
      });

    combineLatest([
      this.orderState.orders$,
      this.courierState.couriers$,
      this.activeDirectorContext.activeDirectorId$
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([orders, couriers, directorId]) => {
        const scopedOrders = this.activeDirectorContext.filterOrders(orders, directorId);
        const scopedCouriers = this.activeDirectorContext.filterCouriers(couriers, directorId);
        const ordersSignature = this.buildOrdersSignature(scopedOrders);
        const couriersSignature = this.buildCouriersSignature(scopedCouriers);
        if (
          this.hasInitialCompute &&
          ordersSignature === this.lastOrdersSignature &&
          couriersSignature === this.lastCouriersSignature
        ) {
          return;
        }
        this.hasInitialCompute = true;
        this.lastOrdersSignature = ordersSignature;
        this.lastCouriersSignature = couriersSignature;
        this.rangeOrdersCache.clear();
        this.rangeDerivedCache.clear();
        this.recomputeFromServices(scopedOrders, scopedCouriers);
      });

    this.destroyRef.onDestroy(() => {
      if (this.pendingDetailsComputeTimer) {
        clearTimeout(this.pendingDetailsComputeTimer);
        this.pendingDetailsComputeTimer = null;
      }
      if (this.detailsObserver) {
        this.detailsObserver.disconnect();
        this.detailsObserver = null;
      }
      if (this.tableObserver) {
        this.tableObserver.disconnect();
        this.tableObserver = null;
      }
    });

    this.profiler.record('reports-page-initial-open', performance.now() - pageOpenStarted, {
      range: this.selectedRange
    });
  }

  ngAfterViewInit(): void {
    this.setupDeferredSections();
  }

  private recomputeFromServices(allOrders: SharedOrderItem[], couriers: ReturnType<CourierStateService['getCouriersSnapshot']>): void {
    this.isDataLoading = true;
    this.cdr.markForCheck();
    const rangeCacheKey = `${this.selectedRange}|${this.lastOrdersSignature}`;
    const orders = this.getRangeOrders(allOrders, rangeCacheKey);
    const totalOrders = orders.length;
    let totalRevenue = 0;
    let delivered = 0;
    for (const order of orders) {
      totalRevenue += order.fee;
      if (order.status === 'Teslim Edildi') {
        delivered += 1;
      }
    }
    const successPct = totalOrders ? Math.round((delivered / totalOrders) * 100) : 0;
    let online = 0;
    for (const courier of couriers) {
      if (courier.status === 'Çevrimiçi') {
        online += 1;
      }
    }
    const paymentBreakdown = this.orderState.getPaymentBreakdownFromOrders(orders);
    const cashRatio = totalRevenue ? Math.round((paymentBreakdown.cashTotal / totalRevenue) * 100) : 0;
    const cardRatio = totalRevenue ? Math.round((paymentBreakdown.cardTotal / totalRevenue) * 100) : 0;

    this.paymentSummary = {
      cashTotal: paymentBreakdown.cashTotal,
      cardTotal: paymentBreakdown.cardTotal,
      total: totalRevenue,
      cashTotalLabel: this.formatMoney(paymentBreakdown.cashTotal),
      cardTotalLabel: this.formatMoney(paymentBreakdown.cardTotal),
      totalLabel: this.formatMoney(totalRevenue)
    };

    this.summaryCards = [
      {
        label: this.t.reports.totalOrders,
        value: String(totalOrders),
        trend: `${this.selectedRange} görünüm`
      },
      {
        label: this.t.reports.totalRevenue,
        value: this.formatMoney(totalRevenue),
        trend: this.t.reports.totalDeliveryFee
      },
      {
        label: this.t.reports.cashPayment,
        value: this.formatMoney(paymentBreakdown.cashTotal),
        trend: `%${cashRatio} ${this.t.reports.ratioSuffix}`
      },
      {
        label: this.t.reports.cardPayment,
        value: this.formatMoney(paymentBreakdown.cardTotal),
        trend: `%${cardRatio} ${this.t.reports.ratioSuffix}`
      }
    ];

    const derivedCacheKey = `${this.selectedRange}|${this.lastOrdersSignature}|${this.lastCouriersSignature}`;
    const cached = this.rangeDerivedCache.get(derivedCacheKey);
    if (cached) {
      this.regionReports = cached.regionReports;
      this.recentNotes = cached.recentNotes;
      this.regionCurrentPage = 1;
      this.rebuildRegionPage();
      this.profileTableRender('reports-table-render');
      this.isDataLoading = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.pendingDetailsComputeTimer) {
      clearTimeout(this.pendingDetailsComputeTimer);
    }
    this.pendingDetailsComputeTimer = setTimeout(() => {
      const regionMap = new Map<string, { total: number; completed: number; revenue: number }>();
      for (const order of orders) {
        const region = this.regionFromAddress(order.address);
        const cur = regionMap.get(region) ?? { total: 0, completed: 0, revenue: 0 };
        cur.total += 1;
        if (order.status === 'Teslim Edildi') {
          cur.completed += 1;
        }
        cur.revenue += order.fee;
        regionMap.set(region, cur);
      }

      const regionReports = Array.from(regionMap.entries())
        .map(([region, v]) => ({
          region,
          totalOrders: v.total,
          completedOrders: v.completed,
          cancelledOrders: 0,
          revenueLabel: this.formatMoney(v.revenue),
          completionRate: v.total ? Math.round((v.completed / v.total) * 100) : 0
        }))
        .sort((a, b) => b.totalOrders - a.totalOrders);

      const recentNotes = [
        `${this.selectedRange} görünümünde ${totalOrders} sipariş kaydı; ${delivered} teslim edildi.`,
        `Ödeme dağılımı: ${this.paymentSummary.cashTotalLabel} nakit, ${this.paymentSummary.cardTotalLabel} kart.`,
        `Çevrimiçi ${online} kurye; toplam kurye ${couriers.length}.`,
        'Bölge metrikleri adres satırından (ilçe) türetilir.'
      ];

      this.rangeDerivedCache.set(derivedCacheKey, { regionReports, recentNotes });
      this.regionReports = regionReports;
      this.recentNotes = recentNotes;
      this.regionCurrentPage = 1;
      this.rebuildRegionPage();
      this.profileTableRender('reports-table-render');
      this.isDataLoading = false;
      this.cdr.markForCheck();
      this.pendingDetailsComputeTimer = null;
    }, 0);
  }

  private filterOrdersByRange(orders: SharedOrderItem[]): SharedOrderItem[] {
    const now = Date.now();
    const start = this.getRangeStartMs(new Date(now));
    return orders.filter((o) => {
      const ts = o.createdAtMs;
      return typeof ts === 'number' && ts >= start && ts <= now;
    });
  }

  private getRangeStartMs(now: Date): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);

    if (this.selectedRange === 'Günlük') {
      return d.getTime();
    }

    if (this.selectedRange === 'Haftalık') {
      const mondayOffset = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - mondayOffset);
      return d.getTime();
    }

    d.setDate(1);
    return d.getTime();
  }

  private regionFromAddress(address: string): string {
    const parts = address.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts[1];
    }
    return 'Diğer';
  }

  formatMoney(n: number): string {
    return `₺${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  setRange(range: ReportRange): void {
    if (this.selectedRange === range) {
      return;
    }
    this.selectedRange = range;
    this.recomputeFromServices(this.orderState.getOrdersSnapshot(), this.courierState.getCouriersSnapshot());
    this.profiler.measureToNextFrame('reports-filter-change', { range });
  }

  nextRegionPage(): void {
    if (this.regionCurrentPage >= this.regionTotalPages) {
      return;
    }
    this.regionCurrentPage += 1;
    this.rebuildRegionPage();
    this.profileTableRender('reports-table-page-change');
  }

  prevRegionPage(): void {
    if (this.regionCurrentPage <= 1) {
      return;
    }
    this.regionCurrentPage -= 1;
    this.rebuildRegionPage();
    this.profileTableRender('reports-table-page-change');
  }

  get hasRegionPagination(): boolean {
    return this.regionReports.length > this.regionPageSize;
  }

  trackByRange(_: number, range: ReportRange): ReportRange {
    return range;
  }

  trackByCard(_: number, card: SummaryCard): string {
    return card.label;
  }

  trackByRegion(_: number, item: RegionReport): string {
    return item.region;
  }

  trackByNote(_: number, note: string): string {
    return note;
  }

  private buildOrdersSignature(orders: SharedOrderItem[]): string {
    return orders.map((o) => `${o.id}|${o.status}|${o.fee}|${o.paymentType ?? ''}|${o.createdAtMs ?? ''}`).join('||');
  }

  private buildCouriersSignature(couriers: ReturnType<CourierStateService['getCouriersSnapshot']>): string {
    return couriers.map((c) => `${c.id}|${c.status}|${c.activeOrders}|${c.breakMinutes ?? ''}`).join('||');
  }

  private getRangeOrders(allOrders: SharedOrderItem[], cacheKey: string): SharedOrderItem[] {
    const cached = this.rangeOrdersCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const next = this.filterOrdersByRange(allOrders);
    this.rangeOrdersCache.set(cacheKey, next);
    return next;
  }

  private rebuildRegionPage(): void {
    const total = this.regionReports.length;
    this.regionTotalPages = Math.max(1, Math.ceil(total / this.regionPageSize));
    this.regionCurrentPage = Math.min(this.regionCurrentPage, this.regionTotalPages);
    const start = (this.regionCurrentPage - 1) * this.regionPageSize;
    const end = start + this.regionPageSize;
    this.pagedRegionReports = this.regionReports.slice(start, end);
  }

  private setupDeferredSections(): void {
    if (typeof window === 'undefined') {
      this.isDetailsReady = true;
      this.isTableReady = true;
      return;
    }

    this.detailsObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.ngZone.run(() => {
            this.isDetailsReady = true;
            this.detailsObserver?.disconnect();
            this.detailsObserver = null;
            this.profiler.measureToNextFrame('reports-details-section-ready', { range: this.selectedRange });
            this.cdr.markForCheck();
          });
        }
      },
      { root: null, threshold: 0.01, rootMargin: '160px' }
    );
    const detailsEl = this.detailsSectionRef?.nativeElement;
    if (detailsEl) {
      this.detailsObserver.observe(detailsEl);
    } else {
      this.isDetailsReady = true;
    }

    this.tableObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.ngZone.run(() => {
            this.isTableReady = true;
            this.tableObserver?.disconnect();
            this.tableObserver = null;
            this.profileTableRender('reports-table-first-visible');
            this.cdr.markForCheck();
          });
        }
      },
      { root: null, threshold: 0.01, rootMargin: '180px' }
    );
    const tableEl = this.tableSectionRef?.nativeElement;
    if (tableEl) {
      this.tableObserver.observe(tableEl);
    } else {
      this.isTableReady = true;
    }
  }

  private profileTableRender(metric: string): void {
    this.profiler.measureToNextFrame(metric, {
      rows: this.pagedRegionReports.length,
      page: this.regionCurrentPage
    });
  }
}
