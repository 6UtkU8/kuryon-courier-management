import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CourierStateService } from '../../core/services/courier-state.service';
import {
  phoneValidator,
  trimmedRequiredTextValidator
} from '../../core/validators';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Component({
  selector: 'app-courier-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './courier-login-page.html',
  styleUrls: ['./courier-login-page.css']
})
export class CourierLoginPageComponent {
  phone = '';
  password = '';
  errorMessage = '';
  fieldErrors: { phone?: string; password?: string } = {};

  constructor(
    private readonly authService: AuthService,
    private readonly courierState: CourierStateService,
    private readonly router: Router
  ) {}

  async login(): Promise<void> {
    const phone = this.readFieldValue('courier-phone-input', this.phone);
    const password = this.readFieldValue('courier-password-input', this.password);

    this.fieldErrors = this.validateFields(phone, password);
    if (this.fieldErrors.phone || this.fieldErrors.password) {
      this.errorMessage = UI_TEXTS.common.fixFormErrors;
      return;
    }

    const result = await this.authService.courierLogin({
      phoneNumber: phone,
      password
    });
    if (!result.ok) {
      this.errorMessage = result.errorMessage ?? UI_TEXTS.common.loginFailed;
      return;
    }

    const courierId = this.courierState.findCourierIdByPhone(phone);
    if (!courierId) {
      this.errorMessage = UI_TEXTS.auth.courierNotFound;
      return;
    }

    this.errorMessage = '';
    this.courierState.setCurrentCourierId(courierId);
    void this.router.navigateByUrl('/courier-panel');
  }

  private validateFields(phone: string, password: string): { phone?: string; password?: string } {
    const errors: { phone?: string; password?: string } = {};

    const phoneControl = new FormControl(phone, [trimmedRequiredTextValidator(), phoneValidator()]);
    const phoneErrors = phoneControl.errors;
    if (phoneErrors?.['requiredTrimmed']) {
      errors.phone = UI_TEXTS.auth.phoneRequired;
    } else if (phoneErrors?.['phone']) {
      errors.phone = UI_TEXTS.auth.validPhone;
    }

    const passwordControl = new FormControl(password, [trimmedRequiredTextValidator()]);
    const passwordErrors = passwordControl.errors;
    if (passwordErrors?.['requiredTrimmed']) {
      errors.password = UI_TEXTS.auth.passwordRequired;
    } else if (password.trim().length < 6) {
      errors.password = UI_TEXTS.auth.passwordMinLength;
    }

    return errors;
  }

  private readFieldValue(id: string, modelFallback: string): string {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return (el?.value ?? modelFallback).trim();
  }
}
