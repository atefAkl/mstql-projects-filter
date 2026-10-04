import { CollectionFetchResult, ICollectorAdapter, ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';

export class MockCollectorAdapter implements ICollectorAdapter {
  private pagesData: Map<number, ParsedProjectItem[]> = new Map();

  public setPageData(pageNumber: number, items: ParsedProjectItem[]): void {
    this.pagesData.set(pageNumber, items);
  }

  public async fetchPage(pageNumber: number): Promise<CollectionFetchResult> {
    const items = this.pagesData.get(pageNumber) || [];
    const hasNextPage = this.pagesData.has(pageNumber + 1);

    return {
      pageNumber,
      items,
      hasNextPage,
      totalPageCount: this.pagesData.size,
    };
  }
}
