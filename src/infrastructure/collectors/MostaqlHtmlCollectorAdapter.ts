import { CollectionFetchResult, ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
import { defaultConfig } from '../../shared/config';
import { MostaqlNetworkError } from '../../shared/errors';
import { MostaqlParser } from './MostaqlParser';

export interface MostaqlCollectorConfig {
  sessionCookie?: string;
  userAgent?: string;
  baseUrl?: string;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export class MostaqlHtmlCollectorAdapter implements ICollectorAdapter {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly sessionCookie?: string;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(config: MostaqlCollectorConfig = {}) {
    this.baseUrl = config.baseUrl || 'https://mostaql.com';
    this.userAgent = config.userAgent || defaultConfig.userAgent;
    this.sessionCookie = config.sessionCookie || defaultConfig.mostaqlSessionCookie;
    this.minDelayMs = config.minDelayMs ?? defaultConfig.minDelayMs;
    this.maxDelayMs = config.maxDelayMs ?? defaultConfig.maxDelayMs;
  }

  public async fetchPage(pageNumber: number): Promise<CollectionFetchResult> {
    await this.applyDelay();

    const targetUrl = `${this.baseUrl}/projects?page=${pageNumber}`;
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    try {
      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        MostaqlParser.checkAuthenticationStatus('', response.status, response.url);
        throw new MostaqlNetworkError(`Failed to fetch page ${pageNumber}. HTTP ${response.status}`, response.status);
      }

      const html = await response.text();
      MostaqlParser.checkAuthenticationStatus(html, response.status, response.url);

      const { items, hasNextPage } = MostaqlParser.parseListingPage(html);

      return {
        pageNumber,
        items,
        hasNextPage,
      };
    } catch (error) {
      if (error instanceof Error && error.name.startsWith('Mostaql')) {
        throw error;
      }
      throw new MostaqlNetworkError(`Network error while fetching page ${pageNumber}: ${(error as Error).message}`);
    }
  }

  public async fetchProjectDetailBySourceId(sourceProjectId: string): Promise<any> {
    const detailUrl = `${this.baseUrl}/project/${sourceProjectId}-project`;
    return this.fetchProjectDetail({ sourceProjectId, sourceUrl: detailUrl });
  }

  public async fetchProjectDetail(item: any): Promise<any> {
    await this.applyDelay();

    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    try {
      const response = await fetch(item.sourceUrl, { headers });

      if (!response.ok) {
        MostaqlParser.checkAuthenticationStatus('', response.status, response.url);
        if (response.status === 404) {
          throw new MostaqlNetworkError(`Project ${item.sourceProjectId} not found on Mostaql (HTTP 404)`, 404);
        }
        return item;
      }

      const detailHtml = await response.text();
      MostaqlParser.checkAuthenticationStatus(detailHtml, response.status, response.url);

      // Extract basic listing info if item was minimal
      let enriched = MostaqlParser.enrichWithDetailPage(item, detailHtml);
      enriched.rawHtml = detailHtml;

      // Extract title if missing
      const titleMatch = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      if (titleMatch && !enriched.title) {
        enriched.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Extract datetime if missing
      const dateMatch = detailHtml.match(/datetime="([^"]+)"/);
      if (dateMatch) {
        enriched.publishedAtRaw = dateMatch[1];
        enriched.publishedAtParsed = MostaqlParser.parseDateTime(dateMatch[1]);
      }

      return enriched;
    } catch (error) {
      if (error instanceof Error && error.name.startsWith('Mostaql')) {
        throw error;
      }
      return item;
    }
  }

  private async applyDelay(): Promise<void> {
    if (this.maxDelayMs > 0) {
      const delay = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
      await this.sleep(delay);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
