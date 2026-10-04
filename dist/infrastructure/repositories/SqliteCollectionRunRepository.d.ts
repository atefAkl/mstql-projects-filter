import Database from 'better-sqlite3';
import { CollectionRun } from '../../core/entities/CollectionRun';
import { ICollectionRunRepository } from '../../core/interfaces/ICollectionRunRepository';
export declare class SqliteCollectionRunRepository implements ICollectionRunRepository {
    private readonly db;
    constructor(db: Database.Database);
    findById(id: string): Promise<CollectionRun | null>;
    save(run: CollectionRun): Promise<void>;
    update(run: CollectionRun): Promise<void>;
    getLatestCompletedRun(): Promise<CollectionRun | null>;
    getLatestInterruptedRun(): Promise<CollectionRun | null>;
    listRuns(limit?: number, offset?: number): Promise<CollectionRun[]>;
}
