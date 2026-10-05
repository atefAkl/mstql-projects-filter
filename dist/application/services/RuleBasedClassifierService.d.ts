import Database from 'better-sqlite3';
import { Project } from '../../core/entities/Project';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
export declare class RuleBasedClassifierService {
    private readonly taxonomyRepo;
    private readonly db;
    private normalizer;
    constructor(taxonomyRepo: ITaxonomyRepository, db: Database.Database);
    classifyProject(project: Project, skillsTags?: string[], clientName?: string): Promise<void>;
}
