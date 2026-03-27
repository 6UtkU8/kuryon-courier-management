import { inject, Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import type { HistoryPaymentType } from './courier-state.service';
import { AuthService } from './auth.service';
import { AdminPackage, AdminPackagesService } from './admin-packages.service';
import { PACKAGE_API_STATUS } from '../constants/package-status.constants';
import { CourierPanelService } from './courier-panel.service';
import {
  ORDERS_STORAGE_KEY,
  readJsonFromLocalStorage,
  subscribePanelSync,
  writeJsonToLocalStorage
} from '../utils/panel-sync.util';

export type ActivePackageStatus = 'Hazır Alınacak' | 'Yolda';
export type DeliveryState = 'Bekliyor' | 'Atandı' | 'Hazır Alınacak' | 'Yolda' | 'Teslim Edildi' | 'İptal Edildi';
export type AssignmentSource = 'manual' | 'auto';
export type OrderOrigin = 'admin_manual' | 'store_call';

/** Kurye ana aksiyon akışı: Firmadayım → Yola Çıktım → Teslim Edildi (onay) */
export type CourierTripStep = 0 | 1 | 2;

export type SharedOrderItem = {
  id: string;
  /** Hangi mağaza satırına ait (dükkan paneli filtresi). */
  storeId: string;
  company: string;
  customer: string;
  address: string;
  createdAt: string;
  /** Sisteme düşme zamanı (epoch ms); canlı süre sayacı için. */
  createdAtMs?: number;
  eta: string;
  fee: number;
  courierId: number | null;
  courierName: string | null;
  status: DeliveryState;
  preparedAt?: string;
  deliveredAtText?: string;
  /** Teslim anı (epoch ms); süre sayacı teslimde donar. */
  deliveredAtMs?: number;
  paymentType?: HistoryPaymentType;
  image?: string;
  /** Kurye kartı birincil buton adımları; persistence ile senkron. */
  courierTripStep?: CourierTripStep;
  /** Müşteri araması (tel:). */
  customerPhone?: string;
  /** Restoran / firma hattı (tel:). */
  restaurantPhone?: string;
  /** Tahmini mesafe (km); yoksa sıralamada dikkate alınmaz. */
  distanceKm?: number;
  /** Teslim anındaki yerel takvim günü (YYYY-MM-DD); eski kayıtlarda yoksa preparedAt üzerinden çıkarılır. */
  deliveredAtDayKey?: string;
  /** Aynı kuryedeki aktif paketler arasında görüntüleme sırası (0 = en üst). Havuza dönünce temizlenir. */
  orderIndex?: number;
  /** "Firmadayım" basıldığında (epoch ms). */
  firmadayimAtMs?: number;
  /** "Yola Çıktım" basıldığında (epoch ms). */
  yolaCiktimAtMs?: number;
  /** Son atama kaynağı (manuel / otomatik). */
  assignmentSource?: AssignmentSource;
  /** Otomatik atama gerçekleştiyse zaman damgası. */
  autoAssignedAtMs?: number;
  /** Siparişin sistemde oluşum kaynağı. */
  origin?: OrderOrigin;
  /** Dükkan "Kurye Çağır" tekrarlandığında en son çağrı zamanı. */
  storeCallRequestedAtMs?: number;
  /** Kuryeye gösterilecek teslimat notu (zile basmayın vb.). */
  deliveryNote?: string;
  /** Eski/veri kaynağı alternatif alan adı: müşteri notu. */
  customerNote?: string;
  /** Eski/veri kaynağı alternatif alan adı: genel not. */
  note?: string;
};

/** Teslim edilmiş siparişler üzerinden nakit / kart dağılımı (kurye raporu). */
export type CourierDeliveredPaymentBreakdown = {
  total: number;
  cashTotal: number;
  cardTotal: number;
  packageCount: number;
};

/** Günlük gruplanmış özet (mevcut siparişlerden türetilir). */
export type CourierDeliveredDaySummary = {
  dayKey: string;
  label: string;
  total: number;
  packageCount: number;
};

const UNKNOWN_DAY_KEY = '__unknown__';

const TR_MONTH_NAME_TO_INDEX: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  eylül: 9,
  ekim: 10,
  kasım: 11,
  aralık: 12
};

function formatLocalDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parsePreparedAtDayKey(preparedAt: string | undefined): string | null {
  if (!preparedAt?.trim()) {
    return null;
  }
  const m = /^(\d{1,2})\s+(\S+?)\s+(\d{4})/.exec(preparedAt.trim());
  if (!m) {
    return null;
  }
  const dayNum = parseInt(m[1], 10);
  const monthToken = m[2].toLocaleLowerCase('tr-TR');
  const year = parseInt(m[3], 10);
  const monthNum = TR_MONTH_NAME_TO_INDEX[monthToken];
  if (!monthNum || !Number.isFinite(dayNum) || !Number.isFinite(year)) {
    return null;
  }
  const d = new Date(year, monthNum - 1, dayNum);
  if (d.getFullYear() !== year || d.getMonth() !== monthNum - 1 || d.getDate() !== dayNum) {
    return null;
  }
  return formatLocalDayKey(d);
}

function getDayKeyForDeliveredOrder(order: SharedOrderItem): string {
  if (order.deliveredAtDayKey && /^\d{4}-\d{2}-\d{2}$/.test(order.deliveredAtDayKey)) {
    return order.deliveredAtDayKey;
  }
  return parsePreparedAtDayKey(order.preparedAt) ?? UNKNOWN_DAY_KEY;
}

function formatDayLabel(dayKey: string): string {
  if (dayKey === UNKNOWN_DAY_KEY) {
    return 'Tarih bilinmiyor';
  }
  const [y, m, d] = dayKey.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    return dayKey;
  }
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function classifyCourierPaymentForBreakdown(
  paymentType: HistoryPaymentType | undefined
): 'cash' | 'card' | 'other' {
  const p = (paymentType ?? '').trim();
  if (p === 'Nakit') return 'cash';
  if (p === 'Kredi Kartı' || p.includes('Kart')) return 'card';
  return 'other';
}

/** Admin’den eklenen havuz siparişi (storeId genelde sabit mağaza anahtarı). */
export type CreateOrderInput = {
  storeId: string;
  company: string;
  customer: string;
  address: string;
  eta: string;
  fee: number;
  paymentType?: HistoryPaymentType;
  /** Tek harf avatar; boşsa firma adının ilk harfi */
  image?: string;
  preparedAt?: string;
  customerPhone?: string;
  restaurantPhone?: string;
  origin?: OrderOrigin;
  deliveryNote?: string;
};

