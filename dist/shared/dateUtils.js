"use strict";
/**
/** Date and Time Utility Helpers for Riyadh Timezone (GMT+3)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RIYADH_LOCALE = exports.RIYADH_TIMEZONE = void 0;
exports.formatDateRiyadh = formatDateRiyadh;
exports.formatTimeRiyadh = formatTimeRiyadh;
exports.formatRelativeRiyadh = formatRelativeRiyadh;
exports.RIYADH_TIMEZONE = 'Asia/Riyadh';
exports.RIYADH_LOCALE = 'ar-SA';
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
    return formatDateRiyadh(d, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
//# sourceMappingURL=dateUtils.js.map