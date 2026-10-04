"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.defaultConfig = {
    minDelayMs: parseInt(process.env.MIN_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '2500', 10),
    historicalBackfillDays: parseInt(process.env.HISTORICAL_BACKFILL_DAYS || '30', 10),
    databasePath: process.env.DATABASE_PATH,
    mostaqlSessionCookie: process.env.MOSTAQL_SESSION_COOKIE,
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
//# sourceMappingURL=config.js.map