import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  minDelayMs: number;
  maxDelayMs: number;
  historicalBackfillDays: number;
  databasePath?: string;
  mostaqlSessionCookie?: string;
  userAgent: string;
}

export const defaultConfig: AppConfig = {
  minDelayMs: parseInt(process.env.MIN_DELAY_MS || '1000', 10),
  maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '2500', 10),
  historicalBackfillDays: parseInt(process.env.HISTORICAL_BACKFILL_DAYS || '30', 10),
  databasePath: process.env.DATABASE_PATH,
  mostaqlSessionCookie: process.env.MOSTAQL_SESSION_COOKIE,
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
