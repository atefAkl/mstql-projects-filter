/**
 * Date and Time Utility Helpers for Riyadh Timezone (Asia/Riyadh - GMT+3)
 */

export const RIYADH_TIMEZONE = 'Asia/Riyadh';
export const RIYADH_LOCALE = 'ar-EG'; // Standard Arabic with Gregorian calendar

export function formatDateRiyadh(
  date?: string | Date | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'غير محدد';

  const defaultOpts: Intl.DateTimeFormatOptions = {
    timeZone: RIYADH_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat(RIYADH_LOCALE, defaultOpts).format(d);
}

export function formatTimeRiyadh(
  date?: string | Date | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'غير محدد';

  const defaultOpts: Intl.DateTimeFormatOptions = {
    timeZone: RIYADH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat(RIYADH_LOCALE, defaultOpts).format(d);
}

export function formatRelativeRiyadh(date?: string | Date | null): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'غير محدد';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (3600 * 1000));
  const diffDays = Math.floor(diffMs / (86400 * 1000));

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 30) return `منذ ${diffDays} يوم`;

  return formatDateRiyadh(d);
}
