/**
/** Date and Time Utility Helpers for Riyadh Timezone (GMT+3)
 */

export const RIYADH_TIMEZONE = 'Asia/Riyadh';
export const RIYADH_LOCALE = 'ar-SA';

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
    ...options,
  };

  return new Intl.DateTimeFormat(RIYADH_LOCALE, defaultOpts).format(d);
}

export function formatRelativeRiyadh(date?: string | Date | null): string {
  if (!date) return 'غير محدد';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'غير محدد';

  return formatDateRiyadh(d, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
