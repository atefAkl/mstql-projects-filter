import { Project } from '../entities/Project';
import { ProjectObservation } from '../entities/ProjectObservation';
import { RawPayload } from '../entities/RawPayload';
export interface FindProjectsFilter {
    status?: string;
    publishedAfter?: Date;
    publishedBefore?: Date;
    limit?: number;
    offset?: number;
}
export interface IProjectRepository {
    findBySourceProjectId(sourceProjectId: string): Promise<Project | null>;
    findById(id: string): Promise<Project | null>;
    saveProject(project: Project): Promise<void>;
    saveObservation(observation: ProjectObservation): Promise<void>;
    saveRawPayload(rawPayload: RawPayload): Promise<void>;
    getObservationsByProjectId(projectId: string): Promise<ProjectObservation[]>;
    getLatestObservation(projectId: string): Promise<ProjectObservation | null>;
    findProjects(filter?: FindProjectsFilter): Promise<Project[]>;
    countProjects(filter?: FindProjectsFilter): Promise<number>;
    getLatestSuccessfulCollectionTimestamp(): Promise<Date | null>;
}
