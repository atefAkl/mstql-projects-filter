export declare class MostaqlAuthError extends Error {
    constructor(message?: string);
}
export declare class MostaqlParsingError extends Error {
    readonly rawHtmlSnippet?: string | undefined;
    constructor(message: string, rawHtmlSnippet?: string | undefined);
}
export declare class MostaqlNetworkError extends Error {
    readonly statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
