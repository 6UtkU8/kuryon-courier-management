import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  phoneValidator,
  trimmedRequiredTextValidator
} from '../../core/validators';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Component({
  selector: 'app-store-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './store-login-page.html',
  styleUrls: ['./store-login-page.css']
})
export class StoreLoginPageComponent {
  phone = '';
  password = '';
  errorMessage = '';
  fieldErrors: { phone?: string; password?: string } = {};

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async login(): Promise<void> {
    const phone = this.readFieldValue('store-phone-input', this.phone);
    const password = this.readFieldValue('store-password-input', this.password);

    this.fieldErrors = this.validateFields(phone, password);
    if (this.fieldErrors.phone || this.fieldErrors.password) {
      this.errorMessage = UI_TEXTS.common.fixFormErrors;
      return;
    }

    const result = await this.authService.loginWithCredentials('store', phone, password);
    if (!result.ok) {
      this.errorMessage = result.errorMessage ?? UI_TEXTS.common.loginFailed;
      return;
    }

    this.errorMessage = '';
    void this.router.navigateByUrl('/store-panel');
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