const DEFAULT_ORDERS: SharedOrderItem[] = [
  {
    id: '#SP-1001',
    storeId: 'burger-house',
    company: 'Burger House',
    customer: 'Ahmet Yılmaz',
    address: 'Kayseri / Melikgazi',
    createdAt: '10:20',
    createdAtMs: new Date('2026-03-24T10:20:00+03:00').getTime(),
    eta: '18 dk',
    fee: 85,
    courierId: 1,
    courierName: 'Mehmet Kaya',
    status: 'Yolda',
    preparedAt: '24 Mart 2026 22:57',
    paymentType: 'Nakit',
    image: 'B',
    customerPhone: '0555 111 22 33',
    restaurantPhone: '0352 444 55 66',
    distanceKm: 2.4,
    orderIndex: 0
  },
  {
    id: '#SP-1002',
    storeId: 'kahve-duragi',
    company: 'Kahve Durağı',
    customer: 'Ayşe Demir',
    address: 'Kayseri / Talas',
    createdAt: '10:24',
    createdAtMs: new Date('2026-03-24T10:24:00+03:00').getTime(),
    eta: '15 dk',
    fee: 60,
    courierId: 1,
    courierName: 'Mehmet Kaya',
    status: 'Hazır Alınacak',
    preparedAt: '24 Mart 2026 22:53',
    paymentType: 'Yemeksepeti Online',
    image: 'K',
    customerPhone: '0532 987 65 43',
    restaurantPhone: '0352 222 11 00',
    distanceKm: 5.1,
    orderIndex: 1
  },
  {
    id: '#SP-1003',
    storeId: 'pizza-stop',
    company: 'Pizza Stop',
    customer: 'Mert Can',
    address: 'Kayseri / Kocasinan',
    createdAt: '10:28',
    createdAtMs: new Date('2026-03-24T10:28:00+03:00').getTime(),
    eta: '12 dk',
    fee: 95,
    courierId: null,
    courierName: null,
    status: 'Bekliyor',
    preparedAt: '24 Mart 2026 22:48',
    paymentType: 'Getir Online',
    image: 'P'
  },
  {
    id: '#SP-1004',
    storeId: 'doner-express',
    company: 'Döner Express',
    customer: 'Zeynep Kara',
    address: 'Kayseri / Talas',
    createdAt: '10:31',
    createdAtMs: new Date('2026-03-24T10:31:00+03:00').getTime(),
    eta: '20 dk',
    fee: 75,
    courierId: null,
    courierName: null,
    status: 'Bekliyor',
    preparedAt: '24 Mart 2026 22:40',
    paymentType: 'Kredi Kartı',
    image: 'D'
  },
  {
    id: '#SP-0988',
    storeId: 'komagene-merkez',
    company: 'Komagene Merkez',
    customer: 'Emre T.',
    address: 'Kayseri / Talas / Mevlana Mahallesi / No: 14',
    createdAt: '09:10',
    createdAtMs: new Date('2026-03-24T09:10:00+03:00').getTime(),
    eta: '11 dk',
    fee: 210,
    courierId: 1,
    courierName: 'Mehmet Kaya',
    status: 'Teslim Edildi',
    preparedAt: '24 Mart 2026 22:48',
    deliveredAtMs: new Date('2026-03-24T09:46:00+03:00').getTime(),
    deliveredAtText: '11 dk’da teslim edildi',
    paymentType: 'Nakit',
    image: 'K'
  },
  {
    id: '#SP-2001',
    storeId: 'kanatci-bahattin',
    company: 'Kanatçı Bahattin',
    customer: 'Mustafa Değim',
    address: 'Kayseri / Melikgazi',
    createdAt: '11:05',
    createdAtMs: new Date('2026-03-26T11:05:00+03:00').getTime(),
    eta: '14 dk',
    fee: 288,
    courierId: null,
    courierName: null,
    status: 'Bekliyor',
    preparedAt: '26 Mart 2026 11:02',
    paymentType: 'Yemeksepeti Online',
    image: 'K'
  },
  {
    id: '#SP-2002',
    storeId: 'kanatci-bahattin',
    company: 'Kanatçı Bahattin',
    customer: 'İlker A.',
    address: 'Kayseri / Talas',
    createdAt: '11:12',
    createdAtMs: new Date('2026-03-26T11:12:00+03:00').getTime(),
    eta: '9 dk',
    fee: 335,
    courierId: 4,
    courierName: 'Fatma Demir',
    status: 'Yolda',
    preparedAt: '26 Mart 2026 11:10',
    paymentType: 'Trendyol Online',
    image: 'K'
  },
  {
    id: '#SP-2003',
    storeId: 'kanatci-bahattin',
    company: 'Kanatçı Bahattin',
    customer: 'Ayşe Demir',
    address: 'Kayseri / Kocasinan',
    createdAt: '10:40',
    createdAtMs: new Date('2026-03-26T10:40:00+03:00').getTime(),
    eta: '—',
    fee: 192,
    courierId: 4,
    courierName: 'Fatma Demir',
    status: 'Teslim Edildi',
    preparedAt: '26 Mart 2026 10:35',
    deliveredAtMs: new Date('2026-03-26T10:52:00+03:00').getTime(),
    deliveredAtText: 'Teslim edildi',
    paymentType: 'Kredi Kartı',
    image: 'K'
  }
];

export function getCourierTripStep(order: SharedOrderItem): CourierTripStep {
  const s = order.courierTripStep;
  if (s === 0 || s === 1 || s === 2) {
    return s;
  }
  if (order.status === 'Hazır Alınacak' || order.status === 'Atandı') {
    return 0;
  }
  if (order.status === 'Yolda') {
    return 1;
  }
  return 0;
}

function getInitialOrders(): SharedOrderItem[] {
  const stored = readJsonFromLocalStorage<SharedOrderItem[]>(ORDERS_STORAGE_KEY);
  if (stored && stored.length) {
    return stored;
  }
  return [];
}

