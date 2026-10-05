import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
export interface BackfillResult {
    processedCount: number;
    successCount: number;
    failedCount: number;
}
export declare class BackfillIncompleteProjectsUseCase {
    private readonly projectRepo;
    private readonly collector;
    constructor(projectRepo: IProjectRepository, collector: ICollectorAdapter);
    execute(): Promise<BackfillResult>;
}
