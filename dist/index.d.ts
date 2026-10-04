import { SqliteProjectRepository } from './infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from './infrastructure/repositories/SqliteCollectionRunRepository';
export declare class MostaqlMonitorPlatform {
    private db;
    projectRepository: SqliteProjectRepository;
    collectionRunRepository: SqliteCollectionRunRepository;
    constructor(dbPath?: string);
    close(): void;
}
