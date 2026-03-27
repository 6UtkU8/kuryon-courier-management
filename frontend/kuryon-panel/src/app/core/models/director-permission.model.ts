export type DirectorPermissionKey =
  | 'view_dashboard'
  | 'view_orders_page'
  | 'view_couriers_page'
  | 'view_reports_page'
  | 'view_businesses_page'
  | 'view_map_page'
  | 'view_finance_page'
  | 'view_settings_page'
  | 'view_directors_area'
  | 'assign_order'
  | 'edit_order'
  | 'cancel_order'
  | 'send_test_package'
  | 'start_auto_packaging'
  | 'manage_package_pool'
  | 'add_company'
  | 'disable_company_access'
  | 'view_all_orders'
  | 'add_courier'
  | 'edit_courier'
  | 'change_courier_shift'
  | 'finish_courier_job'
  | 'change_courier_max_package'
  | 'view_courier_package_fee'
  | 'change_courier_package_fee'
  | 'download_courier_end_of_day'
  | 'toggle_courier_break_requests'
  | 'change_courier_prep_time'
  | 'edit_financial_settings'
  | 'edit_receipt'
  | 'view_changed_receipts'
  | 'view_logs'
  | 'export_log_details'
  | 'change_notification_settings'
  | 'change_brand_settings'
  | 'mobile_access'
  | 'change_roles'
  | 'terminate_manager_jobs'
  | 'view_hourly_density_table'
  | 'view_reconciliation_list'
  | 'view_regional_reports'
  | 'view_director_performance_reports'
  | 'view_finance_summary';

export type PermissionCategory = {
  id: string;
  title: string;
  permissions: { key: DirectorPermissionKey; label: string }[];
};

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'page-access',
    title: 'Sayfa Erişim Yetkileri',
    permissions: [
      { key: 'view_dashboard', label: 'Dashboard görüntüleyebilir' },
      { key: 'view_orders_page', label: 'Siparişler sayfasını görüntüleyebilir' },
      { key: 'view_couriers_page', label: 'Kuryeler sayfasını görüntüleyebilir' },
      { key: 'view_reports_page', label: 'Raporlar sayfasını görüntüleyebilir' },
      { key: 'view_businesses_page', label: 'İşletmeler sayfasını görüntüleyebilir' },
      { key: 'view_map_page', label: 'Harita sayfasını görüntüleyebilir' },
      { key: 'view_finance_page', label: 'Finans sayfasını görüntüleyebilir' },
      { key: 'view_settings_page', label: 'Ayarlar sayfasını görüntüleyebilir' },
      { key: 'view_directors_area', label: 'Direktörler alanını görüntüleyebilir' }
    ]
  },
  {
    id: 'operations',
    title: 'Operasyon Yetkileri',
    permissions: [
      { key: 'assign_order', label: 'Sipariş atayabilir' },
      { key: 'edit_order', label: 'Sipariş düzenleyebilir' },
      { key: 'cancel_order', label: 'Sipariş iptal edebilir' },
      { key: 'send_test_package', label: 'Test paketi gönderebilir' },
      { key: 'start_auto_packaging', label: 'Otomatik paketlemeyi başlatabilir' },
      { key: 'manage_package_pool', label: 'Paket havuzuna müdahale edebilir' },
      { key: 'add_company', label: 'Şirket ekleyebilir' },
      { key: 'disable_company_access', label: 'Şirket erişimini kapatabilir' },
      { key: 'view_all_orders', label: 'Tüm siparişleri görüntüleyebilir' }
    ]
  },
  {
    id: 'courier',
    title: 'Kurye Yetkileri',
    permissions: [
      { key: 'add_courier', label: 'Kurye ekleyebilir' },
      { key: 'edit_courier', label: 'Kurye düzenleyebilir' },
      { key: 'change_courier_shift', label: 'Kurye vardiyasını değiştirebilir' },
      { key: 'finish_courier_job', label: 'Kuryelerin işini bitirebilir' },
      { key: 'change_courier_max_package', label: 'Kurye azami paket sayısını değiştirebilir' },
      { key: 'view_courier_package_fee', label: 'Kurye paket başı ücretini görüntüleyebilir' },
      { key: 'change_courier_package_fee', label: 'Kurye paket başı ücretini değiştirebilir' },
      { key: 'download_courier_end_of_day', label: 'Kurye gün sonu tablosunu indirebilir' },
      { key: 'toggle_courier_break_requests', label: 'Kurye mola isteklerini açıp kapatabilir' },
      { key: 'change_courier_prep_time', label: 'Kurye hazırlık süresini değiştirebilir' }
    ]
  },
  {
    id: 'finance-system',
    title: 'Finans ve Sistem Yetkileri',
    permissions: [
      { key: 'edit_financial_settings', label: 'Mali ayarları düzenleyebilir' },
      { key: 'edit_receipt', label: 'Fiş düzenleyebilir' },
      { key: 'view_changed_receipts', label: 'Değiştirilmiş fişleri görüntüleyebilir' },
      { key: 'view_logs', label: 'Kayıtları görüntüleyebilir' },
      { key: 'export_log_details', label: 'Kayıt detaylarını dışa aktarabilir' },
      { key: 'change_notification_settings', label: 'Bildirim ayarlarını değiştirebilir' },
      { key: 'change_brand_settings', label: 'Marka ayarlarını değiştirebilir' },
      { key: 'mobile_access', label: 'Mobil erişim sağlayabilir' },
      { key: 'change_roles', label: 'Rolleri değiştirebilir' },
      { key: 'terminate_manager_jobs', label: 'Yöneticilerin işini sonlandırabilir' }
    ]
  },
  {
    id: 'reporting',
    title: 'Rapor ve Analiz Yetkileri',
    permissions: [
      { key: 'view_hourly_density_table', label: 'Saatlik yoğunluk tablosunu görüntüleyebilir' },
      { key: 'view_reconciliation_list', label: 'Mutabakat listesini görüntüleyebilir' },
      { key: 'view_regional_reports', label: 'Bölgesel raporları görüntüleyebilir' },
      {
        key: 'view_director_performance_reports',
        label: 'Direktör performans raporlarını görüntüleyebilir'
      },
      { key: 'view_finance_summary', label: 'Finans özetini görüntüleyebilir' }
    ]
  }
];

export const ALL_PERMISSION_KEYS: DirectorPermissionKey[] = PERMISSION_CATEGORIES.flatMap(
  (category) => category.permissions.map((permission) => permission.key)
);
