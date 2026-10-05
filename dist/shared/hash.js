"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHash = computeHash;
exports.computeNormalizedHash = computeNormalizedHash;
const crypto_1 = __importDefault(require("crypto"));
function computeHash(data) {
    return crypto_1.default.createHash('sha256').update(data, 'utf8').digest('hex');
}
function computeNormalizedHash(item) {
    const normalizedObject = {
        title: item.title ? item.title.trim() : '',
        descriptionRaw: item.descriptionRaw ? item.descriptionRaw.trim() : '',
        budgetMinUsd: item.budgetMinUsd ?? null,
        budgetMaxUsd: item.budgetMaxUsd ?? null,
        bidsCountParsed: item.bidsCountParsed ?? 0,
        executionDaysParsed: item.executionDaysParsed ?? null,
        clientNameRaw: item.clientNameRaw ? item.clientNameRaw.trim() : null,
        statusRaw: item.statusRaw ? item.statusRaw.trim() : 'مفتوح',
        skillsTagsRaw: Array.isArray(item.skillsTagsRaw) ? [...item.skillsTagsRaw].sort() : [],
    };
    return computeHash(JSON.stringify(normalizedObject));
}
//# sourceMappingURL=hash.js.map