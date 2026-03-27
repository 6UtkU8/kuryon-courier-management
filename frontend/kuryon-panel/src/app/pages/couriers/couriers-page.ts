import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';
import {
  CourierItem,
  CourierStateService,
  CourierStatus
} from '../../core/services/courier-state.service';
import { DirectorPermissionService } from '../../core/services/director-permission.service';
import { ActiveDirectorContextService } from '../../core/services/active-director-context.service';
import { AdminApplicationsService } from '../../core/services/admin-applications.service';
import {
  ibanValidator,
  numericRangeValidator,
  phoneValidator,
  timeRangeValidator,
  trimmedRequiredTextValidator
} from '../../core/validators';
import { UI_TEXTS } from '../../shared/ui/ui-texts';
import { UiNoticeService } from '../../core/services/ui-notice.service';

type CouriersTab = 'active' | 'applications' | 'history';
type LateReason = '-' | 'Trafik' | 'Hastalık' | 'Araç Arızası' | 'Kişisel';
type ShiftWorkStatus = 'Planlandı' | 'Aktif' | 'İzinli' | 'Pasif';
type BreakHistoryStatus = 'Beklemede' | 'Onaylandı' | 'Reddedildi' | 'Sonlandırıldı';
type PoolWorkState = 'Aktif' | 'Pasif' | 'Molada';

type ShiftScheduleRow = {
  id: number;
  courierId: number;
  courierName: string;
  phone: string;
  password: string;
  iban: string;
  shiftStart: string;
  shiftEnd: string;
  lateReason: LateReason;
  isDayOff: boolean;
  dayOffDays: number;
  workStatus: ShiftWorkStatus;
  courierStatus: CourierStatus;
};

type ShiftEditDraft = {
  courierName: string;
  phone: string;
  password: string;
  iban: string;
  shiftStart: string;
  shiftEnd: string;
  lateReason: LateReason;
  isDayOff: boolean;
  dayOffDays: number;
  workStatus: ShiftWorkStatus;
  courierStatus: CourierStatus;
};

type BreakHistoryRow = {
  id: number;
  courierName: string;
  accepted: string;
  status: BreakHistoryStatus;
  acceptedBy: string;
  rejectedBy: string;
  endedBy: string;
  minutes: number;
  requestedAt: string;
  statusClass: string;
};

type PoolCourierRow = {
  id: number;
  mesaiDurumu: string;
  name: string;
  workType: string;
  settingsLabel: string;
  maxBasketPackages: number;
  rating: number;
  workState: PoolWorkState;
  isDirty: boolean;
  isEditing: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  stateClass: string;
};

