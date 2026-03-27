import { inject, Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { normalizeTurkishPhoneDigits } from '../utils/phone-normalize';
import {
  COURIERS_STORAGE_KEY,
  COURIER_PACKAGE_SORT_KEY,
  readJsonFromLocalStorage,
  subscribePanelSync,
  writeJsonToLocalStorage
} from '../utils/panel-sync.util';
import { AuthService } from './auth.service';
import {
  AdminCourier,
  AdminCouriersService,
  ApiRequestError,
  CourierApiStatus
} from './admin-couriers.service';
import { CourierPanelService } from './courier-panel.service';
import {
  CreateOrderInput,
  OrderStateService,
  SharedOrderItem
} from './order-state.service';
import { AppSettingsService } from './app-settings.service';

const AUTO_ASSIGN_RETRY_DELAY_MS = 15_000;
const AUTO_ASSIGN_MIN_WAIT_MS = 250;

export type CourierStatus = 'Çevrimiçi' | 'Çevrimdışı' | 'Mola';
export type BreakReason = 'Benzin' | 'Yemek' | 'Tamir' | null;

export type HistoryPaymentType =
  | 'Nakit'
  | 'Kredi Kartı'
  | 'Yemeksepeti Online'
  | 'Trendyol Online'
  | 'Getir Online'
  | 'Migros Online'
  | 'Diğer Online Ödeme'
  | 'Ücretsiz'
  | 'Restorana Havale'
  | 'Kapıda Yemek Kartı'
  | 'Online Yemek Kartı';

/** Kurye "Üzerime Düşen Paketler" sıralama tercihi (persist). */
export type CourierPackageSortMode =
  | 'newest'
  | 'oldest'
  | 'fee_high'
  | 'fee_low'
  | 'distance_near'
  | 'distance_far'
  | 'prep_short'
  | 'prep_long'
  | 'manual';

const VALID_SORT_MODES: CourierPackageSortMode[] = [
  'newest',
  'oldest',
  'fee_high',
  'fee_low',
  'distance_near',
  'distance_far',
  'prep_short',
  'prep_long',
  'manual'
];

const STATUS_UPDATE_MOCK_DELAY_MS = 120;

function isValidSortMode(v: string): v is CourierPackageSortMode {
  return VALID_SORT_MODES.includes(v as CourierPackageSortMode);
}

export type CourierItem = {
  id: number;
  name: string;
  phone: string;
  password: string;
  iban: string;
  region: string;
  vehicle: string;
  shiftStart: string;
  shiftEnd: string;
  lateReason: string;
  isDayOff: boolean;
  dayOffDays: number;
  rating: number;
  completedOrders: number;
  activeOrders: number;
  status: CourierStatus;
  breakReason: BreakReason;
  breakMinutes: number | null;
};

const DEFAULT_COURIERS: CourierItem[] = [
  {
    id: 1,
    name: 'Mehmet Kaya',
    phone: '0555 111 22 33',
    password: '123456',
    iban: 'TR120006200011000000000001',
    region: 'Melikgazi',
    vehicle: 'Motosiklet',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    lateReason: '-',
    isDayOff: false,
    dayOffDays: 0,
    rating: 4.9,
    completedOrders: 248,
    activeOrders: 2,
    status: 'Çevrimiçi',
    breakReason: null,
    breakMinutes: null
  },
  {
    id: 2,
    name: 'Zeynep Taş',
    phone: '0555 222 33 44',
    password: '123456',
    iban: 'TR120006200011000000000002',
    region: 'Talas',
    vehicle: 'Motosiklet',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    lateReason: '-',
    isDayOff: false,
    dayOffDays: 0,
    rating: 4.8,
    completedOrders: 211,
    activeOrders: 1,
    status: 'Çevrimdışı',
    breakReason: null,
    breakMinutes: null
  },
  {
    id: 3,
    name: 'Ali Yıldız',
    phone: '0555 333 44 55',
    password: '123456',
    iban: 'TR120006200011000000000003',
    region: 'Kocasinan',
    vehicle: 'Scooter',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    lateReason: '-',
    isDayOff: false,
    dayOffDays: 0,
    rating: 4.6,
    completedOrders: 167,
    activeOrders: 0,
    status: 'Mola',
    breakReason: 'Yemek',
    breakMinutes: 20
  },
  {
    id: 4,
    name: 'Fatma Demir',
    phone: '0555 444 55 66',
    password: '123456',
    iban: 'TR120006200011000000000004',
    region: 'Melikgazi',
    vehicle: 'Motosiklet',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    lateReason: '-',
    isDayOff: false,
    dayOffDays: 0,
    rating: 4.7,
    completedOrders: 194,
    activeOrders: 1,
    status: 'Çevrimiçi',
    breakReason: null,
    breakMinutes: null
  }
];

function getInitialCouriers(): CourierItem[] {
  const stored = readJsonFromLocalStorage<CourierItem[]>(COURIERS_STORAGE_KEY);
  if (stored && stored.length) {
    return stored.map((courier) => ({
      ...courier,
      password: courier.password ?? '123456',
      iban: courier.iban ?? '',
      shiftStart: courier.shiftStart ?? '09:00',
      shiftEnd: courier.shiftEnd ?? '18:00',
      lateReason: courier.lateReason ?? '-',
      isDayOff: courier.isDayOff ?? false,
      dayOffDays: courier.dayOffDays ?? 0
    }));
  }
  writeJsonToLocalStorage(COURIERS_STORAGE_KEY, DEFAULT_COURIERS);
  return DEFAULT_COURIERS;
}

@Injectable({
  providedIn: 'root'
})
export class CourierStateService {
  private readonly ngZone = inject(NgZone);
  private backendSyncTimer: ReturnType<typeof setInterval> | null = null;

  private currentCourierId = 1;

  private readonly couriersSubject = new BehaviorSubject<CourierItem[]>(getInitialCouriers());

  private readonly packageSortSubject = new BehaviorSubject<CourierPackageSortMode>(
    this.readSortForCourierId(this.currentCourierId)
  );
  private readonly pendingStatusUpdateByCourierId = new Set<number>();
  private lastStatusUpdateErrorMessage = '';
  private readonly autoAssignTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly autoAssignDeadlines = new Map<string, number>();

  constructor(
    private readonly auth: AuthService,
    private readonly orderState: OrderStateService,
    private readonly appSettings: AppSettingsService,
    private readonly adminCouriersService: AdminCouriersService,
    private readonly courierPanelService: CourierPanelService
  ) {
    this.attachCrossTabStorageListener();
    this.attachPackageSortStorageListener();
    this.attachBroadcastSyncListeners();
    this.hydrateCurrentCourierFromSession();
    this.orderState.orders$.subscribe(() => {
      this.syncActiveOrderCountsWithOrders();
      this.planAutoAssignments();
    });
    this.appSettings.settings$.subscribe(() => {
      this.planAutoAssignments();
    });
    this.startBackendSync();
  }

  /** Sayfa yenilemede session’daki kurye kimliğini belleğe alır. */
  private hydrateCurrentCourierFromSession(): void {
    const session = this.auth.getSession();
    if (session?.role === 'courier' && typeof session.contextCourierId === 'number') {
      this.setCurrentCourierId(session.contextCourierId);
    }
  }

  private attachCrossTabStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', this.onCouriersStorage);
  }

  private attachPackageSortStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', this.onPackageSortStorage);
  }

  private readonly onPackageSortStorage = (ev: StorageEvent): void => {
    if (ev.key !== COURIER_PACKAGE_SORT_KEY || ev.newValue == null) return;
    try {
      JSON.parse(ev.newValue);
      this.ngZone.run(() => {
        this.packageSortSubject.next(this.readSortForCourierId(this.currentCourierId));
      });
    } catch {
      // ignore
    }
  };

  private readSortForCourierId(courierId: number): CourierPackageSortMode {
    const map = readJsonFromLocalStorage<Record<string, string>>(COURIER_PACKAGE_SORT_KEY);
    const raw = map?.[String(courierId)];
    if (raw && isValidSortMode(raw)) {
      return raw;
    }
    return 'newest';
  }

  private persistSortForCourierId(courierId: number, mode: CourierPackageSortMode): void {
    const map = readJsonFromLocalStorage<Record<string, string>>(COURIER_PACKAGE_SORT_KEY) ?? {};
    map[String(courierId)] = mode;
    writeJsonToLocalStorage(COURIER_PACKAGE_SORT_KEY, map);
  }

  private readonly onCouriersStorage = (ev: StorageEvent): void => {
    if (ev.key !== COURIERS_STORAGE_KEY || ev.newValue == null) return;
    try {
      const parsed = JSON.parse(ev.newValue) as CourierItem[];
      // storage olayı Angular zone dışında tetiklenir; UI güncellenmesi için zone içinde yayınla
      this.ngZone.run(() => {
        this.couriersSubject.next(parsed);
      });
    } catch {
      // ignore
    }
  };

  private attachBroadcastSyncListeners(): void {
    subscribePanelSync(COURIERS_STORAGE_KEY, (valueJson) => {
      try {
        const parsed = JSON.parse(valueJson) as CourierItem[];
        this.ngZone.run(() => {
          this.couriersSubject.next(parsed);
        });
      } catch {
        // ignore
      }
    });

    subscribePanelSync(COURIER_PACKAGE_SORT_KEY, (valueJson) => {
      try {
        JSON.parse(valueJson);
        this.ngZone.run(() => {
          this.packageSortSubject.next(this.readSortForCourierId(this.currentCourierId));
        });
      } catch {
        // ignore
      }
    });
  }

  private nextCouriers(next: CourierItem[], persist: boolean): void {
    this.couriersSubject.next(next);
    if (persist) {
      writeJsonToLocalStorage(COURIERS_STORAGE_KEY, next);
    }
  }

  couriers$ = this.couriersSubject.asObservable();

  /** Aktif kurye için paket listesi sıralama tercihi (localStorage + senkron). */
  packageSort$ = this.packageSortSubject.asObservable();

  getPackageSortMode(): CourierPackageSortMode {
    return this.packageSortSubject.value;
  }

  setPackageSortMode(mode: CourierPackageSortMode): void {
    this.persistSortForCourierId(this.currentCourierId, mode);
    this.packageSortSubject.next(mode);
  }

  getCouriersSnapshot(): CourierItem[] {
    return this.couriersSubject.value;
  }

  getCurrentCourierId(): number {
    return this.currentCourierId;
  }

  setCurrentCourierId(courierId: number): boolean {
    const exists = this.couriersSubject.value.some((courier) => courier.id === courierId);
    if (!exists) {
      return false;
    }

    this.currentCourierId = courierId;
    this.packageSortSubject.next(this.readSortForCourierId(courierId));
    return true;
  }

  findCourierIdByPhone(phone: string): number | null {
    const normalizedInput = normalizeTurkishPhoneDigits(phone);
    const matched = this.couriersSubject.value.find(
      (courier) => normalizeTurkishPhoneDigits(courier.phone) === normalizedInput
    );

    return matched ? matched.id : null;
  }

  getCurrentCourier(): CourierItem | undefined {
    return this.couriersSubject.value.find((c) => c.id === this.currentCourierId);
  }

  setCourierOnlineStatus(courierId: number, status: 'Çevrimiçi' | 'Çevrimdışı'): Promise<boolean> {
    this.lastStatusUpdateErrorMessage = '';
    return this.updateCourierStatusOptimistic(courierId, {
      status,
      breakReason: null,
      breakMinutes: null
    });
  }

  setCourierBreak(
    courierId: number,
    reason: Exclude<BreakReason, null>,
    minutes: number
  ): Promise<boolean> {
    this.lastStatusUpdateErrorMessage = '';
    return this.updateCourierStatusOptimistic(courierId, {
      status: 'Mola',
      breakReason: reason,
      breakMinutes: minutes
    });
  }

  getLastStatusUpdateErrorMessage(): string {
    return this.lastStatusUpdateErrorMessage;
  }

  updateCourierStats(courierId: number, payload: Partial<Pick<CourierItem, 'completedOrders' | 'activeOrders'>>): void {
    const updated = this.couriersSubject.value.map((courier) =>
      courier.id === courierId
        ? {
            ...courier,
            ...payload
          }
        : courier
    );

    this.nextCouriers(updated, true);
  }

  updateCourierProfile(
    courierId: number,
    payload: Partial<
      Pick<
        CourierItem,
        | 'name'
        | 'phone'
        | 'password'
        | 'iban'
        | 'region'
        | 'vehicle'
        | 'shiftStart'
        | 'shiftEnd'
        | 'lateReason'
        | 'isDayOff'
        | 'dayOffDays'
      >
    >
  ): void {
    const updated = this.couriersSubject.value.map((courier) =>
      courier.id === courierId
        ? {
            ...courier,
            ...payload
          }
        : courier
    );

    this.nextCouriers(updated, true);
  }

  async assignPendingOrderToCourier(orderId: string, courierId: number, courierName: string): Promise<boolean> {
    const before = this.orderState.getOrdersSnapshot().find((order) => order.id === orderId);
    if (!before || before.courierId !== null || before.status !== 'Bekliyor') {
      return false;
    }

    const assigned = await this.orderState.assignOrderToCourierBackend(orderId, courierId);
    if (!assigned) {
      return false;
    }
    this.orderState.claimOrderByCourier(orderId, courierId, courierName);
    this.syncActiveOrderCountsWithOrders();

    const after = this.orderState.getOrdersSnapshot().find((order) => order.id === orderId);
    return !!after && after.courierId === courierId;
  }

  async assignOrderToBestCourier(orderId: string): Promise<{ ok: boolean; message: string; courierName?: string }> {
    const before = this.orderState.getOrdersSnapshot().find((order) => order.id === orderId);
    if (!before) {
      return { ok: false, message: 'Sipariş bulunamadı.' };
    }
    if (!(before.status === 'Bekliyor' || before.status === 'Atandı')) {
      return { ok: false, message: 'Bu durumda atama yapılamaz.' };
    }

    const candidate = this.pickBestCourierForAutoAssign();
    if (!candidate) {
      return { ok: false, message: 'Uygun kurye bulunamadı.' };
    }

    try {
      const assigned = await this.orderState.assignOrderToCourierBackend(orderId, candidate.id);
      if (!assigned) {
        return { ok: false, message: 'Atama tamamlanamadı.' };
      }
      this.orderState.assignOrder(orderId, candidate.id, candidate.name, 'manual');
      this.syncActiveOrderCountsWithOrders();
      const after = this.orderState.getOrdersSnapshot().find((order) => order.id === orderId);
      const success = !!after && after.courierId === candidate.id;
      if (!success) {
        return { ok: false, message: 'Atama tamamlanamadı.' };
      }
      return { ok: true, message: 'Sipariş atandı.', courierName: candidate.name };
    } catch {
      return { ok: false, message: 'Atama sırasında hata oluştu.' };
    }
  }

  /**
   * Dükkan "kurye çağır" aksiyonunu merkezden yönetir.
   * Siparişi havuza (atanmamış + Bekliyor) düşürür ve ilgili kaydı döner.
   */
  requestStoreOrderIntoPool(input: CreateOrderInput): SharedOrderItem | null {
    const requestOrder = this.orderState.requestStoreCourierCall(input);
    this.orderState.ensureOrderInPool(requestOrder.id);
    const normalized = this.orderState.getOrdersSnapshot().find((order) => order.id === requestOrder.id);
    return normalized ?? requestOrder;
  }

  private syncActiveOrderCountsWithOrders(): void {
    const orders = this.orderState.getOrdersSnapshot();
    const activeByCourierId = new Map<number, number>();
    for (const order of orders) {
      const isActive =
        order.courierId != null &&
        (order.status === 'Atandı' || order.status === 'Hazır Alınacak' || order.status === 'Yolda');
      if (!isActive || order.courierId == null) {
        continue;
      }
      activeByCourierId.set(order.courierId, (activeByCourierId.get(order.courierId) ?? 0) + 1);
    }

    let changed = false;
    const updated = this.couriersSubject.value.map((courier) => {
      const nextActive = activeByCourierId.get(courier.id) ?? 0;
      if (courier.activeOrders === nextActive) {
        return courier;
      }
      changed = true;
      return {
        ...courier,
        activeOrders: nextActive
      };
    });

    if (changed) {
      this.nextCouriers(updated, true);
    }
  }

  private planAutoAssignments(): void {
    const settings = this.appSettings.getSnapshot();
    const delaySeconds = Math.max(0, Math.floor(settings.automation.autoAssignDelaySeconds));
    const autoAssignEnabled = settings.automation.autoAssignCourier;
    const orders = this.orderState.getOrdersSnapshot();
    const eligibleOrderIds = new Set<string>();

    for (const order of orders) {
      if (!this.isAutoAssignableOrder(order)) {
        continue;
      }
      eligibleOrderIds.add(order.id);
      if (!autoAssignEnabled) {
        continue;
      }
      const dueAtMs = this.getAutoAssignDueAtMs(order, delaySeconds);
      const knownDeadline = this.autoAssignDeadlines.get(order.id);
      if (knownDeadline === dueAtMs && this.autoAssignTimers.has(order.id)) {
        continue;
      }
      this.clearAutoAssignTimer(order.id);
      this.scheduleAutoAssign(order.id, dueAtMs);
    }

    for (const orderId of [...this.autoAssignTimers.keys()]) {
      if (autoAssignEnabled && eligibleOrderIds.has(orderId)) {
        continue;
      }
      this.clearAutoAssignTimer(orderId);
    }
  }

  private scheduleAutoAssign(orderId: string, dueAtMs: number): void {
    const waitMs = Math.max(AUTO_ASSIGN_MIN_WAIT_MS, dueAtMs - Date.now());
    this.autoAssignDeadlines.set(orderId, dueAtMs);
    const timer = setTimeout(() => {
      this.autoAssignTimers.delete(orderId);
      this.autoAssignDeadlines.delete(orderId);
      this.runAutoAssign(orderId);
    }, waitMs);
    this.autoAssignTimers.set(orderId, timer);
  }

  private runAutoAssign(orderId: string): void {
    const settings = this.appSettings.getSnapshot();
    if (!settings.automation.autoAssignCourier) {
      return;
    }
    const delaySeconds = Math.max(0, Math.floor(settings.automation.autoAssignDelaySeconds));
    const order = this.orderState.getOrdersSnapshot().find((item) => item.id === orderId);
    if (!order || !this.isAutoAssignableOrder(order)) {
      return;
    }

    const dueAtMs = this.getAutoAssignDueAtMs(order, delaySeconds);
    if (Date.now() < dueAtMs) {
      this.scheduleAutoAssign(order.id, dueAtMs);
      return;
    }

    const candidate = this.pickBestCourierForAutoAssign();
    if (!candidate) {
      this.scheduleAutoAssign(order.id, Date.now() + AUTO_ASSIGN_RETRY_DELAY_MS);
      return;
    }

    this.orderState.assignOrder(order.id, candidate.id, candidate.name, 'auto');
  }

  private isAutoAssignableOrder(order: SharedOrderItem): boolean {
    return order.status === 'Bekliyor' && order.courierId === null;
  }

  private getAutoAssignDueAtMs(order: SharedOrderItem, delaySeconds: number): number {
    const baseMs = typeof order.createdAtMs === 'number' ? order.createdAtMs : Date.now();
    return baseMs + delaySeconds * 1000;
  }

  private pickBestCourierForAutoAssign(): CourierItem | null {
    const settings = this.appSettings.getSnapshot();
    const maxActive = settings.operations.maxActivePackagesPerCourier;
    const candidates = this.couriersSubject.value
      .filter((courier) => courier.status === 'Çevrimiçi')
      .filter((courier) => courier.activeOrders < maxActive)
      .sort((a, b) => {
        if (a.activeOrders !== b.activeOrders) {
          return a.activeOrders - b.activeOrders;
        }
        if (a.completedOrders !== b.completedOrders) {
          return b.completedOrders - a.completedOrders;
        }
        return b.rating - a.rating;
      });
    return candidates[0] ?? null;
  }

  private clearAutoAssignTimer(orderId: string): void {
    const timer = this.autoAssignTimers.get(orderId);
    if (timer) {
      clearTimeout(timer);
      this.autoAssignTimers.delete(orderId);
    }
    this.autoAssignDeadlines.delete(orderId);
  }

  private async updateCourierStatusOptimistic(
    courierId: number,
    statusPatch: Pick<CourierItem, 'status' | 'breakReason' | 'breakMinutes'>
  ): Promise<boolean> {
    if (this.pendingStatusUpdateByCourierId.has(courierId)) {
      return false;
    }
    const before = this.couriersSubject.value;
    const target = before.find((courier) => courier.id === courierId);
    if (!target) {
      return false;
    }

    const optimistic = before.map((courier) =>
      courier.id === courierId
        ? {
            ...courier,
            ...statusPatch
          }
        : courier
    );

    this.pendingStatusUpdateByCourierId.add(courierId);
    this.nextCouriers(optimistic, true);

    try {
      const role = this.auth.getRole();
      const apiStatus = this.toApiStatus(statusPatch.status);
      const statusPayload: {
        status: CourierApiStatus;
        breakReason?: string;
        breakMinutes?: number;
      } = { status: apiStatus };

      if (apiStatus === 'break') {
        statusPayload.breakReason = statusPatch.breakReason ?? 'Yemek';
        statusPayload.breakMinutes = statusPatch.breakMinutes ?? 20;
      }

      if (role === 'admin') {
        await this.adminCouriersService.updateCourierStatus(courierId, statusPayload);
      } else if (role === 'courier') {
        const response = await this.courierPanelService.updateMyStatus({
          status: apiStatus,
          isOnline: apiStatus !== 'offline',
          isOnBreak: apiStatus === 'break',
          ...(apiStatus === 'break'
            ? {
                breakReason: statusPayload.breakReason,
                breakMinutes: statusPayload.breakMinutes
              }
            : {})
        });
        if (!response) {
          throw new Error('Kurye durumu güncellenemedi.');
        }
      } else {
        await this.simulateCourierStatusPersist();
      }

      return true;
    } catch (error: unknown) {
      this.nextCouriers(before, true);
      this.lastStatusUpdateErrorMessage =
        error instanceof ApiRequestError
          ? error.message
          : 'Durum güncelleme sırasında bir hata oluştu.';
      return false;
    } finally {
      this.pendingStatusUpdateByCourierId.delete(courierId);
    }
  }

  private toApiStatus(status: CourierStatus): CourierApiStatus {
    if (status === 'Çevrimiçi') {
      return 'online';
    }
    if (status === 'Mola') {
      return 'break';
    }
    return 'offline';
  }

  private simulateCourierStatusPersist(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), STATUS_UPDATE_MOCK_DELAY_MS);
    });
  }

  private startBackendSync(): void {
    void this.syncCouriersFromBackend();
    if (typeof window === 'undefined') {
      return;
    }

    this.backendSyncTimer = setInterval(() => {
      void this.syncCouriersFromBackend();
    }, 15000);
  }

  private async syncCouriersFromBackend(): Promise<void> {
    const role = this.auth.getRole();
    if (!role) {
      return;
    }

    if (role === 'admin') {
      const backendCouriers = await this.adminCouriersService.getCouriers();
      if (backendCouriers.length) {
        const mapped = backendCouriers.map((item) => this.mapAdminCourierToCourierItem(item));
        this.nextCouriers(mapped, true);
      }
      return;
    }

    if (role === 'courier') {
      const profile = await this.courierPanelService.getMyProfile();
      if (!profile) {
        return;
      }

      const mapped = this.mapAdminCourierToCourierItem(profile);
      this.nextCouriers([mapped], true);
      this.setCurrentCourierId(mapped.id);
    }
  }

  private mapAdminCourierToCourierItem(item: AdminCourier): CourierItem {
    const status = this.mapCourierStatus(item.status, item.isOnline, item.isOnBreak);
    return {
      id: item.id,
      name: item.fullName,
      phone: item.phoneNumber,
      password: '123456',
      iban: '',
      region: item.region,
      vehicle: item.vehicleType,
      shiftStart: '09:00',
      shiftEnd: '18:00',
      lateReason: '-',
      isDayOff: false,
      dayOffDays: 0,
      rating: 4.8,
      completedOrders: 0,
      activeOrders: 0,
      status,
      breakReason: item.breakReason as BreakReason,
      breakMinutes: item.breakMinutes
    };
  }

  private mapCourierStatus(rawStatus: string, isOnline: boolean, isOnBreak: boolean): CourierStatus {
    if (isOnBreak || rawStatus.toLowerCase() === 'break') {
      return 'Mola';
    }
    if (isOnline || rawStatus.toLowerCase() === 'online') {
      return 'Çevrimiçi';
    }
    return 'Çevrimdışı';
  }

  async reloadFromBackend(): Promise<void> {
    await this.syncCouriersFromBackend();
  }
}
