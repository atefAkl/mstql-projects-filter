import Database from 'better-sqlite3';
import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import { FindProjectsFilter, IProjectRepository } from '../../core/interfaces/IProjectRepository';
export declare class SqliteProjectRepository implements IProjectRepository {
    private readonly db;
    constructor(db: Database.Database);
    findBySourceProjectId(sourceProjectId: string): Promise<Project | null>;
    findById(id: string): Promise<Project | null>;
    saveProject(project: Project): Promise<void>;
    saveObservation(observation: ProjectObservation): Promise<void>;
    saveRawPayload(rawPayload: RawPayload): Promise<void>;
    getObservationsByProjectId(projectId: string): Promise<ProjectObservation[]>;
    getLatestObservation(projectId: string): Promise<ProjectObservation | null>;
    getLatestRawPayloadByProjectId(projectId: string): Promise<RawPayload | null>;
    findProjects(filter?: FindProjectsFilter): Promise<Project[]>;
    countProjects(filter?: FindProjectsFilter): Promise<number>;
    getLatestSuccessfulCollectionTimestamp(): Promise<Date | null>;
}
