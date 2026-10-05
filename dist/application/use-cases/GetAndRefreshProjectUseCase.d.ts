import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { MostaqlHtmlCollectorAdapter } from '../../infrastructure/collectors/MostaqlHtmlCollectorAdapter';
export interface RefreshProjectOptions {
    sourceProjectId: string;
    forceRefresh?: boolean;
}
export interface RefreshProjectResult {
    project: Project;
    observations: ProjectObservation[];
    rawPayload?: RawPayload;
    refreshStatus: 'created_from_source' | 'local_cached' | 'success_unchanged' | 'success_updated' | 'auth_failed' | 'network_failed' | 'parsing_failed';
    errorMessage?: string;
    isNew: boolean;
}
export declare class GetAndRefreshProjectUseCase {
    private readonly projectRepo;
    private readonly collector;
    constructor(projectRepo: IProjectRepository, collector: MostaqlHtmlCollectorAdapter);
    execute(options: RefreshProjectOptions): Promise<RefreshProjectResult>;
}
