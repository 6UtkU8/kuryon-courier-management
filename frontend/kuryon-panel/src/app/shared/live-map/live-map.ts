import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import * as L from 'leaflet/dist/leaflet-src.esm.js';
import { CourierStatus } from '../../core/services/courier-state.service';

type LiveMapCourierItem = {
  id: number;
  name: string;
  status: CourierStatus;
  lat: number;
  lng: number;
};

type LiveMapOrderStatus = 'Bekliyor' | 'Yolda' | 'Teslim Edilecek' | 'Teslim Edildi';

type LiveMapOrderItem = {
  id: string;
  company: string;
  address: string;
  status: LiveMapOrderStatus;
  courierId?: number | null;
  lat: number;
  lng: number;
};

type MarkerKind = 'courier' | 'active-courier' | 'order-point' | 'delivered-point';
type PopupInfoLine = { label: string; value: string };

type MarkerRenderModel = {
  key: string;
  kind: MarkerKind;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  infoRows: PopupInfoLine[];
  courierId?: number;
};

type RouteRenderModel = {
  id: string;
  courierId: number;
  toLat: number;
  toLng: number;
};

type MarkerBucket = 'courier' | 'order';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-map.html',
  styleUrls: ['./live-map.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() couriers: LiveMapCourierItem[] = [];
  @Input() orders: LiveMapOrderItem[] = [];

  private map: L.Map | null = null;
  private courierMarkers = L.layerGroup();
  private orderMarkers = L.layerGroup();
  private routeLayer = L.layerGroup();
  private sizeRafId: number | null = null;
  private fitOnceDone = false;
  private selectedMarkerKey: string | null = null;
  private selectedMarker: L.Marker | null = null;

  private markerIndex = new Map<string, L.Marker>();
  private markerHashIndex = new Map<string, string>();
  private markerBucketIndex = new Map<string, MarkerBucket>();
  private routeIndex = new Map<string, L.Polyline>();

  private readonly markerMetrics = {
    desktopSize: 34,
    mobileSize: 28
  };

  private readonly mapConfig = {
    center: [38.7225, 35.4875] as [number, number],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
    fitPadding: [34, 34] as [number, number],
    fitMaxZoom: 14
  };

  private lastCouriersSignature = '';
  private lastOrdersSignature = '';

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }

    if (changes['couriers'] || changes['orders']) {
      this.renderMarkers();
    }
  }

  ngOnDestroy(): void {
    if (this.sizeRafId !== null) {
      cancelAnimationFrame(this.sizeRafId);
      this.sizeRafId = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initializeMap(): void {
    if (this.map) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.mapConfig.center,
      zoom: this.mapConfig.zoom,
      zoomControl: true,
      minZoom: this.mapConfig.minZoom,
      maxZoom: this.mapConfig.maxZoom,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.courierMarkers.addTo(this.map);
    this.orderMarkers.addTo(this.map);
    this.routeLayer.addTo(this.map);

    this.renderMarkers();

    this.scheduleMapResize();
  }

  private renderMarkers(): void {
    if (!this.map) {
      return;
    }

    const nextCouriersSignature = this.couriers
      .map((courier) => `${courier.id}:${courier.status}:${courier.lat}:${courier.lng}`)
      .join('|');
    const nextOrdersSignature = this.orders
      .map((order) => `${order.id}:${order.status}:${order.lat}:${order.lng}`)
      .join('|');
    if (
      nextCouriersSignature === this.lastCouriersSignature &&
      nextOrdersSignature === this.lastOrdersSignature
    ) {
      return;
    }
    this.lastCouriersSignature = nextCouriersSignature;
    this.lastOrdersSignature = nextOrdersSignature;

    const markerModels = this.buildMarkerModels();
    this.upsertMarkers(markerModels);
    this.upsertRoutes();
    this.fitMapToLiveBounds(markerModels);

    this.scheduleMapResize();
  }

  private scheduleMapResize(): void {
    if (this.sizeRafId !== null) {
      cancelAnimationFrame(this.sizeRafId);
    }
    this.sizeRafId = requestAnimationFrame(() => {
      this.map?.invalidateSize();
      this.sizeRafId = null;
    });
  }

  private buildMarkerModels(): MarkerRenderModel[] {
    const models: MarkerRenderModel[] = [];
    const activeCourierIds = new Set<number>();
    this.orders.forEach((order) => {
      if ((order.status === 'Yolda' || order.status === 'Teslim Edilecek') && typeof order.courierId === 'number') {
        activeCourierIds.add(order.courierId);
      }
    });

    for (const courier of this.couriers) {
      const isActive = activeCourierIds.has(courier.id);
      models.push({
        key: `courier:${courier.id}`,
        kind: isActive ? 'active-courier' : 'courier',
        lat: courier.lat,
        lng: courier.lng,
        title: courier.name,
        subtitle: isActive ? 'Aktif Kurye' : 'Kurye',
        infoRows: [
          { label: 'Durum', value: courier.status },
          { label: 'Aktif Sipariş', value: isActive ? 'Var' : 'Yok' },
          { label: 'Son Güncelleme', value: 'Canlı' }
        ],
        courierId: courier.id
      });
    }

    for (const order of this.orders) {
      models.push({
        key: `order:${order.id}`,
        kind: order.status === 'Teslim Edildi' ? 'delivered-point' : 'order-point',
        lat: order.lat,
        lng: order.lng,
        title: order.company,
        subtitle: order.id,
        infoRows: [
          { label: 'Durum', value: order.status },
          { label: 'Adres', value: order.address },
          { label: 'Mesafe', value: this.buildDistanceLabel(order.lat, order.lng) }
        ],
        courierId: typeof order.courierId === 'number' ? order.courierId : undefined
      });
    }

    return models;
  }

  private upsertMarkers(models: MarkerRenderModel[]): void {
    const nextKeys = new Set(models.map((model) => model.key));

    for (const [key, marker] of this.markerIndex.entries()) {
      if (nextKeys.has(key)) {
        continue;
      }
      this.courierMarkers.removeLayer(marker);
      this.orderMarkers.removeLayer(marker);
      this.markerIndex.delete(key);
      this.markerHashIndex.delete(key);
      this.markerBucketIndex.delete(key);
      if (this.selectedMarkerKey === key) {
        this.selectedMarkerKey = null;
        this.selectedMarker = null;
      }
    }

    for (const model of models) {
      const markerHash = this.getModelHash(model);
      const existingHash = this.markerHashIndex.get(model.key);
      const existingMarker = this.markerIndex.get(model.key);

      if (existingMarker && existingHash === markerHash) {
        continue;
      }

      if (existingMarker) {
        this.courierMarkers.removeLayer(existingMarker);
        this.orderMarkers.removeLayer(existingMarker);
      }

      const marker = this.createMarker(model);
      const bucket: MarkerBucket = model.key.startsWith('courier:') ? 'courier' : 'order';
      if (bucket === 'courier') {
        marker.addTo(this.courierMarkers);
      } else {
        marker.addTo(this.orderMarkers);
      }

      this.markerIndex.set(model.key, marker);
      this.markerHashIndex.set(model.key, markerHash);
      this.markerBucketIndex.set(model.key, bucket);
      if (this.selectedMarkerKey === model.key) {
        this.selectedMarker = marker;
        this.applySelectedMarkerStyle(marker);
      }
    }

  }

  private upsertRoutes(): void {
    const routes = this.buildRoutes();
    const nextRouteIds = new Set(routes.map((route) => route.id));

    for (const [routeId, line] of this.routeIndex.entries()) {
      if (nextRouteIds.has(routeId)) {
        continue;
      }
      this.routeLayer.removeLayer(line);
      this.routeIndex.delete(routeId);
    }

    for (const route of routes) {
      const courier = this.couriers.find((item) => item.id === route.courierId);
      if (!courier) {
        continue;
      }
      const latLngs: L.LatLngExpression[] = [
        [courier.lat, courier.lng],
        [route.toLat, route.toLng]
      ];
      const existing = this.routeIndex.get(route.id);
      if (existing) {
        existing.setLatLngs(latLngs);
        continue;
      }
      const line = L.polyline(latLngs, {
        color: '#7c9cff',
        weight: 3,
        opacity: 0.62,
        lineCap: 'round',
        dashArray: '8 8'
      });
      line.addTo(this.routeLayer);
      this.routeIndex.set(route.id, line);
    }
  }

  private buildRoutes(): RouteRenderModel[] {
    const routes: RouteRenderModel[] = [];
    const courierActiveTarget = new Map<number, LiveMapOrderItem>();
    for (const order of this.orders) {
      if ((order.status !== 'Yolda' && order.status !== 'Teslim Edilecek') || typeof order.courierId !== 'number') {
        continue;
      }
      if (!courierActiveTarget.has(order.courierId)) {
        courierActiveTarget.set(order.courierId, order);
      }
    }
    for (const [courierId, order] of courierActiveTarget.entries()) {
      routes.push({
        id: `route:${courierId}:${order.id}`,
        courierId,
        toLat: order.lat,
        toLng: order.lng
      });
    }
    return routes;
  }

  private createMarker(model: MarkerRenderModel): L.Marker {
    const marker = L.marker([model.lat, model.lng], {
      icon: this.createMarkerIcon(model.kind),
      title: model.title,
      keyboard: true,
      riseOnHover: true
    });

    marker.bindPopup(this.buildPopupContent(model), {
      className: 'live-map-popup',
      closeButton: false,
      autoPanPadding: [18, 18]
    });

    marker.on('click', () => {
      this.setSelectedMarker(model.key, marker);
      this.centerMarker(marker);
    });

    marker.on('popupopen', () => {
      this.setSelectedMarker(model.key, marker);
    });

    marker.on('popupclose', () => {
      if (this.selectedMarkerKey === model.key) {
        this.clearSelectedMarker();
      }
    });

    return marker;
  }

  private setSelectedMarker(markerKey: string, marker: L.Marker): void {
    if (this.selectedMarker && this.selectedMarker !== marker) {
      this.removeSelectedMarkerStyle(this.selectedMarker);
    }
    this.selectedMarkerKey = markerKey;
    this.selectedMarker = marker;
    this.applySelectedMarkerStyle(marker);
  }

  private clearSelectedMarker(): void {
    if (this.selectedMarker) {
      this.removeSelectedMarkerStyle(this.selectedMarker);
    }
    this.selectedMarker = null;
    this.selectedMarkerKey = null;
  }

  private applySelectedMarkerStyle(marker: L.Marker): void {
    const element = marker.getElement();
    if (!element) {
      return;
    }
    element.classList.add('is-selected');
  }

  private removeSelectedMarkerStyle(marker: L.Marker): void {
    const element = marker.getElement();
    if (!element) {
      return;
    }
    element.classList.remove('is-selected');
  }

  private centerMarker(marker: L.Marker): void {
    if (!this.map) {
      return;
    }
    this.map.panTo(marker.getLatLng(), {
      animate: true,
      duration: 0.35
    });
  }

  private fitMapToLiveBounds(models: MarkerRenderModel[]): void {
    if (!this.map || this.fitOnceDone || models.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(models.map((model) => [model.lat, model.lng] as [number, number]));
    this.map.fitBounds(bounds, {
      padding: this.mapConfig.fitPadding,
      maxZoom: this.mapConfig.fitMaxZoom
    });
    this.fitOnceDone = true;
  }

  private createMarkerIcon(kind: MarkerKind): L.DivIcon {
    const size = this.isMobileViewport() ? this.markerMetrics.mobileSize : this.markerMetrics.desktopSize;
    const html = `
      <span class="live-map-marker live-map-marker--${kind}">
        <span class="live-map-marker__dot"></span>
        <span class="live-map-marker__pulse"></span>
      </span>
    `;
    return L.divIcon({
      html,
      className: 'live-map-marker-wrap',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, Math.round(size * -0.54)]
    });
  }

  private buildPopupContent(model: MarkerRenderModel): string {
    const rows = model.infoRows
      .map((row) => `<div class="live-map-popup__row"><span>${row.label}</span><strong>${row.value}</strong></div>`)
      .join('');
    return `
      <article class="live-map-popup-card">
        <header class="live-map-popup__header">
          <strong>${model.title}</strong>
          <span>${model.subtitle}</span>
        </header>
        <section class="live-map-popup__body">${rows}</section>
      </article>
    `;
  }

  private getModelHash(model: MarkerRenderModel): string {
    return [
      model.kind,
      model.lat.toFixed(6),
      model.lng.toFixed(6),
      model.title,
      model.subtitle,
      model.infoRows.map((row) => `${row.label}:${row.value}`).join(',')
    ].join('|');
  }

  private buildDistanceLabel(lat: number, lng: number): string {
    const centerLat = this.mapConfig.center[0];
    const centerLng = this.mapConfig.center[1];
    const roughDistance = Math.hypot((lat - centerLat) * 111, (lng - centerLng) * 85);
    return `${roughDistance.toFixed(1)} km`;
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  }

}