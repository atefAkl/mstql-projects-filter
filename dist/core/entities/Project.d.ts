export interface ProjectProps {
    id: string;
    sourceProjectId: string;
    title: string;
    sourceUrl: string;
    descriptionRaw?: string;
    publishedAt?: Date;
    firstSeenAt: Date;
    lastSeenAt: Date;
    status: string;
    clientId?: string;
    rawContentHash?: string;
    normalizedContentHash?: string;
    lastSourceSyncAt?: Date;
    lastSyncStatus?: string;
    completenessStatus?: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due';
}
export declare class Project {
    readonly id: string;
    readonly sourceProjectId: string;
    title: string;
    sourceUrl: string;
    descriptionRaw?: string;
    publishedAt?: Date;
    readonly firstSeenAt: Date;
    lastSeenAt: Date;
    status: string;
    clientId?: string;
    rawContentHash?: string;
    normalizedContentHash?: string;
    lastSourceSyncAt?: Date;
    lastSyncStatus?: string;
    completenessStatus: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due';
    constructor(props: ProjectProps);
    updateLastSeen(timestamp?: Date): void;
    updateStatus(status: string): void;
    markCompleteness(status: 'discovered' | 'pending_ingestion' | 'complete' | 'fetch_failed' | 'refresh_due'): void;
    updateSyncDetails(rawHash?: string, normHash?: string, syncStatus?: string, timestamp?: Date): void;
}
