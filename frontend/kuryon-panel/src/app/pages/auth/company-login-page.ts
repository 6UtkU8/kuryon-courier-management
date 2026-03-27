import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormControl, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { trimmedRequiredTextValidator } from '../../core/validators';
import { UI_TEXTS } from '../../shared/ui/ui-texts';

@Component({
  selector: 'app-company-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './company-login-page.html',
  styleUrls: ['./company-login-page.css']
})
export class CompanyLoginPageComponent {
  email = '';
  password = '';
  errorMessage = '';
  fieldErrors: { email?: string; password?: string } = {};

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async login(): Promise<void> {
    const email = this.readFieldValue('company-email-input', this.email);
    const password = this.readFieldValue('company-password-input', this.password);

    this.fieldErrors = this.validateFields(email, password);
    if (this.fieldErrors.email || this.fieldErrors.password) {
      this.errorMessage = UI_TEXTS.common.fixFormErrors;
      return;
    }

    const result = await this.authService.adminLogin({
      email,
      password
    });
    if (!result.ok) {
      this.errorMessage = result.errorMessage ?? UI_TEXTS.common.loginFailed;
      return;
    }

    this.errorMessage = '';
    void this.router.navigateByUrl('/dashboard');
  }

  private validateFields(email: string, password: string): { email?: string; password?: string } {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const emailControl = new FormControl(email, [trimmedRequiredTextValidator()]);
    const emailErrors = emailControl.errors;
    if (emailErrors?.['requiredTrimmed']) {
      errors.email = 'E-posta zorunludur.';
    } else if (!emailRegex.test(email.trim().toLowerCase())) {
      errors.email = UI_TEXTS.auth.validEmail;
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
