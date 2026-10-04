import { CollectionFetchResult, ICollectorAdapter, ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
export declare class MockCollectorAdapter implements ICollectorAdapter {
    private pagesData;
    setPageData(pageNumber: number, items: ParsedProjectItem[]): void;
    fetchPage(pageNumber: number): Promise<CollectionFetchResult>;
}
