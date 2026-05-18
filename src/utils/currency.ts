// Currency formatting utilities

export const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'TZS';

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const locale = currency === 'TZS' ? 'en-TZ' : 'en-US';
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Handle TZS specially since it's not in all Intl locales
  if (currency === 'TZS') {
    return `TZS ${Math.round(amount).toLocaleString('en-TZ')}`;
  }

  return formatter.format(amount);
}

export function formatNumber(number: number): string {
  return number.toLocaleString('en-TZ');
}

export function parseCurrencyInput(value: string): number {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseDateParts(date: string | Date): { day: number; month: number; year: number } | null {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }

  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      day: Number(isoMatch[3]),
      month: Number(isoMatch[2]),
      year: Number(isoMatch[1]),
    };
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
}

export function formatDate(date: string | Date): string {
  const parts = parseDateParts(date);
  if (!parts) return '';

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formattedDate = formatDate(d);
  const formattedTime = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return formattedDate ? `${formattedDate}, ${formattedTime}` : '';
}

export function formatDateInputValue(value: string): string {
  return value ? formatDate(value) : '';
}

export function formatDateInputText(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('/');
}

export function parseDateInputToISO(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return '';

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
