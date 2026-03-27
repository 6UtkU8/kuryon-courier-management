import { Routes } from '@angular/router';
import { authChildGuard, authGuard } from './core/guards/auth.guard';
import { roleChildGuard, roleGuard } from './core/guards/role.guard';
import { permissionChildGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home-page').then((m) => m.HomePageComponent), data: { title: 'Kuryon' } },
  {
    path: 'login-select',
    loadComponent: () => import('./pages/auth/login-select-page').then((m) => m.LoginSelectPageComponent),
    data: { title: 'Rol Seçimi' }
  },
  {
    path: 'company-login',
    loadComponent: () => import('./pages/auth/company-login-page').then((m) => m.CompanyLoginPageComponent),
    data: { title: 'Admin Girişi' }
  },
  {
    path: 'courier-login',
    loadComponent: () => import('./pages/auth/courier-login-page').then((m) => m.CourierLoginPageComponent),
    data: { title: 'Kurye Girişi' }
  },
  {
    path: 'store-login',
    loadComponent: () => import('./pages/auth/store-login-page').then((m) => m.StoreLoginPageComponent),
    data: { title: 'Dükkan Girişi' }
  },
  {
    path: 'store-panel',
    loadComponent: () =>
      import('./pages/store-panel/store-dashboard-page').then((m) => m.StoreDashboardPageComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['store'], title: 'Anasayfa' }
  },

  {
    path: 'courier-panel',
    loadComponent: () =>
      import('./pages/courier-panel/courier-layout-page').then((m) => m.CourierLayoutPageComponent),
    canActivate: [authGuard, roleGuard],
    canActivateChild: [authChildGuard, roleChildGuard],
    data: { roles: ['courier'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/courier-panel/courier-home-page').then((m) => m.CourierHomePageComponent),
        data: { roles: ['courier'], title: 'Anasayfa' }
      },
      {
        path: 'packages',
        loadComponent: () =>
          import('./pages/courier-panel/courier-packages-page').then((m) => m.CourierPackagesPageComponent),
        data: { roles: ['courier'], title: 'Paketler' }
      },
      {
        path: 'reports/day/:dayKey',
        loadComponent: () =>
          import('./pages/courier-panel/courier-report-day-page').then((m) => m.CourierReportDayPageComponent),
        data: { roles: ['courier'], title: 'Günlük Rapor' }
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/courier-panel/courier-reports-page').then((m) => m.CourierReportsPageComponent),
        data: { roles: ['courier'], title: 'Raporlar' }
      },
      { path: 'tools', redirectTo: 'havuz', pathMatch: 'full' },
      {
        path: 'havuz',
        loadComponent: () =>
          import('./pages/courier-panel/courier-tools-page').then((m) => m.CourierToolsPageComponent),
        data: { roles: ['courier'], title: 'Havuz' }
      }
    ]
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout/admin-layout').then((m) => m.AdminLayoutComponent),
    canActivate: [authGuard, roleGuard],
    canActivateChild: [authChildGuard, roleChildGuard, permissionChildGuard],
    data: { roles: ['admin'] },
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardComponent),
        data: { roles: ['admin'], permission: 'view_dashboard', title: 'Dashboard' }
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/orders/orders-page').then((m) => m.OrdersPageComponent),
        data: { roles: ['admin'], permission: 'view_orders_page', title: 'Siparişler' }
      },
      {
        path: 'couriers',
        loadComponent: () => import('./pages/couriers/couriers-page').then((m) => m.CouriersPageComponent),
        data: { roles: ['admin'], permission: 'view_couriers_page', title: 'Kuryeler' }
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports/reports-page').then((m) => m.ReportsPageComponent),
        data: { roles: ['admin'], permission: 'view_reports_page', title: 'Raporlar' }
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPageComponent),
        data: { roles: ['admin'], permission: 'view_settings_page', title: 'Ayarlar' }
      }
    ]
  },
  { path: '**', redirectTo: '' }
];