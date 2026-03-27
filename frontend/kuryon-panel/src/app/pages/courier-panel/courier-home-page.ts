import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import {
  getCourierTripStep,
  OrderStateService,
  SharedOrderItem
} from '../../core/services/order-state.service';
import { CourierStateService } from '../../core/services/courier-state.service';
import { OrderElapsedComponent } from '../../shared/order-elapsed/order-elapsed.component';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppSettings } from '../../core/models/app-settings.model';
import { UI_TEXTS } from '../../shared/ui/ui-texts';
import { CourierPanelService } from '../../core/services/courier-panel.service';

type CourierHomePackageView = SharedOrderItem & {
  storeReadyForPickup: boolean;
  displayAddress: string;
  canOpenMap: boolean;
  mapsUrl: string;
  feeLabel: string;
  paymentClass: Record<string, boolean>;
  primaryButtonLabel: string;
  customerTelHref: string | null;
  restaurantTelHref: string | null;
  hasDeliveryNote: boolean;
  deliveryNotePreview: string;
  deliveryNoteFull: string;
};

@Component({
  selector: 'app-courier-home-page',
  standalone: true,
  imports: [CommonModule, DragDropModule, OrderElapsedComponent],
  templateUrl: './courier-home-page.html',
  styleUrls: ['./courier-home-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourierHomePageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;

  packages: CourierHomePackageView[] = [];
  courierId = 0;
  private lastPackagesSignature = '';

  /** Sadece onay diyaloğu için geçici UI hedefi; sipariş durumu OrderStateService üzerinden. */
  confirmTarget: SharedOrderItem | null = null;
  deliveringOrderId: string | null = null;
  actionMessage = '';
  actionType: 'success' | 'error' | '' = '';

  /** Arama alt menüsü açık sipariş id */
  callMenuOrderId: string | null = null;
  settings: AppSettings;

  constructor(
    private orderState: OrderStateService,
    private courierState: CourierStateService,
    private appSettings: AppSettingsService,
    private courierPanelService: CourierPanelService,
    private cdr: ChangeDetectorRef
  ) {
    this.settings = this.appSettings.getSnapshot();
  }

  ngOnInit(): void {
    this.courierId = this.courierState.getCurrentCourierId();
    combineLatest([this.courierState.packageSort$, this.courierState.couriers$, this.orderState.orders$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadPackages();
        this.cdr.markForCheck();
      });
    this.appSettings.settings$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.settings = settings;
        this.loadPackages();
        this.cdr.markForCheck();
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (t.closest('.call-menu-wrap')) {
      return;
    }
    this.callMenuOrderId = null;
  }

  loadPackages(): void {
    this.courierId = this.courierState.getCurrentCourierId();
    const raw = this.orderState.getCourierActiveOrders(this.courierId);
    const next = this.applySort(raw);
    const nextSignature = this.getPackagesSignature(next);
    if (nextSignature === this.lastPackagesSignature) {
      return;
    }
    this.lastPackagesSignature = nextSignature;
    this.packages = next.map((item) => this.toPackageView(item));
  }

  trackByOrderId(_: number, item: CourierHomePackageView): string {
    return item.id;
  }

  onPackageDrop(event: CdkDragDrop<SharedOrderItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const next = [...this.packages];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    if (this.courierState.getPackageSortMode() !== 'manual') {
      this.courierState.setPackageSortMode('manual');
    }
    this.orderState.reorderCourierActivePackages(
      this.courierId,
      next.map((p) => p.id)
    );
  }

  private applySort(rows: SharedOrderItem[]): SharedOrderItem[] {
    const mode = this.courierState.getPackageSortMode();
    const copy = [...rows];

    const idNum = (o: SharedOrderItem): number => {
      const m = /^#SP-(\d+)$/.exec(o.id);
      return m ? parseInt(m[1], 10) : 0;
    };

    const etaMinutes = (o: SharedOrderItem): number => {
      const t = (o.eta ?? '').trim();
      if (t === '—' || !t) {
        return 99999;
      }
      const m = t.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 99999;
    };

    copy.sort((a, b) => {
      switch (mode) {
        case 'manual': {
          const ai = a.orderIndex;
          const bi = b.orderIndex;
          if (ai !== undefined && bi !== undefined && ai !== bi) {
            return ai - bi;
          }
          if (ai !== undefined && bi === undefined) {
            return -1;
          }
          if (ai === undefined && bi !== undefined) {
            return 1;
          }
          return idNum(a) - idNum(b);
        }
        case 'newest':
          return idNum(b) - idNum(a);
        case 'oldest':
          return idNum(a) - idNum(b);
        case 'fee_high':
          return b.fee - a.fee || idNum(b) - idNum(a);
        case 'fee_low':
          return a.fee - b.fee || idNum(a) - idNum(b);
        case 'distance_near': {
          const da = a.distanceKm ?? 1e9;
          const db = b.distanceKm ?? 1e9;
          return da - db || idNum(a) - idNum(b);
        }
        case 'distance_far': {
          const da = a.distanceKm ?? -1;
          const db = b.distanceKm ?? -1;
          return db - da || idNum(b) - idNum(a);
        }
        case 'prep_short':
          return etaMinutes(a) - etaMinutes(b) || idNum(a) - idNum(b);
        case 'prep_long':
          return etaMinutes(b) - etaMinutes(a) || idNum(b) - idNum(a);
        default:
          return idNum(b) - idNum(a);
      }
    });

    return copy;
  }

  onPrimaryAction(order: CourierHomePackageView): void {
    const step = getCourierTripStep(order);
    if (step === 0 || step === 1) {
      this.orderState.advanceCourierTrip(order.id);
      return;
    }
    this.confirmTarget = order;
  }

  async confirmDeliver(): Promise<void> {
    if (this.confirmTarget) {
      this.deliveringOrderId = this.confirmTarget.id;
      const packageId = this.parsePackageId(this.confirmTarget.id);
      if (packageId !== null) {
        const response = await this.courierPanelService.deliverPackage(packageId);
        if (!response) {
          this.actionType = 'error';
          this.actionMessage = 'Paket teslim güncellemesi başarısız oldu.';
          this.deliveringOrderId = null;
          return;
        }
      }
      this.orderState.updateCourierOrderStatus(this.confirmTarget.id, 'Teslim Edildi');
      this.actionType = 'success';
      this.actionMessage = 'Paket başarıyla teslim edildi.';
      this.loadPackages();
    }
    this.deliveringOrderId = null;
    this.confirmTarget = null;
  }

  cancelDeliverConfirm(): void {
    this.confirmTarget = null;
  }

  toggleCallMenu(orderId: string, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.callMenuOrderId = this.callMenuOrderId === orderId ? null : orderId;
  }

  releaseToPool(order: CourierHomePackageView): void {
    if (order.courierId !== this.courierId) {
      return;
    }
    if (
      !confirm(
        this.t.courierPanel.releaseToPoolConfirm
      )
    ) {
      return;
    }
    this.orderState.releaseOrderToPool(order.id, this.courierId);
  }

  private getPackagesSignature(rows: SharedOrderItem[]): string {
    return rows
      .map((row) => `${row.id}:${row.status}:${getCourierTripStep(row)}:${row.orderIndex ?? -1}:${this.resolveDeliveryNote(row)}`)
      .join('|');
  }

  private toPackageView(order: SharedOrderItem): CourierHomePackageView {
    const storeReadyForPickup = order.status === 'Hazır Alınacak';
    const step = getCourierTripStep(order);
    const canOpenMap = !this.settings.operations.courierSeesAddressAfterPickup || step > 0;
    const displayAddress =
      !this.settings.operations.courierSeesAddressAfterPickup || step > 0
        ? order.address
        : this.t.courierPanel.addressHiddenAfterPickup;
    const payment = (order.paymentType ?? '').trim();
    const fullNote = this.resolveDeliveryNote(order);
    const notePreview = fullNote.length > 90 ? `${fullNote.slice(0, 90).trimEnd()}...` : fullNote;

    return {
      ...order,
      storeReadyForPickup,
      displayAddress,
      canOpenMap,
      mapsUrl: this.buildMapsUrl(order.address),
      feeLabel: this.formatAmount(order.fee),
      paymentClass: {
        'fee-payment': true,
        'fee-payment--nakit': payment === 'Nakit',
        'fee-payment--kart': payment === 'Kredi Kartı' || payment.includes('Kart')
      },
      primaryButtonLabel: this.resolvePrimaryButtonLabel(step),
      customerTelHref: this.buildTelHref(order.customerPhone),
      restaurantTelHref: this.buildTelHref(order.restaurantPhone),
      hasDeliveryNote: fullNote.length > 0,
      deliveryNotePreview: notePreview,
      deliveryNoteFull: fullNote
    };
  }

  private resolveDeliveryNote(order: SharedOrderItem): string {
    return (order.deliveryNote ?? order.customerNote ?? order.note ?? '').trim();
  }

  private resolvePrimaryButtonLabel(step: number): string {
    if (step === 0) {
      return 'Firmadayım';
    }
    if (step === 1) {
      return 'Yola Çıktım';
    }
    return 'Teslim Edildi';
  }

  private formatAmount(value: number): string {
    return `₺${value.toFixed(2).replace('.', ',')}`;
  }

  private buildMapsUrl(address: string): string {
    const q = encodeURIComponent(address.trim());
    return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }

  private buildTelHref(raw: string | undefined): string | null {
    if (!raw?.trim()) {
      return null;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) {
      return null;
    }
    if (digits.length === 10) {
      return `tel:+90${digits}`;
    }
    if (digits.startsWith('0') && digits.length >= 11) {
      return `tel:+90${digits.slice(1)}`;
    }
    if (digits.startsWith('90') && digits.length >= 12) {
      return `tel:+${digits}`;
    }
    return `tel:+${digits}`;
  }

  private parsePackageId(orderId: string): number | null {
    const match = /^#SP-(\d+)$/.exec(orderId);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }
}
