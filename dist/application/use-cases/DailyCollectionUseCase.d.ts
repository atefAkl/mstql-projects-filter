import { CollectionRun } from '../../core/entities/CollectionRun';
import { ICollectionRunRepository } from '../../core/interfaces/ICollectionRunRepository';
import { ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { ProcessCollectionItemUseCase } from './ProcessCollectionItemUseCase';
export interface DailyCollectionResult {
    run: CollectionRun;
    newProjectsCount: number;
    duplicateProjectsCount: number;
    reachedBoundary: boolean;
}
export declare class DailyCollectionUseCase {
    private readonly collector;
    private readonly projectRepo;
    private readonly runRepo;
    private readonly processItemUseCase;
    private static isRunningLock;
    constructor(collector: ICollectorAdapter, projectRepo: IProjectRepository, runRepo: ICollectionRunRepository, processItemUseCase: ProcessCollectionItemUseCase);
    execute(manualTrigger?: boolean): Promise<DailyCollectionResult>;
    static isRunning(): boolean;
}
