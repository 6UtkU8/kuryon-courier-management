import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';

import { AdminNewOrderDrawerService } from '../../core/services/admin-new-order-drawer.service';
import { DirectorPermissionKey } from '../../core/models/director-permission.model';
import { DirectorPermissionService } from '../../core/services/director-permission.service';

type SidebarItem = {
  label: string;
  icon: string;
  route: string;
  permission: DirectorPermissionKey;
};

const MAIN_MENU_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    permission: 'view_dashboard'
  },
  {
    label: 'Siparişler',
    icon: 'receipt_long',
    route: '/orders',
    permission: 'view_orders_page'
  },
  {
    label: 'Kuryeler',
    icon: 'local_shipping',
    route: '/couriers',
    permission: 'view_couriers_page'
  },
  {
    label: 'Raporlar',
    icon: 'bar_chart',
    route: '/reports',
    permission: 'view_reports_page'
  }
];

const SETTINGS_ITEM: SidebarItem = {
  label: 'Ayarlar',
  icon: 'settings',
  route: '/settings',
  permission: 'view_settings_page'
};

const NEW_ORDER_ACTION_PERMISSIONS: DirectorPermissionKey[] = [
  'send_test_package',
  'assign_order',
  'edit_order'
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() mobileOpen = false;

  readonly mainMenuItems = MAIN_MENU_ITEMS;
  readonly settingsItem = SETTINGS_ITEM;
  readonly dashboardRouteActiveOptions = { exact: true };
  readonly defaultRouteActiveOptions = { exact: false };

  visibleMainMenuItems: SidebarItem[] = [];
  canViewSettings = false;
  canOpenNewOrderAction = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly newOrderDrawer: AdminNewOrderDrawerService,
    private readonly directorPermissions: DirectorPermissionService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.recomputePermissionDrivenView();
    this.subscriptions.add(
      this.directorPermissions.currentDirector$.subscribe(() => {
        this.recomputePermissionDrivenView();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  trackByRoute(_: number, item: SidebarItem): string {
    return item.route;
  }

  openNewOrderDrawer(): void {
    if (!this.canOpenNewOrderAction) {
      return;
    }
    this.newOrderDrawer.requestOpen();
  }

  private recomputePermissionDrivenView(): void {
    this.visibleMainMenuItems = this.mainMenuItems.filter((item) =>
      this.directorPermissions.can(item.permission)
    );
    this.canViewSettings = this.directorPermissions.can(this.settingsItem.permission);
    this.canOpenNewOrderAction = this.directorPermissions.hasAny(NEW_ORDER_ACTION_PERMISSIONS);
    this.cdr.markForCheck();
  }
}
