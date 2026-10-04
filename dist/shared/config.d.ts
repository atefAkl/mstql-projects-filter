export interface AppConfig {
    minDelayMs: number;
    maxDelayMs: number;
    historicalBackfillDays: number;
    databasePath?: string;
    mostaqlSessionCookie?: string;
    userAgent: string;
}
export declare const defaultConfig: AppConfig;
