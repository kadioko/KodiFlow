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
    return `TZS ${amount.toLocaleString('en-TZ')}`;
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

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
