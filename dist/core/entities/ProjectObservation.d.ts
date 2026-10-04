export interface ProjectObservationProps {
    id: string;
    projectId: string;
    observedAt: Date;
    bidsCount: number;
    budgetMinUsd?: number;
    budgetMaxUsd?: number;
    budgetAvgUsd?: number;
    status: string;
    collectionRunId?: string;
}
export declare class ProjectObservation {
    readonly id: string;
    readonly projectId: string;
    readonly observedAt: Date;
    readonly bidsCount: number;
    readonly budgetMinUsd?: number;
    readonly budgetMaxUsd?: number;
    readonly budgetAvgUsd?: number;
    readonly status: string;
    readonly collectionRunId?: string;
    constructor(props: ProjectObservationProps);
}
