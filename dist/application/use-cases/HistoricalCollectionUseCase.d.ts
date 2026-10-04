import { CollectionRun } from '../../core/entities/CollectionRun';
import { ICollectionRunRepository } from '../../core/interfaces/ICollectionRunRepository';
import { ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
import { ProcessCollectionItemUseCase } from './ProcessCollectionItemUseCase';
export interface HistoricalCollectionOptions {
    daysToBackfill?: number;
    resumeRunId?: string;
    enrichDetails?: boolean;
}
export interface HistoricalCollectionResult {
    run: CollectionRun;
    reachedCutoff: boolean;
}
export declare class HistoricalCollectionUseCase {
    private readonly collector;
    private readonly collectionRunRepo;
    private readonly processItemUseCase;
    constructor(collector: ICollectorAdapter, collectionRunRepo: ICollectionRunRepository, processItemUseCase: ProcessCollectionItemUseCase);
    execute(options?: HistoricalCollectionOptions): Promise<HistoricalCollectionResult>;
}
