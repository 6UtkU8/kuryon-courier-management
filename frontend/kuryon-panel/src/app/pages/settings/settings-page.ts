import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  OnDestroy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppSettings, SettingsCategoryId } from '../../core/models/app-settings.model';
import {
  DirectorPermissionKey,
  PERMISSION_CATEGORIES
} from '../../core/models/director-permission.model';
import { Director } from '../../core/models/director.model';
import { DirectorPermissionService } from '../../core/services/director-permission.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { Subscription } from 'rxjs';
import {
  OverlaySelectComponent,
  OverlaySelectOption
} from '../../shared/overlay-select/overlay-select.component';

type ToastType = 'success' | 'error' | 'info';
type ItemType = 'toggle' | 'select' | 'number' | 'text' | 'info';

type ItemOption = { label: string; value: string };
type SettingsItem = {
  key: string;
  type: ItemType;
  label: string;
  description: string;
  options?: ItemOption[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hasQuickSave?: boolean;
};
type SettingsSection = { title: string; subtitle: string; items: SettingsItem[] };
type SettingsCategory = {
  id: SettingsCategoryId;
  title: string;
  icon: string;
  hint: string;
  sections: SettingsSection[];
};

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlaySelectComponent],
  templateUrl: './settings-page.html',
  styleUrls: ['./settings-page.css', '../../shared/styles/panel-page-enter.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent implements OnDestroy {
  selectedCategory: SettingsCategoryId = 'general';
  settings: AppSettings;
  isDirty = false;
  updatedAtLabel = '';
  activeCategoryRef!: SettingsCategory;
  isFinanceReadonly = false;
  itemValueMap: Record<string, string | number | boolean> = {};

  showToast = false;
  toastMessage = '';
  toastType: ToastType = 'success';
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions = new Subscription();

  directors: Director[] = [];
  activeDirectors: Director[] = [];
  formerDirectors: Director[] = [];
  currentDirectorId = '';
  permissionCategories = PERMISSION_CATEGORIES;
  permissionDraft: DirectorPermissionKey[] = [];
  selectedDirectorForPermission: Director | null = null;
  showPermissionModal = false;
  showFormerDirectorsModal = false;
  showNewDirectorModal = false;
  newDirector = { fullName: '', email: '', phone: '' };
  readonly shiftStatusOptions: Director['shiftStatus'][] = ['Online', 'Offline', 'Mola'];
  readonly shiftStatusSelectOptions: OverlaySelectOption[] = this.shiftStatusOptions.map((value) => ({
    label: value,
    value
  }));

  readonly categories: SettingsCategory[] = [
    {
      id: 'general',
      title: 'Genel',
      icon: 'tune',
      hint: 'Firma ve iletişim bilgileri',
      sections: [
        {
          title: 'Temel Kimlik',
          subtitle: 'Panelde görünecek kurumsal bilgiler',
          items: [
            { key: 'general.companyName', type: 'text', label: 'Panel başlığı', description: 'Üst bar ve rapor başlıklarında kullanılır.' },
            { key: 'general.supportEmail', type: 'text', label: 'Destek e-posta adresi', description: 'Sistem uyarılarında referans adres olarak kullanılır.' },
            { key: 'general.supportPhone', type: 'text', label: 'Destek telefonu', description: 'Operasyon ekranlarında hızlı iletişim alanı.' },
            { key: 'general.officeAddress', type: 'text', label: 'Merkez adres', description: 'Rapor özetlerinde kullanılır.' }
          ]
        }
      ]
    },
    {
      id: 'operations',
      title: 'Paket ve Operasyon',
      icon: 'package_2',
      hint: 'Sipariş akışı kuralları',
      sections: [
        {
          title: 'Sipariş Kuralları',
          subtitle: 'Admin ve kurye akışını etkiler',
          items: [
            { key: 'operations.orderCancelWindowMinutes', type: 'number', label: 'Sipariş iptal süresi', description: 'Dakika bazlı eşiği aşan siparişler işaretlenir.', min: 1, max: 60, step: 1, suffix: 'dk', hasQuickSave: true },
            { key: 'operations.maxActivePackagesPerCourier', type: 'number', label: 'Kurye başına en fazla aktif paket', description: 'Dashboard atama ekranında limit bilgisini belirler.', min: 1, max: 12, step: 1, hasQuickSave: true },
            { key: 'operations.restaurantPhoneRequired', type: 'toggle', label: 'Restoran telefonu zorunlu', description: 'Yeni sipariş formunda restoran telefonu zorunlu olur.' },
            { key: 'operations.courierSeesAddressAfterPickup', type: 'toggle', label: 'Kurye adresi teslim almadan görmesin', description: 'Kurye paket listesinde adres maskeleme uygulanır.' }
          ]
        }
      ]
    },
    {
      id: 'automation',
      title: 'Otomasyon',
      icon: 'smart_toy',
      hint: 'Otomatik operasyon yardımcıları',
      sections: [
        {
          title: 'Atama Motoru',
          subtitle: 'Otomatik süreç davranışı',
          items: [
            { key: 'automation.autoAssignCourier', type: 'toggle', label: 'Otomatik kurye atama', description: 'Uygun kuryeye otomatik yönlendirme yapılmasını sağlar.' },
            { key: 'automation.autoAssignDelaySeconds', type: 'number', label: 'Atama gecikmesi', description: 'Atama önerisinin devreye girme süresi.', min: 5, max: 300, step: 5, suffix: 'sn' },
            { key: 'automation.smartPriorityEnabled', type: 'toggle', label: 'Akıllı öncelikleme', description: 'Yoğun saatlerde öncelik puanı etkin olur.' }
          ]
        }
      ]
    },
    {
      id: 'mapLocation',
      title: 'Harita ve Konum',
      icon: 'map',
      hint: 'Canlı konum ve görünürlük',
      sections: [
        {
          title: 'Harita Parametreleri',
          subtitle: 'Canlı takip davranışı',
          items: [
            { key: 'mapLocation.liveRefreshSeconds', type: 'number', label: 'Canlı yenileme sıklığı', description: 'Harita verisinin güncellenme periyodu.', min: 5, max: 120, step: 5, suffix: 'sn', hasQuickSave: true },
            { key: 'mapLocation.showCourierTrails', type: 'toggle', label: 'Kurye izlerini göster', description: 'Haritada rota izi görünümü.' },
            {
              key: 'mapLocation.addressVisibilityMode',
              type: 'select',
              label: 'Adres görünürlük modu',
              description: 'Kurye tarafında adres detayının açılma anı.',
              options: [
                { label: 'Siparişi kabul edince', value: 'after_accept' },
                { label: 'Teslim alındıktan sonra', value: 'after_pickup' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'regionPricing',
      title: 'Bölge ve Fiyatlandırma',
      icon: 'local_offer',
      hint: 'Teslimat ücret mantığı',
      sections: [
        {
          title: 'Fiyat Motoru',
          subtitle: 'Bölge odaklı hesaplama',
          items: [
            {
              key: 'regionPricing.pricingMode',
              type: 'select',
              label: 'Hesaplama tipi',
              description: 'Teslimat ücret modelini belirler.',
              options: [
                { label: 'Bölge sabit', value: 'zone_flat' },
                { label: 'Mesafe katmanı', value: 'distance_tier' },
                { label: 'Hibrit model', value: 'hybrid' }
              ]
            },
            { key: 'regionPricing.baseDeliveryFee', type: 'number', label: 'Temel teslimat ücreti', description: 'Varsayılan başlangıç ücreti.', min: 0, max: 500, step: 1, suffix: 'TL' },
            { key: 'regionPricing.distanceStepKm', type: 'number', label: 'Mesafe adımı', description: 'Katman hesaplamasında km adımı.', min: 1, max: 20, step: 1, suffix: 'km' }
          ]
        }
      ]
    },
    {
      id: 'financePayment',
      title: 'Finans ve Ödeme',
      icon: 'payments',
      hint: 'Ödeme görünümü ve rapor',
      sections: [
        {
          title: 'Ödeme Sunumu',
          subtitle: 'Rapor kartları ve ödeme dağılımı',
          items: [
            {
              key: 'financePayment.defaultPaymentView',
              type: 'select',
              label: 'Varsayılan ödeme görünümü',
              description: 'Rapor ekranlarının açılış filtresi.',
              options: [
                { label: 'Nakit', value: 'cash' },
                { label: 'Kart', value: 'card' },
                { label: 'Karma', value: 'mixed' }
              ]
            },
            { key: 'financePayment.highlightOnlinePayments', type: 'toggle', label: 'Çevrim içi ödemeleri vurgula', description: 'Tablo satırlarında görsel etiketleme yapar.' }
          ]
        }
      ]
    },
    {
      id: 'shiftBreak',
      title: 'Vardiya ve Mola',
      icon: 'schedule',
      hint: 'Kurye durumu ve mola politikası',
      sections: [
        {
          title: 'Mola Politikası',
          subtitle: 'Kurye panelindeki mola eylemi',
          items: [
            { key: 'shiftBreak.allowBreakRequests', type: 'toggle', label: 'Mola talebine izin ver', description: 'Kapalıysa kurye mola durumuna geçiş yapamaz.' },
            { key: 'shiftBreak.peakHoursBreakRestriction', type: 'toggle', label: 'Yoğun saatte mola kısıtı', description: '12:00-14:00 ve 18:00-20:00 aralığında kısıtlama uygular.' },
            { key: 'shiftBreak.defaultBreakMinutes', type: 'number', label: 'Varsayılan mola süresi', description: 'Kurye panelinde önerilen mola süresi.', min: 5, max: 60, step: 5, suffix: 'dk' }
          ]
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Bildirimler',
      icon: 'notifications',
      hint: 'Panel bildirim davranışları',
      sections: [
        {
          title: 'Bildirim Kanalları',
          subtitle: 'Kullanıcı deneyimi seçenekleri',
          items: [
            { key: 'notifications.enableSound', type: 'toggle', label: 'Bildirim sesi', description: 'Kritik aksiyonlarda ses geri bildirimi.' },
            { key: 'notifications.enablePush', type: 'toggle', label: 'Anlık bildirim', description: 'Panel içi üst katman uyarılarını açar.' },
            { key: 'notifications.enableEmailSummary', type: 'toggle', label: 'E-posta özeti', description: 'Gün sonu özet gönderimi için ana anahtar.' }
          ]
        }
      ]
    },
    {
      id: 'brandAppearance',
      title: 'Marka ve Görünüm',
      icon: 'palette',
      hint: 'Tema tonu ve yoğunluk',
      sections: [
        {
          title: 'Görsel Kimlik',
          subtitle: 'Admin + Kurye panellerine anlık yansır',
          items: [
            {
              key: 'brandAppearance.accentPreset',
              type: 'select',
              label: 'Panel vurgu rengi',
              description: 'Buton ve vurgularda kullanılan gradyan.',
              options: [
                { label: 'Cyan / Mor', value: 'cyan' },
                { label: 'Violet / Indigo', value: 'violet' },
                { label: 'Emerald / Cyan', value: 'emerald' },
                { label: 'Amber / Orange', value: 'amber' }
              ]
            },
            {
              key: 'brandAppearance.cardDensity',
              type: 'select',
              label: 'Kart yoğunluğu',
              description: 'Comfortable veya compact boşluk düzeni.',
              options: [
                { label: 'Rahat', value: 'comfortable' },
                { label: 'Kompakt', value: 'compact' }
              ]
            },
            { key: 'brandAppearance.useGlassSurfaces', type: 'toggle', label: 'Cam yüzey etkisi', description: 'Kartlarda blur / glass hissi uygular.' }
          ]
        }
      ]
    },
    {
      id: 'securityLogs',
      title: 'Güvenlik / Kayıtlar',
      icon: 'shield',
      hint: 'Kayıt ve denetim davranışı',
      sections: [
        {
          title: 'İzleme Seviyesi',
          subtitle: 'Günlükleme ve saklama ayarları',
          items: [
            {
              key: 'securityLogs.logLevel',
              type: 'select',
              label: 'Kayıt detay seviyesi',
              description: 'Sistem kayıt yoğunluğunu belirler.',
              options: [
                { label: 'Sadece Hata', value: 'error' },
                { label: 'Uyarı', value: 'warn' },
                { label: 'Bilgi', value: 'info' },
                { label: 'Debug', value: 'debug' }
              ]
            },
            { key: 'securityLogs.retainDays', type: 'number', label: 'Kayıt saklama süresi', description: 'Kayıtların tutulma süresi.', min: 1, max: 365, step: 1, suffix: 'gün' },
            { key: 'securityLogs.showSensitiveEvents', type: 'toggle', label: 'Hassas olayları göster', description: 'Gizlilik seviyesine göre olay görünümü.' },
            { key: 'meta.updatedAtIso', type: 'info', label: 'Son güncelleme', description: 'Ayarların en son kaydedildiği zaman.' }
          ]
        }
      ]
    },
    {
      id: 'directors',
      title: 'Direktörler',
      icon: 'manage_accounts',
      hint: 'Yöneticiler ve yetki yönetimi',
      sections: []
    }
  ];

  constructor(
    private readonly settingsService: AppSettingsService,
    private readonly directorService: DirectorPermissionService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.settings = this.clone(this.settingsService.getSnapshot());
    this.updatedAtLabel = this.toUpdatedAtLabel(this.settings.meta.updatedAtIso);
    this.refreshActiveCategoryState();
    this.rebuildItemValueMap();
    this.subscriptions.add(
      this.settingsService.settings$.subscribe((next) => {
        this.settings = this.clone(next);
        this.updatedAtLabel = this.toUpdatedAtLabel(this.settings.meta.updatedAtIso);
        this.rebuildItemValueMap();
        this.isDirty = false;
        this.cdr.markForCheck();
      })
    );
    this.subscriptions.add(
      this.directorService.directors$.subscribe((directors) => {
        this.directors = directors;
        this.activeDirectors = directors.filter((director) => director.employmentStatus === 'Aktif');
        this.formerDirectors = directors.filter((director) => director.employmentStatus !== 'Aktif');
        this.cdr.markForCheck();
      })
    );
    this.subscriptions.add(
      this.directorService.currentDirector$.subscribe((director) => {
        this.currentDirectorId = director?.id ?? '';
        this.refreshActiveCategoryState();
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
  }

  selectCategory(id: SettingsCategoryId): void {
    this.selectedCategory = id;
    this.refreshActiveCategoryState();
    this.cdr.markForCheck();
  }

  onItemValueChange(item: SettingsItem, value: string | number | boolean): void {
    this.writeByPath(item.key, value);
    this.itemValueMap[item.key] = value;
    this.settingsService.updateByPath(item.key, value);
    this.isDirty = false;
    this.cdr.markForCheck();
  }

  quickSave(item: SettingsItem): void {
    const current = this.itemValueMap[item.key];
    if (typeof current === 'number') {
      if (item.min !== undefined && current < item.min) {
        this.onItemValueChange(item, item.min);
      }
      if (item.max !== undefined && current > item.max) {
        this.onItemValueChange(item, item.max);
      }
    }
    this.openToast('Hızlı güncelleme anında uygulandı.', 'success');
  }

  saveAll(successMessage = 'Ayarlar kaydedildi ve panellere uygulandı.'): void {
    this.settingsService.patch({
      meta: {
        updatedBy: 'Admin'
      }
    });
    this.updatedAtLabel = this.toUpdatedAtLabel(this.settings.meta.updatedAtIso);
    this.rebuildItemValueMap();
    this.isDirty = false;
    this.openToast(successMessage, 'success');
    this.cdr.markForCheck();
  }

  resetAll(): void {
    this.settingsService.reset();
    this.settings = this.clone(this.settingsService.getSnapshot());
    this.updatedAtLabel = this.toUpdatedAtLabel(this.settings.meta.updatedAtIso);
    this.rebuildItemValueMap();
    this.isDirty = false;
    this.openToast('Varsayılan ayarlara dönüldü.', 'info');
    this.cdr.markForCheck();
  }

  private toUpdatedAtLabel(iso: string): string {
    const date = new Date(iso);
    return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }

  trackByCategory(_: number, item: SettingsCategory): string {
    return item.id;
  }

  private readByPath(path: string): unknown {
    const parts = path.split('.');
    let cursor: unknown = this.settings;
    for (const part of parts) {
      if (cursor == null || typeof cursor !== 'object') {
        return '';
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    return cursor ?? '';
  }

  private writeByPath(path: string, value: string | number | boolean): void {
    const parts = path.split('.');
    let cursor: Record<string, unknown> = this.settings as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor = cursor[parts[i]] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }

  private clone(value: AppSettings): AppSettings {
    return JSON.parse(JSON.stringify(value)) as AppSettings;
  }

  private openToast(message: string, type: ToastType): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.toastTimeoutId = setTimeout(() => this.closeToast(), 2600);
    this.cdr.markForCheck();
  }

  closeToast(): void {
    this.showToast = false;
    this.toastMessage = '';
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    this.cdr.markForCheck();
  }

  setCurrentDirector(id: string): void {
    this.directorService.setCurrentDirector(id);
  }

  openPermissionModal(director: Director): void {
    if (!this.directorService.can('change_roles')) {
      this.openToast('Rol değişikliği izni olmadığı için açılamadı.', 'error');
      return;
    }
    this.selectedDirectorForPermission = director;
    this.permissionDraft = [...director.permissions];
    this.showPermissionModal = true;
  }

  closePermissionModal(): void {
    this.showPermissionModal = false;
    this.selectedDirectorForPermission = null;
    this.permissionDraft = [];
  }

  hasDraftPermission(permission: DirectorPermissionKey): boolean {
    return this.permissionDraft.includes(permission);
  }

  onDraftPermissionChange(permission: DirectorPermissionKey, checked: boolean): void {
    if (checked) {
      this.permissionDraft = [...new Set([...this.permissionDraft, permission])];
      return;
    }
    this.permissionDraft = this.permissionDraft.filter((item) => item !== permission);
  }

  saveDirectorPermissions(): void {
    if (!this.selectedDirectorForPermission) {
      return;
    }
    this.directorService.updateDirectorPermissions(
      this.selectedDirectorForPermission.id,
      this.permissionDraft
    );
    this.closePermissionModal();
    this.openToast('Direktör yetkileri güncellendi.', 'success');
  }

  updateShiftStatus(id: string, value: string): void {
    this.directorService.setDirectorShiftStatus(id, value as Director['shiftStatus']);
  }

  setEmploymentStatus(id: string, status: Director['employmentStatus']): void {
    this.directorService.setDirectorEmploymentStatus(id, status);
  }

  openNewDirectorModal(): void {
    this.newDirector = { fullName: '', email: '', phone: '' };
    this.showNewDirectorModal = true;
  }

  closeNewDirectorModal(): void {
    this.showNewDirectorModal = false;
  }

  createDirector(): void {
    if (!this.newDirector.fullName.trim() || !this.newDirector.email.trim() || !this.newDirector.phone.trim()) {
      this.openToast('Tüm alanlar zorunludur.', 'error');
      return;
    }
    this.directorService.createDirector(this.newDirector);
    this.showNewDirectorModal = false;
    this.openToast('Yeni direktör eklendi.', 'success');
  }

  getShiftBadgeClass(value: Director['shiftStatus']): string {
    if (value === 'Online') {
      return 'badge-online';
    }
    if (value === 'Mola') {
      return 'badge-break';
    }
    return 'badge-offline';
  }

  getEmploymentBadgeClass(value: Director['employmentStatus']): string {
    if (value === 'Aktif') {
      return 'badge-active';
    }
    if (value === 'Pasif') {
      return 'badge-passive';
    }
    return 'badge-exit';
  }

  trackByDirector(_: number, director: Director): string {
    return director.id;
  }

  trackByPermissionCategory(_: number, category: { id: string }): string {
    return category.id;
  }

  trackByPermission(
    _: number,
    permission: { key: DirectorPermissionKey }
  ): DirectorPermissionKey {
    return permission.key;
  }

  trackBySection(_: number, section: { title: string }): string {
    return section.title;
  }

  trackBySettingsItem(_: number, item: { key: string }): string {
    return item.key;
  }

  trackByOption(_: number, option: { value: string }): string {
    return option.value;
  }

  private refreshActiveCategoryState(): void {
    this.activeCategoryRef =
      this.categories.find((category) => category.id === this.selectedCategory) ?? this.categories[0];
    this.isFinanceReadonly =
      this.activeCategoryRef.id === 'financePayment' &&
      !this.directorService.can('edit_financial_settings');
  }

  private rebuildItemValueMap(): void {
    const nextMap: Record<string, string | number | boolean> = {};
    for (const category of this.categories) {
      for (const section of category.sections) {
        for (const item of section.items) {
          nextMap[item.key] = this.readByPath(item.key) as string | number | boolean;
        }
      }
    }
    this.itemValueMap = nextMap;
  }
}