import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Data, NavigationEnd, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

import { AuthService } from './auth.service';
import { CourierStateService } from './courier-state.service';
import { OrderStateService } from './order-state.service';

@Injectable({ providedIn: 'root' })
export class AppTitleService {
  private initialized = false;

  constructor(
    private readonly title: Title,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly courierState: CourierStateService,
    private readonly orderState: OrderStateService
  ) {}

  init(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const navigationEnd$ = this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null)
    );

    const session$ = this.auth.session$.pipe(startWith(this.auth.getSession()));

    combineLatest([navigationEnd$, session$])
      .pipe(
        map(() => this.buildTitle()),
        map((nextTitle) => nextTitle.trim() || 'Kuryon Panel')
      )
      .subscribe((nextTitle) => {
        this.title.setTitle(nextTitle);
      });
  }

  private buildTitle(): string {
    const routeTitle = this.getDeepestRouteTitle(this.activatedRoute);
    const session = this.auth.getSession();

    if (!session) {
      return routeTitle ? `${routeTitle} | Kuryon` : 'Kuryon Panel';
    }

    if (session.role === 'admin') {
      return routeTitle ? `${routeTitle} | Admin Paneli` : 'Admin Paneli | Kuryon';
    }

    if (session.role === 'courier') {
      const courierName = this.courierState.getCurrentCourier()?.name?.trim();
      if (!courierName) {
        return 'Kuryon Panel';
      }
      return routeTitle ? `${routeTitle} | ${courierName}` : `${courierName} | Kurye Paneli`;
    }

    const storeName = this.resolveStoreName(session.contextStoreId)?.trim();
    if (!storeName) {
      return 'Kuryon Panel';
    }
    return routeTitle ? `${routeTitle} | ${storeName}` : `${storeName} | Dukkan Paneli`;
  }

  private getDeepestRouteTitle(route: ActivatedRoute): string | null {
    let current: ActivatedRoute | null = route;
    let deepest: Data = route.snapshot.data;

    while (current?.firstChild) {
      current = current.firstChild;
      deepest = current.snapshot.data;
    }

    const title = deepest['title'];
    return typeof title === 'string' && title.trim() ? title.trim() : null;
  }

  private resolveStoreName(storeId?: string): string | null {
    if (!storeId) {
      return null;
    }
    const storeOrders = this.orderState.getOrdersForStore(storeId);
    const storeName = storeOrders.find((order) => !!order.company?.trim())?.company;
    return storeName?.trim() || null;
  }
}
