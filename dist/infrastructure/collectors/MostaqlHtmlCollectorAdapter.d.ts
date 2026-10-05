import { CollectionFetchResult, ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
export interface MostaqlCollectorConfig {
    sessionCookie?: string;
    userAgent?: string;
    baseUrl?: string;
    minDelayMs?: number;
    maxDelayMs?: number;
}
export declare class MostaqlHtmlCollectorAdapter implements ICollectorAdapter {
    private readonly baseUrl;
    private readonly userAgent;
    private readonly sessionCookie?;
    private readonly minDelayMs;
    private readonly maxDelayMs;
    constructor(config?: MostaqlCollectorConfig);
    fetchPage(pageNumber: number): Promise<CollectionFetchResult>;
    fetchProjectDetailBySourceId(sourceProjectId: string): Promise<any>;
    fetchProjectDetail(item: any): Promise<any>;
    private applyDelay;
    private sleep;
}
