import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
export declare class MostaqlParser {
    /**
     * Checks if HTML response signals authentication failure or session expiration.
     */
    static checkAuthenticationStatus(html: string, statusCode?: number, finalUrl?: string): void;
    /**
     * Parses project items from a listing page HTML.
     */
    static parseListingPage(html: string): {
        items: ParsedProjectItem[];
        hasNextPage: boolean;
    };
    /**
     * Parses a single <tr class="project-row"> element.
     */
    static parseListingRow(rowHtml: string): ParsedProjectItem | null;
    /**
     * Enhances a project item with extra metadata from its detail page.
     */
    static enrichWithDetailPage(item: ParsedProjectItem, detailHtml: string): ParsedProjectItem;
    /**
     * Utility to parse date strings into valid JavaScript Date objects in Riyadh GMT+3 timezone.
     * Returns undefined if date cannot be parsed (NEVER falls back to current time).
     */
    static parseDateTime(rawDateStr?: string): Date | undefined;
    /**
     * Utility to parse Arabic bid text into integers.
     */
    static parseBidsCount(rawBidsStr?: string): number;
    /**
     * Utility to parse budget string (e.g., "$100.00 - $250.00") into min, max, avg numbers.
     */
    static parseBudgetRange(rawBudgetStr?: string): {
        min?: number;
        max?: number;
        avg?: number;
    };
    /**
     * Helper to strip HTML tags and normalize whitespace.
     */
    private static cleanText;
}
