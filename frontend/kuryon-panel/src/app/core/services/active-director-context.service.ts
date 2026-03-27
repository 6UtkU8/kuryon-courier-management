import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { DirectorPermissionService } from './director-permission.service';

@Injectable({ providedIn: 'root' })
export class ActiveDirectorContextService {
  readonly activeDirectorId$;

  constructor(private readonly directorPermissions: DirectorPermissionService) {
    this.activeDirectorId$ = this.directorPermissions.currentDirector$.pipe(
      map((director) => director?.id ?? '')
    );
  }

  filterOrders<T extends { id: string }>(orders: T[], directorId: string): T[] {
    if (!directorId || orders.length <= 1) {
      return orders;
    }
    const scoped = orders.filter((order) => this.pickByHash(`${directorId}|${order.id}`));
    const alwaysVisible = orders.filter((order) => this.isPoolRelevantOrder(order));
    if (alwaysVisible.length === 0) {
      return scoped.length > 0 ? scoped : orders.slice(0, Math.max(1, Math.floor(orders.length / 2)));
    }
    const mergedById = new Map<string, T>();
    for (const order of scoped) {
      mergedById.set(order.id, order);
    }
    for (const order of alwaysVisible) {
      mergedById.set(order.id, order);
    }
    return [...mergedById.values()];
  }

  filterCouriers<T extends { id: number }>(couriers: T[], directorId: string): T[] {
    if (!directorId || couriers.length <= 1) {
      return couriers;
    }
    const scoped = couriers.filter((courier) => this.pickByHash(`${directorId}|${courier.id}`));
    return scoped.length > 0 ? scoped : couriers.slice(0, Math.max(1, Math.floor(couriers.length / 2)));
  }

  filterRowsByNumericId<T extends { id: number }>(rows: T[], directorId: string): T[] {
    if (!directorId || rows.length <= 1) {
      return rows;
    }
    const scoped = rows.filter((row) => this.pickByHash(`${directorId}|row|${row.id}`));
    return scoped.length > 0 ? scoped : rows.slice(0, Math.max(1, Math.floor(rows.length / 2)));
  }

  private pickByHash(value: string): boolean {
    return this.hash(value) % 2 === 0;
  }

  private hash(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private isPoolRelevantOrder<T extends { id: string }>(order: T): boolean {
    if (!this.hasOrderLikeShape(order)) {
      return false;
    }
    if (order.courierId !== null) {
      return false;
    }
    return order.status === 'Bekliyor' || order.status === 'Atandı' || order.status === 'Hazır Alınacak';
  }

  private hasOrderLikeShape(
    value: unknown
  ): value is { id: string; courierId: number | null; status: string } {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const row = value as { id?: unknown; courierId?: unknown; status?: unknown };
    return (
      typeof row.id === 'string' &&
      (typeof row.courierId === 'number' || row.courierId === null) &&
      typeof row.status === 'string'
    );
  }
}
