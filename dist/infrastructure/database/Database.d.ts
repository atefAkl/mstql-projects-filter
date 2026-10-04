import Database from 'better-sqlite3';
export declare class AppDatabase {
    private db;
    constructor(dbPath?: string);
    getRawConnection(): Database.Database;
    runMigrations(): void;
    close(): void;
}
