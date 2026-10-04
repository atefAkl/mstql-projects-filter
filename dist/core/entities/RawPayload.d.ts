export interface RawPayloadProps {
    id: string;
    projectId: string;
    rawHtml?: string;
    rawMetadata?: Record<string, unknown>;
    createdAt: Date;
}
export declare class RawPayload {
    readonly id: string;
    readonly projectId: string;
    readonly rawHtml?: string;
    readonly rawMetadata?: Record<string, unknown>;
    readonly createdAt: Date;
    constructor(props: RawPayloadProps);
}
