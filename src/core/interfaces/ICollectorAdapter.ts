export interface ParsedProjectItem {
  sourceProjectId: string;
  title: string;
  sourceUrl: string;
  descriptionRaw?: string;
  publishedAtRaw?: string;
  publishedAtParsed?: Date;
  budgetRaw?: string;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetAvgUsd?: number;
  bidsCountRaw?: string;
  bidsCountParsed?: number;
  executionTimeRaw?: string;
  executionDaysParsed?: number;
  clientNameRaw?: string;
  clientProfileUrl?: string;
  statusRaw?: string;
  skillsTagsRaw?: string[];
  rawHtml?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface CollectionFetchResult {
  pageNumber: number;
  items: ParsedProjectItem[];
  hasNextPage: boolean;
  totalPageCount?: number;
}

export interface ICollectorAdapter {
  fetchPage(pageNumber: number): Promise<CollectionFetchResult>;
}