@Component({
  selector: 'app-couriers-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './couriers-page.html',
  styleUrls: ['./couriers-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CouriersPageComponent implements OnInit, OnDestroy {
  private readonly courierState = inject(CourierStateService);
  private readonly directorPermissions = inject(DirectorPermissionService);
  private readonly activeDirectorContext = inject(ActiveDirectorContextService);
  private readonly adminApplicationsService = inject(AdminApplicationsService);
  private readonly uiNotice = inject(UiNoticeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = UI_TEXTS;

  activeTab: CouriersTab = 'active';
  searchTerm = '';
  breakHistorySearchTerm = '';
  poolSearchTerm = '';
  statusActionError = '';
  pageError = '';
  isPageLoading = true;
  statusFilter = 'Tümü';

  statusOptions = ['Tümü', 'Çevrimiçi', 'Çevrimdışı', 'Mola'];
  tabOptions: { key: CouriersTab; label: string }[] = [
    { key: 'active', label: 'Aktif Kuryeler' },
    { key: 'applications', label: 'Başvurular' },
    { key: 'history', label: 'Vardiya Geçmişi' }
  ];
  lateReasonOptions: LateReason[] = ['-', 'Trafik', 'Hastalık', 'Araç Arızası', 'Kişisel'];
  shiftStatusOptions: ShiftWorkStatus[] = ['Planlandı', 'Aktif', 'İzinli', 'Pasif'];
  poolStateOptions: PoolWorkState[] = ['Aktif', 'Pasif', 'Molada'];
  courierStatusOptions: CourierStatus[] = ['Çevrimiçi', 'Çevrimdışı', 'Mola'];
  canAddCourier = false;
  canEditCourier = false;
  canChangeCourierMaxPackage = false;
  activeDirectorId = '';

  couriers: CourierItem[] = [];
  availableCount = 0;
  offlineCount = 0;
  breakCount = 0;
  shiftRows: ShiftScheduleRow[] = [];
  displayedShiftRows: ShiftScheduleRow[] = [];
  isShiftLoading = true;
  activeDrawerRowId: number | null = null;
  shiftEditDraft: ShiftEditDraft | null = null;
  drawerFieldErrors: Partial<Record<keyof ShiftEditDraft, string>> = {};
  displayedBreakHistoryRows: BreakHistoryRow[] = [];
  displayedPoolCourierRows: PoolCourierRow[] = [];
  breakHistoryRows: BreakHistoryRow[] = [
    {
      id: 2411,
      courierName: 'Mehmet Kaya',
      accepted: 'Evet',
      status: 'Onaylandı',
      acceptedBy: 'Admin-1',
      rejectedBy: '-',
      endedBy: 'Sistem',
      minutes: 20,
      requestedAt: '2026-03-26 09:40',
      statusClass: 'status-available'
    },
    {
      id: 2412,
      courierName: 'Zeynep Taş',
      accepted: 'Hayır',
      status: 'Reddedildi',
      acceptedBy: '-',
      rejectedBy: 'Admin-2',
      endedBy: '-',
      minutes: 15,
      requestedAt: '2026-03-26 10:05',
      statusClass: 'status-rejected'
    },
    {
      id: 2413,
      courierName: 'Ali Yıldız',
      accepted: 'Evet',
      status: 'Sonlandırıldı',
      acceptedBy: 'Admin-1',
      rejectedBy: '-',
      endedBy: 'Admin-3',
      minutes: 30,
      requestedAt: '2026-03-26 11:10',
      statusClass: 'status-review'
    }
  ];
  poolCourierRows: PoolCourierRow[] = [
    {
      id: 701,
      mesaiDurumu: 'Gündüz',
      name: 'Fatma Demir',
      workType: 'Tam Zamanlı',
      settingsLabel: 'Standart',
      maxBasketPackages: 4,
      rating: 4.7,
      workState: 'Aktif',
      isDirty: false,
      isEditing: false,
      saving: false,
      lastSavedAt: null,
      stateClass: 'status-available'
    },
    {
      id: 702,
      mesaiDurumu: 'Akşam',
      name: 'Mehmet Kaya',
      workType: 'Part Time',
      settingsLabel: 'Yoğun Saat',
      maxBasketPackages: 3,
      rating: 4.9,
      workState: 'Molada',
      isDirty: false,
      isEditing: false,
      saving: false,
      lastSavedAt: null,
      stateClass: 'status-break'
    },
    {
      id: 703,
      mesaiDurumu: 'Gece',
      name: 'Zeynep Taş',
      workType: 'Tam Zamanlı',
      settingsLabel: 'Standart',
      maxBasketPackages: 5,
      rating: 4.8,
      workState: 'Pasif',
      isDirty: false,
      isEditing: false,
      saving: false,
      lastSavedAt: null,
      stateClass: 'status-offline'
    }
  ];
  shiftHistory = [
    {
      id: 1,
      courierId: 1,
      courierName: 'Mehmet Kaya',
      startedAt: '2026-03-25 09:00',
      endedAt: '2026-03-25 18:00',
      breakType: 'Yemek',
      breakMinutes: 25,
      statusChanges: ['09:00 Çevrimiçi', '13:10 Mola', '13:35 Çevrimiçi', '18:00 Çevrimdışı']
    },
    {
      id: 2,
      courierId: 2,
      courierName: 'Zeynep Taş',
      startedAt: '2026-03-25 08:30',
      endedAt: '2026-03-25 17:20',
      breakType: '-',
      breakMinutes: 0,
      statusChanges: ['08:30 Çevrimiçi', '17:20 Çevrimdışı']
    },
    {
      id: 3,
      courierId: 3,
      courierName: 'Ali Yıldız',
      startedAt: '2026-03-24 10:00',
      endedAt: '2026-03-24 19:10',
      breakType: 'Tamir',
      breakMinutes: 40,
      statusChanges: ['10:00 Çevrimiçi', '14:45 Mola', '15:25 Çevrimiçi', '19:10 Çevrimdışı']
    },
    {
      id: 4,
      courierId: 4,
      courierName: 'Fatma Demir',
      startedAt: '2026-03-24 09:15',
      endedAt: '2026-03-24 18:35',
      breakType: 'Benzin',
      breakMinutes: 15,
      statusChanges: ['09:15 Çevrimiçi', '12:55 Mola', '13:10 Çevrimiçi', '18:35 Çevrimdışı']
    }
  ];
  currentDrawerCourierStatus: CourierStatus | '-' = '-';
  private shiftSearchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private breakSearchDebounceId: ReturnType<typeof setTimeout> | null = null;
  private poolSearchDebounceId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.isPageLoading = true;
    this.pageError = '';
    void this.loadBackendData();
    this.recomputePermissionFlags();
    this.directorPermissions.currentDirector$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recomputePermissionFlags();
      });
    combineLatest([this.courierState.couriers$, this.activeDirectorContext.activeDirectorId$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([couriers, directorId]) => {
        this.activeDirectorId = directorId;
        const scopedCouriers = this.activeDirectorContext.filterCouriers(couriers, directorId);
        this.couriers = scopedCouriers;
        this.availableCount = scopedCouriers.filter((courier) => courier.status === 'Çevrimiçi').length;
        this.offlineCount = scopedCouriers.filter((courier) => courier.status === 'Çevrimdışı').length;
        this.breakCount = scopedCouriers.filter((courier) => courier.status === 'Mola').length;
        this.syncShiftRowsFromCouriers(scopedCouriers);
        this.computeDisplayedShiftRows();
        this.computeDisplayedBreakHistoryRows();
        this.computeDisplayedPoolRows();
        this.isShiftLoading = false;
    });
  }

  ngOnDestroy(): void {
    if (this.shiftSearchDebounceId) {
      clearTimeout(this.shiftSearchDebounceId);
    }
    if (this.breakSearchDebounceId) {
      clearTimeout(this.breakSearchDebounceId);
    }
    if (this.poolSearchDebounceId) {
      clearTimeout(this.poolSearchDebounceId);
    }
  }

  setStatusFilter(status: string): void {
    this.statusFilter = status;
    this.computeDisplayedShiftRows();
  }

  setActiveTab(tab: CouriersTab): void {
    this.activeTab = tab;
    this.closeShiftEditDrawer();
    this.computeDisplayedShiftRows();
    this.computeDisplayedBreakHistoryRows();
    this.computeDisplayedPoolRows();
  }

  onShiftSearchChange(value: string): void {
    this.searchTerm = value;
    if (this.shiftSearchDebounceId) {
      clearTimeout(this.shiftSearchDebounceId);
    }
    this.shiftSearchDebounceId = setTimeout(() => {
      this.computeDisplayedShiftRows();
      this.shiftSearchDebounceId = null;
    }, 140);
  }

  onBreakHistorySearchChange(value: string): void {
    this.breakHistorySearchTerm = value;
    if (this.breakSearchDebounceId) {
      clearTimeout(this.breakSearchDebounceId);
    }
    this.breakSearchDebounceId = setTimeout(() => {
      this.computeDisplayedBreakHistoryRows();
      this.breakSearchDebounceId = null;
    }, 140);
  }

  onPoolSearchChange(value: string): void {
    this.poolSearchTerm = value;
    if (this.poolSearchDebounceId) {
      clearTimeout(this.poolSearchDebounceId);
    }
    this.poolSearchDebounceId = setTimeout(() => {
      this.computeDisplayedPoolRows();
      this.poolSearchDebounceId = null;
    }, 140);
  }

  openShiftEditDrawer(rowId: number): void {
    if (!this.canEditCourier) {
      return;
    }
    const row = this.shiftRows.find((item) => item.id === rowId);
    if (!row) {
      return;
    }

    this.activeDrawerRowId = rowId;
    this.shiftEditDraft = {
      courierName: row.courierName,
      phone: row.phone,
      password: row.password,
      iban: row.iban,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      lateReason: row.lateReason,
      isDayOff: row.isDayOff,
      dayOffDays: row.dayOffDays,
      workStatus: row.workStatus,
      courierStatus: row.courierStatus
    };
    this.currentDrawerCourierStatus = row.courierStatus;
  }

  closeShiftEditDrawer(): void {
    this.activeDrawerRowId = null;
    this.shiftEditDraft = null;
    this.drawerFieldErrors = {};
    this.currentDrawerCourierStatus = '-';
  }

  onDrawerDayOffChange(isChecked: boolean): void {
    if (!this.shiftEditDraft) {
      return;
    }
    this.shiftEditDraft.isDayOff = isChecked;
    this.shiftEditDraft.workStatus = isChecked ? 'İzinli' : 'Planlandı';
    this.shiftEditDraft.dayOffDays = isChecked
      ? Math.max(this.shiftEditDraft.dayOffDays, 1)
      : 0;
  }

  async setShiftStatus(courierId: number, status: CourierStatus): Promise<void> {
    this.statusActionError = '';
    const ok =
      status === 'Mola'
        ? await this.courierState.setCourierBreak(courierId, 'Yemek', 20)
        : await this.courierState.setCourierOnlineStatus(courierId, status);

    if (!ok) {
      this.statusActionError =
        this.courierState.getLastStatusUpdateErrorMessage() ||
        'Kurye durumu güncellenemedi. Lütfen tekrar deneyin.';
      this.uiNotice.showToast(this.statusActionError, 'error');
      return;
    }
    this.uiNotice.showToast('Kurye durumu güncellendi.', 'success');
  }

  saveShiftDrawer(): void {
    if (this.activeDrawerRowId == null || !this.shiftEditDraft) {
      return;
    }
    if (!this.validateShiftDrawerDraft(this.shiftEditDraft)) {
      return;
    }

    const row = this.shiftRows.find((item) => item.id === this.activeDrawerRowId);
    if (!row) {
      this.closeShiftEditDrawer();
      return;
    }

    const target = this.couriers.find((courier) => courier.id === row.courierId);
    if (!target) {
      return;
    }

    this.courierState.updateCourierProfile(target.id, {
      name: this.shiftEditDraft.courierName,
      phone: this.shiftEditDraft.phone,
      password: this.shiftEditDraft.password,
      iban: this.shiftEditDraft.iban,
      region: target.region,
      vehicle: target.vehicle,
      shiftStart: this.shiftEditDraft.shiftStart,
      shiftEnd: this.shiftEditDraft.shiftEnd,
      lateReason: this.shiftEditDraft.lateReason,
      isDayOff: this.shiftEditDraft.isDayOff,
      dayOffDays: this.shiftEditDraft.isDayOff
        ? Math.max(this.shiftEditDraft.dayOffDays, 1)
        : 0
    });

    if (this.shiftEditDraft.isDayOff) {
      this.courierState.setCourierOnlineStatus(target.id, 'Çevrimdışı');
    } else if (this.shiftEditDraft.courierStatus === 'Mola') {
      this.courierState.setCourierBreak(
        target.id,
        target.breakReason ?? 'Yemek',
        target.breakMinutes ?? 20
      );
    } else {
      this.courierState.setCourierOnlineStatus(target.id, this.shiftEditDraft.courierStatus);
    }

    this.closeShiftEditDrawer();
  }

  private validateShiftDrawerDraft(draft: ShiftEditDraft): boolean {
    const errors: Partial<Record<keyof ShiftEditDraft, string>> = {};

    const nameControl = new FormControl(draft.courierName, [trimmedRequiredTextValidator()]);
    if (nameControl.errors?.['requiredTrimmed']) {
      errors.courierName = this.t.couriers.fullNameRequired;
    }

    const phoneControl = new FormControl(draft.phone, [trimmedRequiredTextValidator(), phoneValidator()]);
    if (phoneControl.errors?.['requiredTrimmed']) {
      errors.phone = this.t.couriers.phoneRequired;
    } else if (phoneControl.errors?.['phone']) {
      errors.phone = this.t.couriers.validPhone;
    }

    const passwordControl = new FormControl(draft.password, [trimmedRequiredTextValidator()]);
    if (passwordControl.errors?.['requiredTrimmed']) {
      errors.password = this.t.couriers.passwordRequired;
    } else if (draft.password.trim().length < 6) {
      errors.password = this.t.couriers.passwordMinLength;
    }

    const ibanControl = new FormControl(draft.iban, [trimmedRequiredTextValidator(), ibanValidator()]);
    if (ibanControl.errors?.['requiredTrimmed']) {
      errors.iban = this.t.couriers.ibanRequired;
    } else if (ibanControl.errors?.['iban']) {
      errors.iban = this.t.couriers.validIban;
    }

    const dayOffDaysControl = new FormControl(draft.dayOffDays, [numericRangeValidator(1, 30)]);
    if (draft.isDayOff && dayOffDaysControl.errors?.['numericRange']) {
      errors.dayOffDays = this.t.couriers.leaveDayRange;
    }

    const timeGroup = new FormGroup(
      {
        shiftStart: new FormControl(draft.shiftStart),
        shiftEnd: new FormControl(draft.shiftEnd)
      },
      { validators: timeRangeValidator('shiftStart', 'shiftEnd') }
    );
    if (timeGroup.errors?.['timeRange']) {
      errors.shiftStart = this.t.couriers.shiftStartBeforeEnd;
      errors.shiftEnd = this.t.couriers.shiftEndAfterStart;
    }

    this.drawerFieldErrors = errors;
    return Object.keys(errors).length === 0;
  }

  startPoolRowEdit(rowId: number): void {
    if (!this.canEditCourier) {
      return;
    }
    const row = this.poolCourierRows.find((item) => item.id === rowId);
    if (row) {
      row.isEditing = true;
    }
    this.computeDisplayedPoolRows();
  }

  markPoolRowDirty(rowId: number): void {
    if (!this.canChangeCourierMaxPackage) {
      return;
    }
    const row = this.poolCourierRows.find((item) => item.id === rowId);
    if (row) {
      row.isDirty = true;
      row.isEditing = true;
    }
    this.computeDisplayedPoolRows();
  }

  savePoolRow(rowId: number): void {
    const savedAt = new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const row = this.poolCourierRows.find((item) => item.id === rowId);
    if (row) {
      row.saving = false;
      row.isDirty = false;
      row.isEditing = false;
      row.lastSavedAt = savedAt;
    }
    this.computeDisplayedPoolRows();
  }

  setPoolWorkState(rowId: number, state: PoolWorkState): void {
    const row = this.poolCourierRows.find((item) => item.id === rowId);
    if (row) {
      row.workState = state;
      row.stateClass = this.getPoolStateClass(state);
      row.isDirty = true;
      row.isEditing = true;
    }
    this.computeDisplayedPoolRows();
  }

  trackByShiftRowId(_: number, row: ShiftScheduleRow): number {
    return row.id;
  }

  trackByTabOption(_: number, tab: { key: CouriersTab }): string {
    return tab.key;
  }

  trackByStatusOption(_: number, status: string): string {
    return status;
  }

  trackByBreakHistoryRow(_: number, row: BreakHistoryRow): number {
    return row.id;
  }

  trackByPoolRow(_: number, row: PoolCourierRow): number {
    return row.id;
  }

  trackByLateReason(_: number, reason: LateReason): LateReason {
    return reason;
  }

  trackByCourierStatus(_: number, status: CourierStatus): CourierStatus {
    return status;
  }

  getBreakStatusClass(status: BreakHistoryStatus): string {
    switch (status) {
      case 'Onaylandı':
        return 'status-available';
      case 'Reddedildi':
        return 'status-rejected';
      case 'Sonlandırıldı':
        return 'status-review';
      default:
        return 'status-break';
    }
  }

  getPoolStateClass(status: PoolWorkState): string {
    switch (status) {
      case 'Aktif':
        return 'status-available';
      case 'Pasif':
        return 'status-offline';
      case 'Molada':
        return 'status-break';
      default:
        return '';
    }
  }

  private syncShiftRowsFromCouriers(couriers: CourierItem[]): void {
    if (!this.shiftRows.length) {
      this.shiftRows = couriers.map((courier) => ({
        id: courier.id,
        courierId: courier.id,
        courierName: courier.name,
        phone: courier.phone,
        password: courier.password ?? '',
        iban: courier.iban ?? '',
        shiftStart: courier.shiftStart || '09:00',
        shiftEnd: courier.shiftEnd || '18:00',
        lateReason: (courier.lateReason as LateReason) || '-',
        isDayOff: !!courier.isDayOff,
        dayOffDays: courier.dayOffDays ?? 0,
        workStatus: courier.status === 'Çevrimiçi' ? 'Aktif' : 'Pasif',
        courierStatus: courier.status
      }));
      return;
    }

    this.shiftRows = this.shiftRows.map((row) => {
      const liveCourier = couriers.find((courier) => courier.id === row.courierId);
      if (!liveCourier) {
        return row;
      }

      return {
        ...row,
        courierName: liveCourier.name,
        phone: liveCourier.phone,
        password: liveCourier.password ?? row.password,
        iban: liveCourier.iban ?? row.iban,
        shiftStart: liveCourier.shiftStart || row.shiftStart,
        shiftEnd: liveCourier.shiftEnd || row.shiftEnd,
        lateReason: (liveCourier.lateReason as LateReason) || row.lateReason,
        isDayOff: !!liveCourier.isDayOff,
        dayOffDays: liveCourier.dayOffDays ?? row.dayOffDays,
        courierStatus: liveCourier.status
      };
    });
    if (this.activeDrawerRowId !== null) {
      const active = this.shiftRows.find((item) => item.id === this.activeDrawerRowId);
      this.currentDrawerCourierStatus = active?.courierStatus ?? '-';
    }
    this.computeDisplayedShiftRows();
  }

  private computeDisplayedShiftRows(): void {
    const search = this.searchTerm.trim().toLowerCase();
    this.displayedShiftRows = this.shiftRows.filter((row) => {
      const matchesSearch = !search || row.courierName.toLowerCase().includes(search);
      const matchesStatus =
        this.statusFilter === 'Tümü' || row.courierStatus === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  private computeDisplayedBreakHistoryRows(): void {
    const search = this.breakHistorySearchTerm.trim().toLowerCase();
    const scopedRows = this.activeDirectorContext.filterRowsByNumericId(
      this.breakHistoryRows,
      this.activeDirectorId
    );
    this.displayedBreakHistoryRows = scopedRows.filter((entry) => {
      if (!search) {
        return true;
      }

      return (
        entry.courierName.toLowerCase().includes(search) ||
        entry.status.toLowerCase().includes(search) ||
        entry.requestedAt.toLowerCase().includes(search)
      );
    });
  }

  private computeDisplayedPoolRows(): void {
    const search = this.poolSearchTerm.trim().toLowerCase();
    const scopedRows = this.activeDirectorContext.filterRowsByNumericId(
      this.poolCourierRows,
      this.activeDirectorId
    );
    this.displayedPoolCourierRows = scopedRows.filter((row) => {
      if (!search) {
        return true;
      }

      return (
        row.name.toLowerCase().includes(search) ||
        row.workType.toLowerCase().includes(search) ||
        row.mesaiDurumu.toLowerCase().includes(search)
      );
    });
  }

  private recomputePermissionFlags(): void {
    this.canAddCourier = this.directorPermissions.can('add_courier');
    this.canEditCourier = this.directorPermissions.can('edit_courier');
    this.canChangeCourierMaxPackage = this.directorPermissions.can('change_courier_max_package');
  }

  private async loadApplicationsFromBackend(): Promise<void> {
    const applications = await this.adminApplicationsService.getApplications();
    if (!applications.length) {
      this.breakHistoryRows = [];
      this.computeDisplayedBreakHistoryRows();
      return;
    }

    this.breakHistoryRows = applications.map((item) => ({
      id: item.id,
      courierName: item.fullName,
      accepted: item.status === 'Approved' ? 'Evet' : 'Hayır',
      status:
        item.status === 'Approved'
          ? 'Onaylandı'
          : item.status === 'Rejected'
            ? 'Reddedildi'
            : 'Beklemede',
      acceptedBy: item.status === 'Approved' ? 'Admin' : '-',
      rejectedBy: item.status === 'Rejected' ? 'Admin' : '-',
      endedBy: '-',
      minutes: 0,
      requestedAt: new Date(item.createdAt).toLocaleString('tr-TR'),
      statusClass:
        item.status === 'Approved'
          ? 'status-available'
          : item.status === 'Rejected'
            ? 'status-rejected'
            : 'status-break'
    }));

    this.computeDisplayedBreakHistoryRows();
  }

  async reloadPage(): Promise<void> {
    await this.loadBackendData();
  }

  private async loadBackendData(): Promise<void> {
    this.isPageLoading = true;
    this.pageError = '';
    try {
      await Promise.all([this.courierState.reloadFromBackend(), this.loadApplicationsFromBackend()]);
    } catch (error: unknown) {
      this.pageError = error instanceof Error ? error.message : 'Kurye verileri yüklenemedi.';
      this.uiNotice.showToast(this.pageError, 'error');
    } finally {
      this.isPageLoading = false;
    }
  }
}