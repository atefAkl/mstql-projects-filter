"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MostaqlNetworkError = exports.MostaqlParsingError = exports.MostaqlAuthError = void 0;
class MostaqlAuthError extends Error {
    constructor(message = 'Authentication required or session expired for Mostaql') {
        super(message);
        this.name = 'MostaqlAuthError';
    }
}
exports.MostaqlAuthError = MostaqlAuthError;
class MostaqlParsingError extends Error {
    rawHtmlSnippet;
    constructor(message, rawHtmlSnippet) {
        super(message);
        this.rawHtmlSnippet = rawHtmlSnippet;
        this.name = 'MostaqlParsingError';
    }
}
exports.MostaqlParsingError = MostaqlParsingError;
class MostaqlNetworkError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'MostaqlNetworkError';
    }
}
exports.MostaqlNetworkError = MostaqlNetworkError;
//# sourceMappingURL=errors.js.map