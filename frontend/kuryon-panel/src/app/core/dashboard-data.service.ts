import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface StatItem {
  label: string;
  value: string;
  trend: string;
}

export interface PendingOrder {
  id: string;
  company: string;
  address: string;
  createdAt: string;
  eta: string;
  status: string;
}

export interface ActiveOrder {
  company: string;
  customer: string;
  courier: string;
  eta: string;
  fee: string;
  status: string;
}

export interface BreakItem {
  courier: string;
  reason: string;
  duration: string;
  request: string;
}

export interface Courier {
  id: string;
  name: string;
  status: string;
  distance: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardDataService {
  private readonly statsData: StatItem[] = [
    { label: 'Toplam Sipariş', value: '2.384', trend: '+12%' },
    { label: 'Aktif Kurye', value: '47', trend: '+5%' },
    { label: 'Ort. Teslim Süresi', value: '18 dk', trend: '-2 dk' },
    { label: 'Başarı Oranı', value: '96.4%', trend: '+1.8%' },
    { label: 'Günlük Ciro', value: '₺84.520', trend: '+9%' }
  ];

  private pendingOrdersData: PendingOrder[] = [
    {
      id: 'SP-1204',
      company: 'Burger Point',
      address: 'Mevlana Mah. Aşık Veysel Cad.',
      createdAt: '2 dk önce',
      eta: '14 dk',
      status: 'Bekliyor'
    },
    {
      id: 'SP-1205',
      company: 'Pide Konak',
      address: 'Gevher Nesibe Mah. İstasyon Cd.',
      createdAt: '4 dk önce',
      eta: '19 dk',
      status: 'Atama Bekliyor'
    },
    {
      id: 'SP-1206',
      company: 'Kahve Durağı',
      address: 'Hunat Mah. Sivas Bulvarı',
      createdAt: '6 dk önce',
      eta: '11 dk',
      status: 'Öncelikli'
    },
    {
      id: 'SP-1207',
      company: 'Tavuk Plus',
      address: 'Talas Bulvarı No:18',
      createdAt: '8 dk önce',
      eta: '17 dk',
      status: 'Bekliyor'
    }
  ];

  private activeOrdersData: ActiveOrder[] = [
    {
      company: 'Lezzet Kutusu',
      customer: 'Ayşe Demir',
      courier: 'Mert K.',
      eta: '8 dk',
      fee: '₺74',
      status: 'Yolda'
    },
    {
      company: 'Tostla',
      customer: 'Emre Aydın',
      courier: 'Can U.',
      eta: '12 dk',
      fee: '₺91',
      status: 'Teslimata Yakın'
    }
  ];

  private readonly breakListData: BreakItem[] = [
    {
      courier: 'Fatih T.',
      reason: 'Yemek Molası',
      duration: '20 dk',
      request: 'Onaylandı'
    },
    {
      courier: 'Seda Y.',
      reason: 'Kısa Mola',
      duration: '10 dk',
      request: 'Bekliyor'
    }
  ];

  private readonly availableCouriersData: Courier[] = [
    { id: 'C1', name: 'Mert K.', status: 'Müsait', distance: '1.2 km' },
    { id: 'C2', name: 'Seda Y.', status: 'Müsait', distance: '2.4 km' },
    { id: 'C3', name: 'Ahmet T.', status: 'Yoğun', distance: '0.8 km' }
  ];

  getStats(): Observable<StatItem[]> {
    return of([...this.statsData]).pipe(delay(500));
  }

  getPendingOrders(): Observable<PendingOrder[]> {
    return of([...this.pendingOrdersData]).pipe(delay(700));
  }

  getActiveOrders(): Observable<ActiveOrder[]> {
    return of([...this.activeOrdersData]).pipe(delay(800));
  }

  getBreakList(): Observable<BreakItem[]> {
    return of([...this.breakListData]).pipe(delay(900));
  }

  getAvailableCouriers(): Observable<Courier[]> {
    return of([...this.availableCouriersData]).pipe(delay(400));
  }

  assignCourierToOrder(order: PendingOrder, courier: Courier): Observable<boolean> {
    const targetOrder = this.pendingOrdersData.find((item) => item.id === order.id);

    if (!targetOrder) {
      return throwError(() => new Error('Sipariş bulunamadı.'));
    }

    if (courier.status !== 'Müsait') {
      return throwError(() => new Error('Seçilen kurye şu anda müsait değil.'));
    }

    this.pendingOrdersData = this.pendingOrdersData.filter(
      (item) => item.id !== order.id
    );

    this.activeOrdersData.unshift({
      company: order.company,
      customer: 'Yeni Müşteri',
      courier: courier.name,
      eta: order.eta,
      fee: '₺85',
      status: 'Yolda'
    });

    return of(true).pipe(delay(500));
  }
}