export type CollectionRunType = 'historical' | 'daily' | 'manual';
export type CollectionRunStatus = 'running' | 'completed' | 'failed' | 'interrupted';
export interface CollectionRunProps {
    id: string;
    type: CollectionRunType;
    status: CollectionRunStatus;
    startedAt: Date;
    finishedAt?: Date;
    pagesProcessed: number;
    projectsFound: number;
    newProjectsCount: number;
    duplicateProjectsCount: number;
    observationsCreated: number;
    lastProcessedPage?: number;
    lastProcessedProjectId?: string;
    cutoffDate?: Date;
    errorCount: number;
    errorLog?: string;
}
export declare class CollectionRun {
    readonly id: string;
    readonly type: CollectionRunType;
    status: CollectionRunStatus;
    readonly startedAt: Date;
    finishedAt?: Date;
    pagesProcessed: number;
    projectsFound: number;
    newProjectsCount: number;
    duplicateProjectsCount: number;
    observationsCreated: number;
    lastProcessedPage?: number;
    lastProcessedProjectId?: string;
    cutoffDate?: Date;
    errorCount: number;
    errorLog?: string;
    constructor(props: CollectionRunProps);
    incrementPages(): void;
    setProgress(pageNumber: number, projectId?: string): void;
    recordNewProject(): void;
    recordDuplicateProject(): void;
    recordError(message: string): void;
    markCompleted(): void;
    markInterrupted(reason: string): void;
    markFailed(errorReason: string): void;
}
