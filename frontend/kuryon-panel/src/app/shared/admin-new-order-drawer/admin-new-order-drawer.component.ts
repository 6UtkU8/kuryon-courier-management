import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AdminNewOrderDrawerService } from '../../core/services/admin-new-order-drawer.service';
import { HistoryPaymentType } from '../../core/services/courier-state.service';
import {
  CreateOrderInput,
  OrderStateService
} from '../../core/services/order-state.service';
import { PackageApiRequestError } from '../../core/services/admin-packages.service';
import { UiNoticeService } from '../../core/services/ui-notice.service';
import {
  numericRangeValidator,
  phoneValidator,
  trimmedRequiredTextValidator
} from '../../core/validators';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppSettings } from '../../core/models/app-settings.model';
import { UI_TEXTS } from '../ui/ui-texts';

@Component({
  selector: 'app-admin-new-order-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-new-order-drawer.component.html',
  styleUrls: ['./admin-new-order-drawer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminNewOrderDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  isSubmitting = false;
  errorMessage = '';
  fieldErrors: {
    company?: string;
    customer?: string;
    customerPhone?: string;
    restaurantPhone?: string;
    address?: string;
    eta?: string;
    fee?: string;
    payment?: string;
  } = {};

  form: CreateOrderInput = {
    storeId: 'genel-pool',
    company: '',
    customer: '',
    address: '',
    eta: '15 dk',
    fee: 0,
    customerPhone: '',
    restaurantPhone: '',
    deliveryNote: ''
  };

  payment: HistoryPaymentType | '' = '';

  readonly paymentOptions: HistoryPaymentType[] = [
    'Nakit',
    'Kredi Kartı',
    'Yemeksepeti Online',
    'Trendyol Online',
    'Getir Online',
    'Migros Online',
    'Diğer Online Ödeme',
    'Ücretsiz',
    'Restorana Havale',
    'Kapıda Yemek Kartı',
    'Online Yemek Kartı'
  ];

  private sub = new Subscription();
  settings: AppSettings;

  constructor(
    private readonly drawer: AdminNewOrderDrawerService,
    private readonly orderState: OrderStateService,
    private readonly appSettings: AppSettingsService,
    private readonly cdr: ChangeDetectorRef,
    private readonly uiNotice: UiNoticeService
  ) {
    this.settings = this.appSettings.getSnapshot();
  }

  ngOnInit(): void {
    this.sub.add(
      this.drawer.visible$.subscribe((visible) => {
        this.visible = visible;
        if (visible) {
          this.errorMessage = '';
          this.fieldErrors = {};
        }
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.appSettings.settings$.subscribe((settings) => {
        this.settings = settings;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.visible) {
      this.close();
    }
  }

  close(): void {
    this.drawer.requestClose();
    this.fieldErrors = {};
    this.cdr.markForCheck();
  }

  async submit(): Promise<void> {
    const f = this.form;
    this.fieldErrors = this.validateForm();
    if (Object.keys(this.fieldErrors).length > 0) {
      this.errorMessage = UI_TEXTS.common.fixFormErrors;
      this.cdr.markForCheck();
      return;
    }
    const feeNum = Number(f.fee);

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const payload: CreateOrderInput = {
        storeId: f.storeId,
        company: f.company.trim(),
        customer: f.customer.trim(),
        address: f.address.trim(),
        eta: f.eta.trim(),
        fee: feeNum,
        paymentType: this.payment || undefined,
        customerPhone: f.customerPhone?.trim() || undefined,
        restaurantPhone: f.restaurantPhone?.trim() || undefined,
        deliveryNote: f.deliveryNote?.trim() || undefined
      };
      await this.orderState.createPackageFromBackend({
        customerName: payload.customer,
        customerPhone: payload.customerPhone ?? '',
        address: payload.address,
        description: payload.deliveryNote ?? payload.company,
        paymentType: this.mapPaymentTypeForApi(this.payment),
        price: payload.fee
      });
      this.resetForm();
      this.close();
      this.uiNotice.showToast('Paket başarıyla oluşturuldu.', 'success');
    } catch (error: unknown) {
      if (error instanceof PackageApiRequestError) {
        this.errorMessage = error.message || UI_TEXTS.admin.orderSaveFailed;
      } else {
        this.errorMessage = UI_TEXTS.admin.orderSaveFailed;
      }
      this.uiNotice.showToast(this.errorMessage, 'error');
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  private mapPaymentTypeForApi(payment: HistoryPaymentType | ''): 'cash' | 'card' | 'online' {
    if (payment === 'Nakit') {
      return 'cash';
    }
    if (payment === 'Kredi Kartı') {
      return 'card';
    }
    return 'online';
  }

  private resetForm(): void {
    this.form = {
      storeId: 'genel-pool',
      company: '',
      customer: '',
      address: '',
      eta: '15 dk',
      fee: 0,
      customerPhone: '',
      restaurantPhone: '',
      deliveryNote: ''
    };
    this.payment = '';
    this.fieldErrors = {};
  }

  private validateForm(): {
    company?: string;
    customer?: string;
    customerPhone?: string;
    restaurantPhone?: string;
    address?: string;
    eta?: string;
    fee?: string;
    payment?: string;
  } {
    const f = this.form;
    const errors: {
      company?: string;
      customer?: string;
      customerPhone?: string;
      restaurantPhone?: string;
      address?: string;
      eta?: string;
      fee?: string;
      payment?: string;
    } = {};

    const companyControl = new FormControl(f.company, [trimmedRequiredTextValidator()]);
    if (companyControl.errors?.['requiredTrimmed']) {
      errors.company = UI_TEXTS.admin.companyRequired;
    }

    const customerControl = new FormControl(f.customer, [trimmedRequiredTextValidator()]);
    if (customerControl.errors?.['requiredTrimmed']) {
      errors.customer = UI_TEXTS.admin.customerRequired;
    }

    const addressControl = new FormControl(f.address, [trimmedRequiredTextValidator()]);
    if (addressControl.errors?.['requiredTrimmed']) {
      errors.address = UI_TEXTS.admin.addressRequired;
    } else if (f.address.trim().length < 10) {
      errors.address = UI_TEXTS.admin.addressMinLength;
    }

    const feeControl = new FormControl(f.fee, [numericRangeValidator(0, 100000)]);
    if (feeControl.errors?.['numericRange']) {
      errors.fee = UI_TEXTS.admin.feeRange;
    }

    const customerPhone = (f.customerPhone ?? '').trim();
    if (customerPhone) {
      const customerPhoneControl = new FormControl(customerPhone, [phoneValidator()]);
      if (customerPhoneControl.errors?.['phone']) {
        errors.customerPhone = UI_TEXTS.admin.customerPhoneInvalid;
      }
    }

    const restaurantPhone = (f.restaurantPhone ?? '').trim();
    if (this.settings.operations.restaurantPhoneRequired && !restaurantPhone) {
      errors.restaurantPhone = UI_TEXTS.admin.restaurantPhoneRequired;
    } else if (restaurantPhone) {
      const restaurantPhoneControl = new FormControl(restaurantPhone, [phoneValidator()]);
      if (restaurantPhoneControl.errors?.['phone']) {
        errors.restaurantPhone = UI_TEXTS.admin.restaurantPhoneInvalid;
      }
    }

    if (!f.eta.trim()) {
      errors.eta = UI_TEXTS.admin.etaRequired;
    }

    return errors;
  }

  trackByPaymentOption(_: number, payment: HistoryPaymentType): HistoryPaymentType {
    return payment;
  }
}
