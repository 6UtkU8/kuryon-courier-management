import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { normalizeTurkishPhoneDigits } from '../utils/phone-normalize';

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const IBAN_BASIC_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]+$/;

function toStringValue(control: AbstractControl): string {
  const raw = control.value;
  if (raw == null) {
    return '';
  }
  return String(raw);
}

function normalizePhoneForValidation(value: string): string {
  const digits = normalizeTurkishPhoneDigits(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

function isValidTrPhoneDigits(digits10: string): boolean {
  // 5xxxxxxxxx => mobile, 2/3/4xxxxxxxxx => landline
  return /^(5|[234])\d{9}$/.test(digits10);
}

function mod97(iban: string): number {
  let remainder = 0;
  for (const ch of iban) {
    const code = ch.charCodeAt(0);
    const numeric = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder;
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!TIME_24H_REGEX.test(trimmed)) {
    return null;
  }
  const [hourPart, minutePart] = trimmed.split(':');
  return Number(hourPart) * 60 + Number(minutePart);
}

/**
 * TR telefon doğrulaması:
 * - Mobil ve sabit hatı destekler.
 * - Boş değerler için hata döndürmez (zorunluluk ayrı validator ile verilmeli).
 */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = toStringValue(control).trim();
    if (!value) {
      return null;
    }

    const digits = normalizePhoneForValidation(value);
    if (digits.length !== 10 || !isValidTrPhoneDigits(digits)) {
      return { phone: { reason: 'invalid_format' } };
    }
    return null;
  };
}

/**
 * TR IBAN doğrulaması:
 * - "TR" ile başlamalı, toplam 26 karakter olmalı.
 * - MOD-97 checksum kontrolü yapar.
 * - Boş değerler için hata döndürmez (zorunluluk ayrı validator ile verilmeli).
 */
export function ibanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = toStringValue(control).replace(/\s+/g, '').toUpperCase();
    if (!value) {
      return null;
    }

    if (!value.startsWith('TR') || value.length !== 26 || !IBAN_BASIC_REGEX.test(value)) {
      return { iban: { reason: 'invalid_format' } };
    }

    const rearranged = `${value.slice(4)}${value.slice(0, 4)}`;
    if (mod97(rearranged) !== 1) {
      return { iban: { reason: 'checksum_failed' } };
    }
    return null;
  };
}

/**
 * trim sonrası en az 1 karakter zorunluluğu.
 */
export function trimmedRequiredTextValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = toStringValue(control).trim();
    return value.length > 0 ? null : { requiredTrimmed: true };
  };
}

/**
 * Sayısal aralık validator'ı.
 * `min` ve/veya `max` opsiyonel verilebilir.
 */
export function numericRangeValidator(min?: number, max?: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = toStringValue(control).trim();
    if (!value) {
      return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return { numericRange: { reason: 'not_a_number', min, max } };
    }

    if (min != null && numeric < min) {
      return { numericRange: { reason: 'min', min, actual: numeric } };
    }
    if (max != null && numeric > max) {
      return { numericRange: { reason: 'max', max, actual: numeric } };
    }
    return null;
  };
}

/**
 * FormGroup seviyesinde saat aralığı doğrulaması.
 * Varsayılan: başlangıç < bitiş olmalı.
 */
export function timeRangeValidator(
  startControlName: string,
  endControlName: string,
  allowEqual = false
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const startControl = group.get(startControlName);
    const endControl = group.get(endControlName);

    if (!startControl || !endControl) {
      return null;
    }

    const startRaw = toStringValue(startControl).trim();
    const endRaw = toStringValue(endControl).trim();

    if (!startRaw || !endRaw) {
      return null;
    }

    const startMinutes = parseTimeToMinutes(startRaw);
    const endMinutes = parseTimeToMinutes(endRaw);
    if (startMinutes == null || endMinutes == null) {
      return { timeRange: { reason: 'invalid_time_format' } };
    }

    const valid = allowEqual ? startMinutes <= endMinutes : startMinutes < endMinutes;
    return valid
      ? null
      : {
          timeRange: {
            reason: allowEqual ? 'start_after_end' : 'start_not_before_end',
            start: startRaw,
            end: endRaw
          }
        };
  };
}
