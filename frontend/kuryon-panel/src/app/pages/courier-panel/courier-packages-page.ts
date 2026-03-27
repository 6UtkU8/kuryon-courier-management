import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CourierStateService, HistoryPaymentType } from '../../core/services/courier-state.service';
import { OrderStateService, SharedOrderItem } from '../../core/services/order-state.service';
import {
  computeCourierDeliveryLegDurations,
  CourierDeliveryLegDurations,
  formatDurationMs
} from '../../core/utils/order-delivery-legs.util';
import { DevProfilerService } from '../../core/dev/dev-profiler.service';

@Component({
  selector: 'app-courier-packages-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './courier-packages-page.html',
  styleUrls: ['./courier-packages-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierPackagesPageComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly profiler = inject(DevProfilerService);
  @ViewChild('historySection') private historySectionRef?: ElementRef<HTMLElement>;
  private lastHistorySignature = '';
  historyRows: Array<{
    item: SharedOrderItem;
    legs: CourierDeliveryLegDurations;
    totalLabel: string;
    legTotalLabel: string;
    toFirmadayimLabel: string;
    firmadayimToYolaLabel: string;
    yolaToDeliveredLabel: string;
    hasDeliveryNote: boolean;
    deliveryNotePreview: string;
    deliveryNoteFull: string;
  }> = [];

  isHistoryActionModalOpen = false;
  selectedHistoryItem: SharedOrderItem | null = null;
  selectedHistoryLegsSnapshot: CourierDeliveryLegDurations = {
    totalMs: null,
    toFirmadayimMs: null,
    firmadayimToYolaMs: null,
    yolaToDeliveredMs: null
  };
  selectedHistoryLegLabels = {
    total: '-',
    toFirmadayim: '-',
    firmadayimToYola: '-',
    yolaToDelivered: '-'
  };
  editHistoryPrice = '';
  editHistoryPaymentType: HistoryPaymentType = 'Nakit';
  courierId = 0;

  paymentOptions: HistoryPaymentType[] = [
    'Nakit',
    'Kredi Kartı',
    'Yemeksepeti Online',
    'Trendyol Online',
    'Getir Online',
    'Migros Online',
    'Diğer Online Ödeme',
    'Ücretsiz',
    'Restorana Havale',
    'Kapıda Yemek Kartı',
    'Online Yemek Kartı'
  ];

  constructor(
    private orderState: OrderStateService,
    private courierState: CourierStateService
  ) {}

  ngOnInit(): void {
    this.courierId = this.courierState.getCurrentCourierId();
    this.loadHistory();

    this.orderState.orders$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadHistory());
  }

  ngAfterViewInit(): void {
    this.profileHistorySectionPaint('delivered-packages-section-initial-render');
  }

  loadHistory(): void {
    const deliveredOrders = this.orderState.getCourierDeliveredOrders(this.courierId);
    const nextSignature = deliveredOrders
      .map(
        (item) =>
          `${item.id}|${item.status}|${item.paymentType ?? ''}|${item.fee}|${item.deliveredAtMs ?? ''}|${
            item.courierTripStep ?? ''
          }`
          + `|${this.resolveDeliveryNote(item)}`
      )
      .join('||');

    if (this.lastHistorySignature === nextSignature) {
      return;
    }
    this.lastHistorySignature = nextSignature;

    this.historyRows = this.profiler.measure(
      'delivered-packages-data-map',
      () =>
        deliveredOrders.map((item) => {
          const legs = computeCourierDeliveryLegDurations(item);
          const fullNote = this.resolveDeliveryNote(item);
          const notePreview = this.truncateNote(fullNote);
          return {
            item,
            legs,
            totalLabel: this.formatAmount(item.fee),
            legTotalLabel: this.formatLeg(legs.totalMs),
            toFirmadayimLabel: this.formatLeg(legs.toFirmadayimMs),
            firmadayimToYolaLabel: this.formatLeg(legs.firmadayimToYolaMs),
            yolaToDeliveredLabel: this.formatLeg(legs.yolaToDeliveredMs),
            hasDeliveryNote: fullNote.length > 0,
            deliveryNotePreview: notePreview,
            deliveryNoteFull: fullNote
          };
        }),
      { courierId: this.courierId, rowCount: deliveredOrders.length }
    );
    this.profileHistorySectionPaint('delivered-packages-section-render');
  }

  openHistoryAction(item: SharedOrderItem): void {
    this.selectedHistoryItem = item;
    this.selectedHistoryLegsSnapshot = computeCourierDeliveryLegDurations(item);
    this.selectedHistoryLegLabels = {
      total: this.formatLeg(this.selectedHistoryLegsSnapshot.totalMs),
      toFirmadayim: this.formatLeg(this.selectedHistoryLegsSnapshot.toFirmadayimMs),
      firmadayimToYola: this.formatLeg(this.selectedHistoryLegsSnapshot.firmadayimToYolaMs),
      yolaToDelivered: this.formatLeg(this.selectedHistoryLegsSnapshot.yolaToDeliveredMs)
    };
    this.editHistoryPrice = String(item.fee);
    this.editHistoryPaymentType = item.paymentType || 'Nakit';
    this.isHistoryActionModalOpen = true;
    this.profiler.measureToNextFrame('modal-open-time', { modal: 'history-action' });
  }

  closeHistoryActionModal(): void {
    this.isHistoryActionModalOpen = false;
    this.selectedHistoryItem = null;
    this.selectedHistoryLegsSnapshot = {
      totalMs: null,
      toFirmadayimMs: null,
      firmadayimToYolaMs: null,
      yolaToDeliveredMs: null
    };
    this.selectedHistoryLegLabels = {
      total: '-',
      toFirmadayim: '-',
      firmadayimToYola: '-',
      yolaToDelivered: '-'
    };
  }

  submitHistoryUpdate(): void {
    if (!this.selectedHistoryItem) {
      return;
    }

    this.orderState.updateDeliveredOrderMeta(this.selectedHistoryItem.id, {
      fee: Number(this.editHistoryPrice),
      paymentType: this.editHistoryPaymentType
    });

    this.closeHistoryActionModal();
  }

  onHistoryFieldInput(fieldName: 'price' | 'payment'): void {
    this.profiler.measureToNextFrame('input-latency', { field: fieldName });
  }

  formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  formatLeg(ms: number | null): string {
    return formatDurationMs(ms);
  }

  private resolveDeliveryNote(order: SharedOrderItem): string {
    return (order.deliveryNote ?? order.customerNote ?? order.note ?? '').trim();
  }

  private truncateNote(note: string): string {
    return note.length > 90 ? `${note.slice(0, 90).trimEnd()}...` : note;
  }

  trackByHistoryRow(_: number, row: { item: SharedOrderItem }): string {
    return row.item.id;
  }

  trackByPaymentOption(_: number, option: HistoryPaymentType): HistoryPaymentType {
    return option;
  }

  private profileHistorySectionPaint(metric: string): void {
    if (!this.profiler.isEnabled()) {
      return;
    }
    const startedAt = performance.now();
    requestAnimationFrame(() => {
      const cardCount = this.historySectionRef?.nativeElement.querySelectorAll('.history-card').length ?? 0;
      this.profiler.record(metric, performance.now() - startedAt, { cardCount });
    });
  }
}