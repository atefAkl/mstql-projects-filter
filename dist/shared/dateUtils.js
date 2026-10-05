"use strict";
/**
 * Date and Time Utility Helpers for Riyadh Timezone (Asia/Riyadh - GMT+3)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIYADH_LOCALE = exports.RIYADH_TIMEZONE = void 0;
exports.formatDateRiyadh = formatDateRiyadh;
exports.formatTimeRiyadh = formatTimeRiyadh;
exports.formatRelativeRiyadh = formatRelativeRiyadh;
exports.RIYADH_TIMEZONE = 'Asia/Riyadh';
exports.RIYADH_LOCALE = 'ar-EG'; // Standard Arabic with Gregorian calendar
function formatDateRiyadh(date, options = {}) {
    if (!date)
        return 'غير محدد';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime()))
        return 'غير محدد';
    const defaultOpts = {
        timeZone: exports.RIYADH_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options,
    };
    return new Intl.DateTimeFormat(exports.RIYADH_LOCALE, defaultOpts).format(d);
}
function formatTimeRiyadh(date, options = {}) {
    if (!date)
        return 'غير محدد';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime()))
        return 'غير محدد';
    const defaultOpts = {
        timeZone: exports.RIYADH_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        ...options,
    };
    return new Intl.DateTimeFormat(exports.RIYADH_LOCALE, defaultOpts).format(d);
}
function formatRelativeRiyadh(date) {
    if (!date)
        return 'غير محدد';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime()))
        return 'غير محدد';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (3600 * 1000));
    const diffDays = Math.floor(diffMs / (86400 * 1000));
    if (diffMins < 1)
        return 'الآن';
    if (diffMins < 60)
        return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24)
        return `منذ ${diffHours} ساعة`;
    if (diffDays < 30)
        return `منذ ${diffDays} يوم`;
    return formatDateRiyadh(d);
}
//# sourceMappingURL=dateUtils.js.map