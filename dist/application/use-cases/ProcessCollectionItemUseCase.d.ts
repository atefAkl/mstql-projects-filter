import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
import Database from 'better-sqlite3';
export interface ProcessItemResult {
    isNew: boolean;
    projectId: string;
    observationId: string;
}
export declare class ProcessCollectionItemUseCase {
    private readonly projectRepository;
    private readonly taxonomyRepository?;
    private readonly db?;
    constructor(projectRepository: IProjectRepository, taxonomyRepository?: ITaxonomyRepository | undefined, db?: Database.Database | undefined);
    execute(item: ParsedProjectItem, collectionRunId?: string): Promise<ProcessItemResult>;
}
