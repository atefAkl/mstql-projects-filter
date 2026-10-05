import { Project } from '../entities/Project';
import { ProjectObservation } from '../entities/ProjectObservation';
import { RawPayload } from '../entities/RawPayload';
export interface ProjectSearchCriteria {
    query?: string;
    publishedFrom?: Date;
    publishedTo?: Date;
    datePreset?: 'today' | 'last_3_days' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month';
    budgetMin?: number;
    budgetMax?: number;
    budgetType?: 'any' | 'assigned' | 'unassigned';
    bidsFrom?: number;
    bidsTo?: number;
    bidsPreset?: '0' | '1-5' | '6-10' | '11-20' | '21-50' | '50+';
    status?: string;
    executionDaysMin?: number;
    executionDaysMax?: number;
    skills?: string[];
    skillsMatchMode?: 'any' | 'all';
    domain?: string;
    serviceType?: string;
    projectType?: string;
    industry?: string;
    workType?: string;
    clientId?: string;
    clientName?: string;
    competitionLevel?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
    completenessStatus?: string;
    sortBy?: 'published_at' | 'budget' | 'bids_count' | 'updated_at' | 'relevance';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
export interface PaginatedSearchResult {
    items: Array<Project & {
        latestObservation?: ProjectObservation;
        skills?: string[];
        clientName?: string;
        executionDays?: number;
        competitionLevel?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
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
    getLatestRawPayloadByProjectId(projectId: string): Promise<RawPayload | null>;
    findProjects(filter?: FindProjectsFilter): Promise<Project[]>;
    countProjects(filter?: FindProjectsFilter): Promise<number>;
    getLatestSuccessfulCollectionTimestamp(): Promise<Date | null>;
    searchProjects(criteria: ProjectSearchCriteria): Promise<PaginatedSearchResult>;
}
