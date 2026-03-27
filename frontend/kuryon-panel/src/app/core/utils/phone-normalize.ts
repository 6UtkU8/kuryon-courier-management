/**
 * Türkiye cep numaraları için basit normalizasyon: yalnızca rakamlar,
 * +90 / baştaki 0 eksik varyasyonları tek forma indirger.
 */
export function normalizeTurkishPhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}
