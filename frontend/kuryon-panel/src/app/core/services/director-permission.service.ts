import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { Director, DirectorEmploymentStatus, DirectorShiftStatus } from '../models/director.model';
import {
  ALL_PERMISSION_KEYS,
  DirectorPermissionKey
} from '../models/director-permission.model';

const DIRECTORS_STORAGE_KEY = 'kuryon.directors.v1';
const ACTIVE_DIRECTOR_STORAGE_KEY = 'kuryon.active.director.v1';

const SUPER_ADMIN_PERMISSIONS = [...ALL_PERMISSION_KEYS];
const OPERATIONS_DIRECTOR_PERMISSIONS: DirectorPermissionKey[] = [
  'view_dashboard',
  'view_orders_page',
  'view_couriers_page',
  'view_reports_page',
  'view_settings_page',
  'view_directors_area',
  'assign_order',
  'edit_order',
  'cancel_order',
  'send_test_package',
  'start_auto_packaging',
  'manage_package_pool',
  'view_all_orders',
  'add_courier',
  'edit_courier',
  'change_courier_shift',
  'change_courier_max_package',
  'view_hourly_density_table',
  'view_regional_reports',
  'view_director_performance_reports',
  'view_finance_summary'
];
const REPORTING_DIRECTOR_PERMISSIONS: DirectorPermissionKey[] = [
  'view_dashboard',
  'view_orders_page',
  'view_reports_page',
  'view_settings_page',
  'view_hourly_density_table',
  'view_reconciliation_list',
  'view_regional_reports',
  'view_director_performance_reports',
  'view_finance_summary',
  'view_logs',
  'export_log_details'
];
const HR_DIRECTOR_PERMISSIONS: DirectorPermissionKey[] = [
  'view_dashboard',
  'view_couriers_page',
  'view_settings_page',
  'view_directors_area',
  'add_courier',
  'edit_courier',
  'change_courier_shift',
  'finish_courier_job',
  'download_courier_end_of_day',
  'toggle_courier_break_requests'
];
const FINANCE_DIRECTOR_PERMISSIONS: DirectorPermissionKey[] = [
  'view_dashboard',
  'view_reports_page',
  'view_finance_page',
  'view_settings_page',
  'edit_financial_settings',
  'edit_receipt',
  'view_changed_receipts',
  'view_logs',
  'view_finance_summary',
  'view_reconciliation_list'
];

const DEFAULT_DIRECTORS: Director[] = [
  {
    id: 'dir-001',
    fullName: 'Mert Aydin',
    email: 'mert.aydin@kuryon.demo',
    phone: '0553 812 11 20',
    shiftStatus: 'Online',
    employmentStatus: 'Aktif',
    permissions: SUPER_ADMIN_PERMISSIONS
  },
  {
    id: 'dir-002',
    fullName: 'Elif Cakir',
    email: 'elif.cakir@kuryon.demo',
    phone: '0552 744 08 19',
    shiftStatus: 'Online',
    employmentStatus: 'Aktif',
    permissions: OPERATIONS_DIRECTOR_PERMISSIONS
  },
  {
    id: 'dir-003',
    fullName: 'Hakan Yalcin',
    email: 'hakan.yalcin@kuryon.demo',
    phone: '0554 320 67 45',
    shiftStatus: 'Offline',
    employmentStatus: 'Aktif',
    permissions: REPORTING_DIRECTOR_PERMISSIONS
  },
  {
    id: 'dir-004',
    fullName: 'Zehra Kose',
    email: 'zehra.kose@kuryon.demo',
    phone: '0551 962 48 12',
    shiftStatus: 'Mola',
    employmentStatus: 'Aktif',
    permissions: HR_DIRECTOR_PERMISSIONS
  },
  {
    id: 'dir-005',
    fullName: 'Can Berk',
    email: 'can.berk@kuryon.demo',
    phone: '0555 633 19 82',
    shiftStatus: 'Offline',
    employmentStatus: 'Pasif',
    permissions: FINANCE_DIRECTOR_PERMISSIONS
  },
  {
    id: 'dir-006',
    fullName: 'Seda Uslu',
    email: 'seda.uslu@kuryon.demo',
    phone: '0550 284 73 55',
    shiftStatus: 'Offline',
    employmentStatus: 'Isten Cikti',
    permissions: []
  }
];

@Injectable({ providedIn: 'root' })
export class DirectorPermissionService {
  private readonly directorsSubject = new BehaviorSubject<Director[]>(this.readDirectors());
  private readonly currentDirectorIdSubject = new BehaviorSubject<string>(
    this.readActiveDirectorId()
  );

  readonly directors$ = this.directorsSubject.asObservable();
  readonly currentDirectorId$ = this.currentDirectorIdSubject.asObservable();
  readonly currentDirector$ = combineLatest([this.directors$, this.currentDirectorId$]).pipe(
    map(([directors, currentId]) => directors.find((director) => director.id === currentId) ?? null)
  );

  constructor() {
    this.ensureValidCurrentDirector();
  }

  getDirectorsSnapshot(): Director[] {
    return this.directorsSubject.value;
  }

  getCurrentDirectorId(): string {
    return this.currentDirectorIdSubject.value;
  }

  getCurrentDirector(): Director | null {
    return this.getDirectorsSnapshot().find((item) => item.id === this.getCurrentDirectorId()) ?? null;
  }

  setCurrentDirector(id: string): void {
    const target = this.getDirectorsSnapshot().find((director) => director.id === id);
    if (!target || target.employmentStatus !== 'Aktif') {
      return;
    }
    this.currentDirectorIdSubject.next(id);
    this.persistActiveDirector(id);
  }