@Injectable({
  providedIn: 'root'
})
export class OrderStateService {
  private readonly ngZone = inject(NgZone);
  private backendSyncTimer: ReturnType<typeof setInterval> | null = null;

  private readonly ordersSubject = new BehaviorSubject<SharedOrderItem[]>(getInitialOrders());

  constructor(
    private readonly authService: AuthService,
    private readonly adminPackagesService: AdminPackagesService,
    private readonly courierPanelService: CourierPanelService
  ) {
    this.attachCrossTabStorageListener();
    this.attachBroadcastSyncListener();
    this.startBackendSync();
  }

  private attachCrossTabStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', this.onOrdersStorage);
  }

  private readonly onOrdersStorage = (ev: StorageEvent): void => {
    if (ev.key !== ORDERS_STORAGE_KEY || ev.newValue == null) return;
    try {
      const parsed = JSON.parse(ev.newValue) as SharedOrderItem[];
      // storage olayı zone dışında; bileşenlerin güncellenmesi için
      this.ngZone.run(() => {
        this.ordersSubject.next(parsed);
      });
    } catch {
      // ignore
    }
  };

  private attachBroadcastSyncListener(): void {
    subscribePanelSync(ORDERS_STORAGE_KEY, (valueJson) => {
      try {
        const parsed = JSON.parse(valueJson) as SharedOrderItem[];
        this.ngZone.run(() => {
          this.ordersSubject.next(parsed);
        });
      } catch {
        // ignore
      }
    });
  }

  private nextOrders(next: SharedOrderItem[], persist: boolean): void {
    this.ordersSubject.next(next);
    if (persist) {
      writeJsonToLocalStorage(ORDERS_STORAGE_KEY, next);
    }
  }

  private startBackendSync(): void {
    void this.syncFromBackend();
    if (typeof window === 'undefined') {
      return;
    }

    this.backendSyncTimer = setInterval(() => {
      void this.syncFromBackend();
    }, 15000);
  }

  private async syncFromBackend(): Promise<void> {
    const role = this.authService.getRole();
    if (!role) {
      return;
    }

    let packages: AdminPackage[] = [];

    if (role === 'admin') {
      packages = await this.adminPackagesService.getPackages();
    } else if (role === 'courier') {
      const activePackages = await this.courierPanelService.getMyPackages();
      const historyPackages = await this.courierPanelService.getMyHistory();
      packages = [...activePackages, ...historyPackages];
    } else {
      return;
    }

    const mapped = packages.map((item) => this.mapAdminPackageToSharedOrder(item));
    this.nextOrders(mapped, true);
  }

  async reloadFromBackend(): Promise<void> {
    await this.syncFromBackend();
  }

  async createPackageFromBackend(payload: {
    trackingNumber?: string;
    customerName: string;
    customerPhone: string;
    address: string;
    description: string;
    paymentType: string;
    price: number;
  }): Promise<SharedOrderItem> {
    const created = await this.adminPackagesService.createPackage(payload);
    await this.syncFromBackend();
    return this.mapAdminPackageToSharedOrder(created);
  }

  async assignOrderToCourierBackend(orderId: string, courierId: number): Promise<boolean> {
    const packageId = this.parsePackageId(orderId);
    if (packageId === null) {
      return false;
    }
    const assigned = await this.adminPackagesService.assignPackage(packageId, courierId);
    await this.syncFromBackend();
    return !!assigned;
  }

  async updateOrderStatusBackend(orderId: string, status: keyof typeof PACKAGE_API_STATUS): Promise<boolean> {
    const packageId = this.parsePackageId(orderId);
    if (packageId === null) {
      return false;
    }
    await this.adminPackagesService.updatePackageStatus(packageId, PACKAGE_API_STATUS[status]);
    await this.syncFromBackend();
    return true;
  }

  private parsePackageId(orderId: string): number | null {
    const match = /^#SP-(\d+)$/.exec(orderId);
    if (!match) {
      return null;
    }
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  }

  private mapAdminPackageToSharedOrder(item: AdminPackage): SharedOrderItem {
    const createdAt = new Date(item.createdAt);
    const createdAtText = Number.isNaN(createdAt.getTime())
      ? '--:--'
      : `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`;

    const deliveryState = this.mapPackageStatus(item.status);
    const deliveredAt = item.deliveredAt ? new Date(item.deliveredAt) : null;

    return {
      id: `#SP-${item.id}`,
      storeId: 'backend',
      company: 'Backend Package',
      customer: item.customerName,
      address: item.address,
      createdAt: createdAtText,
      createdAtMs: Number.isNaN(createdAt.getTime()) ? Date.now() : createdAt.getTime(),
      eta: '15 dk',
      fee: item.price,
      courierId: item.assignedCourierId,
      courierName: item.assignedCourierName,
      status: deliveryState,
      paymentType: this.mapPaymentType(item.paymentType),
      customerPhone: item.customerPhone,
      deliveredAtMs: deliveredAt && !Number.isNaN(deliveredAt.getTime()) ? deliveredAt.getTime() : undefined,
      deliveredAtText: deliveredAt ? 'Teslim edildi' : undefined
    };
  }

  private mapPackageStatus(status: string): DeliveryState {
    const normalized = (status ?? '').trim().toLowerCase();
    if (normalized === PACKAGE_API_STATUS.delivered) {
      return 'Teslim Edildi';
    }
    if (normalized === PACKAGE_API_STATUS.outForDelivery) {
      return 'Yolda';
    }
    if (normalized === PACKAGE_API_STATUS.pickedUp || normalized === PACKAGE_API_STATUS.assigned) {
      return 'Hazır Alınacak';
    }
    if (normalized === PACKAGE_API_STATUS.cancelled || normalized === PACKAGE_API_STATUS.failed) {
      return 'İptal Edildi';
    }
    return 'Bekliyor';
  }

  private mapPaymentType(raw: string): HistoryPaymentType {
    const normalized = (raw ?? '').trim().toLowerCase();
    if (normalized === 'cash') return 'Nakit';
    if (normalized === 'card') return 'Kredi Kartı';
    if (normalized === 'online') return 'Yemeksepeti Online';
    return 'Diğer Online Ödeme';
  }

  orders$ = this.ordersSubject.asObservable();
  pendingOrders$ = this.orders$.pipe(
    map((orders) => orders.filter((o) => o.courierId === null && o.status === 'Bekliyor'))
  );
  poolOrders$ = this.pendingOrders$;

  getOrdersSnapshot(): SharedOrderItem[] {
    return this.ordersSubject.value;
  }

  /** Havuz + atanacaklar: kurye atanmamış bekleyen siparişler */
  getPendingOrders(): SharedOrderItem[] {
    return this.ordersSubject.value.filter(
      (o) => o.courierId === null && o.status === 'Bekliyor'
    );
  }

  getPoolOrders(): SharedOrderItem[] {
    return this.getPendingOrders();
  }

  getActiveOrders(): SharedOrderItem[] {
    return this.ordersSubject.value.filter(
      (o) => o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda'
    );
  }

  getCourierActiveOrders(courierId: number): SharedOrderItem[] {
    return this.ordersSubject.value.filter(
      (o) =>
        o.courierId === courierId &&
        (o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda')
    );
  }

  getCourierDeliveredOrders(courierId: number): SharedOrderItem[] {
    return this.ordersSubject.value
      .filter((o) => o.courierId === courierId && o.status === 'Teslim Edildi')
      .slice()
      .reverse();
  }

  getPaymentBreakdownFromOrders(orders: SharedOrderItem[]): CourierDeliveredPaymentBreakdown {
    let cashTotal = 0;
    let cardTotal = 0;
    for (const o of orders) {
      const bucket = classifyCourierPaymentForBreakdown(o.paymentType);
      if (bucket === 'cash') cashTotal += o.fee;
      else if (bucket === 'card') cardTotal += o.fee;
    }
    const total = orders.reduce((sum, o) => sum + o.fee, 0);
    return {
      total,
      cashTotal,
      cardTotal,
      packageCount: orders.length
    };
  }

  getCourierDeliveredPaymentBreakdown(courierId: number): CourierDeliveredPaymentBreakdown {
    return this.getPaymentBreakdownFromOrders(this.getCourierDeliveredOrders(courierId));
  }

  getCourierDeliveredOrdersForDay(courierId: number, dayKey: string): SharedOrderItem[] {
    return this.getCourierDeliveredOrders(courierId).filter((o) => getDayKeyForDeliveredOrder(o) === dayKey);
  }

  getCourierDeliveredDaySummaries(courierId: number): CourierDeliveredDaySummary[] {
    const orders = this.getCourierDeliveredOrders(courierId);
    const map = new Map<string, { total: number; count: number }>();
    for (const o of orders) {
      const key = getDayKeyForDeliveredOrder(o);
      const cur = map.get(key) ?? { total: 0, count: 0 };
      cur.total += o.fee;
      cur.count += 1;
      map.set(key, cur);
    }
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === UNKNOWN_DAY_KEY) return 1;
      if (b[0] === UNKNOWN_DAY_KEY) return -1;
      return b[0].localeCompare(a[0]);
    });
    return entries.map(([dayKey, v]) => ({
      dayKey,
      label: formatDayLabel(dayKey),
      total: v.total,
      packageCount: v.count
    }));
  }

  /** Rota parametresi veya gün anahtarı için Türkçe etiket. */
  getCourierDayLabel(dayKey: string): string {
    return formatDayLabel(dayKey);
  }

  getOrdersForStore(storeId: string): SharedOrderItem[] {
    return this.ordersSubject.value.filter((o) => o.storeId === storeId);
  }

  assignOrder(
    orderId: string,
    courierId: number,
    courierName: string,
    source: AssignmentSource = 'manual'
  ): void {
    const snapshot = this.ordersSubject.value;
    const order = snapshot.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    const canAssign = order.status === 'Bekliyor' || order.status === 'Atandı';
    if (!canAssign) {
      return;
    }

    const maxIdx = snapshot
      .filter(
        (o) =>
          o.courierId === courierId &&
          (o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda')
      )
      .reduce((m, o) => Math.max(m, o.orderIndex ?? -1), -1);
    const nextOrderIndex = maxIdx + 1;
    const now = Date.now();

    const updated = snapshot.map((order) =>
      order.id === orderId
        ? {
            ...order,
            courierId,
            courierName,
            status: 'Hazır Alınacak' as DeliveryState,
            orderIndex: nextOrderIndex,
            assignmentSource: source,
            autoAssignedAtMs: source === 'auto' ? now : undefined
          }
        : order
    );

    this.nextOrders(updated, true);
  }

  /**
   * Havuzdan veya admin listesinden kurye üzerine alır; yalnızca atanmamış bekleyen siparişte çalışır.
   */
  claimOrderByCourier(orderId: string, courierId: number, courierName: string): void {
    const order = this.ordersSubject.value.find((o) => o.id === orderId);
    if (!order || order.courierId !== null || order.status !== 'Bekliyor') {
      return;
    }
    this.assignOrder(orderId, courierId, courierName);
  }

  /**
   * Aktif siparişi tekrar havuza bırakır (yalnızca ilgili kurye ve teslim edilmemiş kayıtlar).
   */
  releaseOrderToPool(orderId: string, courierId: number): void {
    const updated = this.ordersSubject.value.map((order) => {
      if (order.id !== orderId || order.courierId !== courierId) {
        return order;
      }
      if (order.status === 'Teslim Edildi' || order.status === 'Bekliyor') {
        return order;
      }
      return {
        ...order,
        courierId: null,
        courierName: null,
        status: 'Bekliyor' as DeliveryState,
        courierTripStep: undefined,
        orderIndex: undefined,
        firmadayimAtMs: undefined,
        yolaCiktimAtMs: undefined,
        assignmentSource: undefined,
        autoAssignedAtMs: undefined
      };
    });
    this.nextOrders(updated, true);
  }

  /**
   * Kurye ana ekranında sürükle-bırak sonrası aktif sipariş sırasını kalıcı günceller.
   */
  reorderCourierActivePackages(courierId: number, orderedIds: string[]): void {
    const snapshot = this.ordersSubject.value;
    const isActive = (o: SharedOrderItem) =>
      o.courierId === courierId &&
      (o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda');
    const activeIds = snapshot.filter(isActive).map((o) => o.id);
    if (activeIds.length !== orderedIds.length) {
      return;
    }
    const sortedA = [...activeIds].sort();
    const sortedB = [...orderedIds].sort();
    if (sortedA.join('\0') !== sortedB.join('\0')) {
      return;
    }
    const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
    let changed = false;
    const updated = snapshot.map((order) => {
      if (!isActive(order)) {
        return order;
      }
      const idx = indexMap.get(order.id);
      if (idx === undefined || order.orderIndex === idx) {
        return order;
      }
      changed = true;
      return { ...order, orderIndex: idx };
    });
    if (changed) {
      this.nextOrders(updated, true);
    }
  }

  /**
   * Manuel sıralamaya geçerken eksik index’leri mevcut görünüme göre 0..n-1 olarak doldurur.
   */
  ensureCourierActiveOrderIndices(courierId: number): void {
    const snapshot = this.ordersSubject.value;
    const isActive = (o: SharedOrderItem) =>
      o.courierId === courierId &&
      (o.status === 'Atandı' || o.status === 'Hazır Alınacak' || o.status === 'Yolda');
    const mine = snapshot.filter(isActive);
    if (mine.length === 0) {
      return;
    }

    const idNum = (o: SharedOrderItem): number => {
      const m = /^#SP-(\d+)$/.exec(o.id);
      return m ? parseInt(m[1], 10) : 0;
    };

    const sorted = [...mine].sort((a, b) => {
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
      return idNum(b) - idNum(a);
    });

    const indexById = new Map(sorted.map((o, i) => [o.id, i]));
    let changed = false;
    const updated = snapshot.map((o) => {
      if (!isActive(o)) {
        return o;
      }
      const ni = indexById.get(o.id);
      if (ni === undefined) {
        return o;
      }
      if (o.orderIndex !== ni) {
        changed = true;
        return { ...o, orderIndex: ni };
      }
      return o;
    });
    if (changed) {
      this.nextOrders(updated, true);
    }
  }

  createOrder(input: CreateOrderInput): SharedOrderItem {
    const id = this.nextGeneratedOrderId();
    const now = new Date();
    const createdAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const company = input.company.trim();
    const imageChar = (input.image ?? (company.charAt(0) || '?')).toUpperCase();
    const feeNum = Number(input.fee);
    const newOrder: SharedOrderItem = {
      id,
      storeId: input.storeId.trim() || 'genel',
      company,
      customer: input.customer.trim(),
      address: input.address.trim(),
      createdAt,
      createdAtMs: now.getTime(),
      eta: input.eta.trim() || '—',
      fee: Number.isFinite(feeNum) && feeNum >= 0 ? feeNum : 0,
      courierId: null,
      courierName: null,
      status: 'Bekliyor',
      preparedAt:
        input.preparedAt ??
        `${now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })} ${createdAt}`,
      paymentType: input.paymentType,
      image: imageChar,
      customerPhone: input.customerPhone?.trim() || undefined,
      restaurantPhone: input.restaurantPhone?.trim() || undefined,
      deliveryNote: input.deliveryNote?.trim() || undefined,
      origin: input.origin ?? 'admin_manual'
    };
    this.nextOrders([...this.ordersSubject.value, newOrder], true);
    return newOrder;
  }

  requestStoreCourierCall(input: CreateOrderInput): SharedOrderItem {
    const storeId = input.storeId.trim() || 'genel';
    const now = Date.now();
    const existing = this.ordersSubject.value.find(
      (order) =>
        order.storeId === storeId &&
        order.origin === 'store_call' &&
        order.courierId === null &&
        order.status === 'Bekliyor'
    );

    if (existing) {
      const updated = this.ordersSubject.value.map((order) =>
        order.id === existing.id
          ? {
              ...order,
              storeCallRequestedAtMs: now
            }
          : order
      );
      this.nextOrders(updated, true);
      return updated.find((order) => order.id === existing.id) ?? existing;
    }

    return this.createOrder({
      ...input,
      storeId,
      origin: 'store_call'
    });
  }

  /**
   * Siparişi kurye havuzu kuralına normalize eder:
   * atanmamış + Bekliyor (teslim edilmiş siparişlerde değişiklik yapmaz).
   */
  ensureOrderInPool(orderId: string): void {
    let changed = false;
    const updated = this.ordersSubject.value.map((order) => {
      if (order.id !== orderId || order.status === 'Teslim Edildi' || order.status === 'İptal Edildi') {
        return order;
      }

      const needsNormalize =
        order.courierId !== null ||
        order.courierName !== null ||
        order.status !== 'Bekliyor' ||
        order.courierTripStep !== undefined ||
        order.orderIndex !== undefined ||
        order.firmadayimAtMs !== undefined ||
        order.yolaCiktimAtMs !== undefined;

      if (!needsNormalize) {
        return order;
      }

      changed = true;
      return {
        ...order,
        courierId: null,
        courierName: null,
        status: 'Bekliyor' as DeliveryState,
        courierTripStep: undefined,
        orderIndex: undefined,
        firmadayimAtMs: undefined,
        yolaCiktimAtMs: undefined,
        assignmentSource: undefined,
        autoAssignedAtMs: undefined
      };
    });

    if (changed) {
      this.nextOrders(updated, true);
    }
  }

  private nextGeneratedOrderId(): string {
    let max = 0;
    for (const o of this.ordersSubject.value) {
      const m = /^#SP-(\d+)$/.exec(o.id);
      if (m) {
        max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return `#SP-${max + 1}`;
  }

  /** Firmadayım(0) → Yola Çıktım(1) + Yolda; Yola Çıktım(1) → Teslim onayı(2) */
  advanceCourierTrip(orderId: string): void {
    const now = Date.now();
    const updated = this.ordersSubject.value.map((order) => {
      if (order.id !== orderId) {
        return order;
      }
      const step = getCourierTripStep(order);
      if (step === 0) {
        return {
          ...order,
          courierTripStep: 1 as CourierTripStep,
          status: 'Yolda' as DeliveryState,
          firmadayimAtMs: order.firmadayimAtMs ?? now
        };
      }
      if (step === 1) {
        return {
          ...order,
          courierTripStep: 2 as CourierTripStep,
          yolaCiktimAtMs: order.yolaCiktimAtMs ?? now
        };
      }
      return order;
    });
    this.nextOrders(updated, true);
  }

  updateCourierOrderStatus(orderId: string, status: ActivePackageStatus | 'Teslim Edildi'): void {
    const updated = this.ordersSubject.value.map((order) => {
      if (order.id !== orderId) {
        return order;
      }

      if (status === 'Teslim Edildi') {
        const now = Date.now();
        return {
          ...order,
          status: 'Teslim Edildi' as DeliveryState,
          deliveredAtText: 'Az önce teslim edildi',
          deliveredAtDayKey: formatLocalDayKey(new Date()),
          deliveredAtMs: now,
          courierTripStep: undefined
        };
      }

      return {
        ...order,
        status
      };
    });

    this.nextOrders(updated, true);
  }

  updateDeliveredOrderMeta(
    orderId: string,
    payload: {
      fee: number;
      paymentType: HistoryPaymentType;
    }
  ): void {
    const updated = this.ordersSubject.value.map((order) =>
      order.id === orderId
        ? {
            ...order,
            fee: payload.fee,
            paymentType: payload.paymentType
          }
        : order
    );

    this.nextOrders(updated, true);
  }

  removeReadyForPickupOrder(orderId: string): boolean {
    const current = this.ordersSubject.value;
    const target = current.find((order) => order.id === orderId);
    if (!target || target.status !== 'Hazır Alınacak') {
      return false;
    }
    const next = current.filter((order) => order.id !== orderId);
    this.nextOrders(next, true);
    return true;
  }

  cancelOrder(orderId: string): boolean {
    let changed = false;
    const updated = this.ordersSubject.value.map((order) => {
      if (order.id !== orderId) {
        return order;
      }
      if (order.status === 'Teslim Edildi' || order.status === 'İptal Edildi') {
        return order;
      }
      changed = true;
      return {
        ...order,
        status: 'İptal Edildi' as DeliveryState,
        courierId: null,
        courierName: null,
        courierTripStep: undefined,
        orderIndex: undefined,
        firmadayimAtMs: undefined,
        yolaCiktimAtMs: undefined,
        assignmentSource: undefined,
        autoAssignedAtMs: undefined
      };
    });
    if (!changed) {
      return false;
    }
    this.nextOrders(updated, true);
    return true;
  }
}
