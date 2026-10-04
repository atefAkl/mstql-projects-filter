import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
export interface ProcessItemResult {
    isNew: boolean;
    projectId: string;
    observationId: string;
}
export declare class ProcessCollectionItemUseCase {
    private readonly projectRepository;
    constructor(projectRepository: IProjectRepository);
    execute(item: ParsedProjectItem, collectionRunId?: string): Promise<ProcessItemResult>;
}