  can(permission: DirectorPermissionKey): boolean {
    const director = this.getCurrentDirector();
    if (!director || director.employmentStatus !== 'Aktif') {
      return false;
    }
    return director.permissions.includes(permission);
  }

  hasAny(permissions: DirectorPermissionKey[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  updateDirectorPermissions(id: string, permissions: DirectorPermissionKey[]): void {
    const valid = permissions.filter((permission) => ALL_PERMISSION_KEYS.includes(permission));
    const next = this.getDirectorsSnapshot().map((director) =>
      director.id === id ? { ...director, permissions: [...new Set(valid)] } : director
    );
    this.directorsSubject.next(next);
    this.persistDirectors(next);
  }

  setDirectorShiftStatus(id: string, shiftStatus: DirectorShiftStatus): void {
    const next = this.getDirectorsSnapshot().map((director) =>
      director.id === id ? { ...director, shiftStatus } : director
    );
    this.directorsSubject.next(next);
    this.persistDirectors(next);
  }

  setDirectorEmploymentStatus(id: string, employmentStatus: DirectorEmploymentStatus): void {
    const next = this.getDirectorsSnapshot().map((director) =>
      director.id === id ? { ...director, employmentStatus } : director
    );
    this.directorsSubject.next(next);
    this.persistDirectors(next);
    this.ensureValidCurrentDirector();
  }

  createDirector(payload: Pick<Director, 'fullName' | 'email' | 'phone'>): void {
    const nextId = `dir-${String(Date.now()).slice(-6)}`;
    const next: Director = {
      id: nextId,
      fullName: payload.fullName.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      shiftStatus: 'Offline',
      employmentStatus: 'Aktif',
      permissions: [
        'view_dashboard',
        'view_orders_page',
        'view_couriers_page',
        'view_reports_page',
        'view_settings_page'
      ]
    };
    const all = [next, ...this.getDirectorsSnapshot()];
    this.directorsSubject.next(all);
    this.persistDirectors(all);
  }

  getFirstAccessibleAdminRoute(): string {
    if (this.can('view_dashboard')) {
      return '/dashboard';
    }
    if (this.can('view_orders_page')) {
      return '/orders';
    }
    if (this.can('view_couriers_page')) {
      return '/couriers';
    }
    if (this.can('view_reports_page')) {
      return '/reports';
    }
    if (this.can('view_settings_page')) {
      return '/settings';
    }
    return '/';
  }

  private ensureValidCurrentDirector(): void {
    const all = this.getDirectorsSnapshot();
    const current = all.find((director) => director.id === this.currentDirectorIdSubject.value);
    const hasCurrentActive = current && current.employmentStatus === 'Aktif';
    if (hasCurrentActive) {
      return;
    }
    const fallback = all.find((director) => director.employmentStatus === 'Aktif') ?? all[0];
    if (!fallback) {
      return;
    }
    this.currentDirectorIdSubject.next(fallback.id);
    this.persistActiveDirector(fallback.id);
  }

  private readDirectors(): Director[] {
    if (typeof window === 'undefined') {
      return DEFAULT_DIRECTORS;
    }
    try {
      const raw = window.localStorage.getItem(DIRECTORS_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_DIRECTORS;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return DEFAULT_DIRECTORS;
      }
      const safeDirectors = parsed
        .map((item) => this.normalizeDirector(item))
        .filter((item): item is Director => item !== null);
      if (safeDirectors.length === 0) {
        return DEFAULT_DIRECTORS;
      }
      return this.deduplicateById(safeDirectors);
    } catch {
      return DEFAULT_DIRECTORS;
    }
  }

  private readActiveDirectorId(): string {
    if (typeof window === 'undefined') {
      return DEFAULT_DIRECTORS[0].id;
    }
    return window.localStorage.getItem(ACTIVE_DIRECTOR_STORAGE_KEY) ?? DEFAULT_DIRECTORS[0].id;
  }

  private persistDirectors(directors: Director[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(DIRECTORS_STORAGE_KEY, JSON.stringify(directors));
  }

  private persistActiveDirector(id: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(ACTIVE_DIRECTOR_STORAGE_KEY, id);
  }

  private deduplicateById(directors: Director[]): Director[] {
    const seen = new Set<string>();
    const unique: Director[] = [];
    for (const director of directors) {
      if (seen.has(director.id)) {
        continue;
      }
      seen.add(director.id);
      unique.push(director);
    }
    return unique;
  }

  private normalizeDirector(input: unknown): Director | null {
    if (!input || typeof input !== 'object') {
      return null;
    }
    const raw = input as Partial<Director>;
    if (!raw.id || typeof raw.id !== 'string' || !raw.fullName || typeof raw.fullName !== 'string') {
      return null;
    }
    const shiftStatus: DirectorShiftStatus =
      raw.shiftStatus === 'Online' || raw.shiftStatus === 'Offline' || raw.shiftStatus === 'Mola'
        ? raw.shiftStatus
        : 'Offline';
    const employmentStatus: DirectorEmploymentStatus =
      raw.employmentStatus === 'Aktif' ||
      raw.employmentStatus === 'Pasif' ||
      raw.employmentStatus === 'Isten Cikti'
        ? raw.employmentStatus
        : 'Pasif';
    return {
      id: raw.id,
      fullName: raw.fullName.trim(),
      email: typeof raw.email === 'string' ? raw.email : '',
      phone: typeof raw.phone === 'string' ? raw.phone : '',
      shiftStatus,
      employmentStatus,
      permissions: Array.isArray(raw.permissions)
        ? raw.permissions.filter((permission): permission is DirectorPermissionKey => {
            return typeof permission === 'string' && ALL_PERMISSION_KEYS.includes(permission as DirectorPermissionKey);
          })
        : []
    };
  }
}
