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
    constructor(props: ProjectProps);
    updateLastSeen(timestamp?: Date): void;
    updateStatus(status: string): void;
}
