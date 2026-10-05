import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
import { MostaqlAuthError, MostaqlParsingError } from '../../shared/errors';

export class MostaqlParser {
  /**
   * Checks if HTML response signals authentication failure or session expiration.
   */
  public static checkAuthenticationStatus(html: string, statusCode: number = 200, finalUrl?: string): void {
    if (statusCode === 401 || statusCode === 403) {
      throw new MostaqlAuthError(`HTTP status ${statusCode} indicates access denied or session expired.`);
    }

    if (finalUrl && finalUrl.includes('/login')) {
      throw new MostaqlAuthError('Redirected to Mostaql login page. Session expired or authentication required.');
    }

    // Check for login forms or Cloudflare challenge keywords
    if (html.includes('id="login-form"') || html.includes('action="https://mostaql.com/login"')) {
      // Only throw if page is not public listing or detail
      if (!html.includes('class="project-row"') && !html.includes('id="project-meta-panel"')) {
        throw new MostaqlAuthError('Login form detected in response. Authentication required.');
      }
    }

    if (html.includes('Just a moment...') && html.includes('Cloudflare')) {
      throw new MostaqlAuthError('Cloudflare anti-bot challenge detected.');
    }
  }

  /**
   * Parses project items from a listing page HTML.
   */
  public static parseListingPage(html: string): { items: ParsedProjectItem[]; hasNextPage: boolean } {
    this.checkAuthenticationStatus(html);

    const items: ParsedProjectItem[] = [];
    // Match each <tr class="project-row">...</tr>
    const rowRegex = /<tr[^>]*class="[^"]*project-row[^"]*"[\s\S]*?<\/tr>/g;
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[0];
      const parsedItem = this.parseListingRow(rowHtml);
      if (parsedItem) {
        items.push(parsedItem);
      }
    }

    // Detect pagination next page link
    const hasNextPage = /rel="next"|href="[^"]*page=\d+"[^>]*>البريد الإلكتروني|rel="next"|href="[^"]*page=\d+"[^>]* aria-label="Next"/i.test(html) ||
      /class="[^"]*pagination[^"]*"[\s\S]*?href="[^"]*page=\d+"/i.test(html) ||
      (items.length >= 25); // Mostaql default per page is 25

    return { items, hasNextPage };
  }

  /**
   * Parses a single <tr class="project-row"> element.
   */
  public static parseListingRow(rowHtml: string): ParsedProjectItem | null {
    // 1. Extract Project URL & ID
    const urlMatch = rowHtml.match(/href="(https:\/\/mostaql\.com\/project\/(\d+)-[^"]+)"/);
    if (!urlMatch) return null;

    const sourceUrl = urlMatch[1];
    const sourceProjectId = urlMatch[2];

    // 2. Extract Title
    const titleMatch = rowHtml.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const title = titleMatch ? this.cleanText(titleMatch[1]) : 'مشروع بدون عنوان';

    // 3. Extract Published At Date
    const datetimeMatch = rowHtml.match(/datetime="([^"]+)"/);
    const publishedAtRaw = datetimeMatch ? datetimeMatch[1] : undefined;
    const publishedAtParsed = publishedAtRaw ? this.parseDateTime(publishedAtRaw) : undefined;

    // 4. Extract Bids Count
    const bidsMatch = rowHtml.match(/<li[^>]*class="text-muted"[^>]*>[\s\S]*?<span[^>]*><\/span>([\s\S]*?)<\/li>/) ||
      rowHtml.match(/(\d+|\u0660-\u0669+|عرض|عروض|أضف أول عرض)[\s\S]*?(?:عرض|عروض)/);
    
    const bidsCountRaw = bidsMatch ? this.cleanText(bidsMatch[1]) : undefined;
    const bidsCountParsed = this.parseBidsCount(bidsCountRaw);

    // 5. Extract Client Name
    const clientMatch = rowHtml.match(/<i class="fa fa-user"><\/i>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/);
    const clientNameRaw = clientMatch ? this.cleanText(clientMatch[1]) : undefined;

    // 6. Extract Brief Description
    const briefMatch = rowHtml.match(/class="[^"]*project__brief[^"]*"[\s\S]*?>([\s\S]*?)<\/p>/) ||
      rowHtml.match(/class="[^"]*project__brief[^"]*"[\s\S]*?>([\s\S]*?)<\/a>/);
    const descriptionRaw = briefMatch ? this.cleanText(briefMatch[1]) : undefined;

    return {
      sourceProjectId,
      title,
      sourceUrl,
      descriptionRaw,
      publishedAtRaw,
      publishedAtParsed,
      bidsCountRaw,
      bidsCountParsed,
      clientNameRaw,
      statusRaw: 'مفتوح',
      rawHtml: rowHtml,
    };
  }

  /**
   * Enhances a project item with extra metadata from its detail page.
   */
  public static enrichWithDetailPage(item: ParsedProjectItem, detailHtml: string): ParsedProjectItem {
    this.checkAuthenticationStatus(detailHtml);

    // Budget Parsing
    const budgetMatch = detailHtml.match(/data-type=["']?project-budget_range["']?[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) ||
      detailHtml.match(/الميزانية[\s\S]*?<div class="meta-value"[^>]*>([\s\S]*?)<\/div>/) ||
      detailHtml.match(/الميزانية[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/);
    
    if (budgetMatch) {
      item.budgetRaw = this.cleanText(budgetMatch[1]);
      const { min, max, avg } = this.parseBudgetRange(item.budgetRaw);
      item.budgetMinUsd = min;
      item.budgetMaxUsd = max;
      item.budgetAvgUsd = avg;
    }

    // Execution Time Parsing
    const execMatch = detailHtml.match(/مدة التنفيذ[\s\S]*?<div class="meta-value"[^>]*>([\s\S]*?)<\/div>/);
    if (execMatch) {
      item.executionTimeRaw = this.cleanText(execMatch[1]);
      const daysMatch = item.executionTimeRaw.match(/(\d+)/);
      if (daysMatch) {
        item.executionDaysParsed = parseInt(daysMatch[1], 10);
      }
    }

    // Status Parsing
    const statusMatch = detailHtml.match(/حالة المشروع[\s\S]*?<bdi[^>]*>([\s\S]*?)<\/bdi>/);
    if (statusMatch) {
      item.statusRaw = this.cleanText(statusMatch[1]);
    }

    // Skills Tags Parsing
    const skillsMatches = [...detailHtml.matchAll(/href="https:\/\/mostaql\.com\/projects\/skill\/[^"]+"[^>]*>[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/g)];
    if (skillsMatches.length > 0) {
      item.skillsTagsRaw = skillsMatches.map(m => this.cleanText(m[1]));
    }

    // Detailed Description
    const fullDescMatch = detailHtml.match(/id="projectDetailsTab"[\s\S]*?<div class="text-wrapper-div carda__content "[^>]*>([\s\S]*?)<\/div>/);
    if (fullDescMatch) {
      item.descriptionRaw = this.cleanText(fullDescMatch[1]);
    }

    // Bids Count Parsing
    const bidsMatch = detailHtml.match(/data-type=["']?project-bids_count["']?[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/) ||
      detailHtml.match(/عدد العروض[\s\S]*?<div class="meta-value"[^>]*>([\s\S]*?)<\/div>/) ||
      detailHtml.match(/عدد العروض[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/) ||
      detailHtml.match(/عدد العروض[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/);

    if (bidsMatch) {
      item.bidsCountRaw = this.cleanText(bidsMatch[1]);
      const parsed = this.parseBidsCount(item.bidsCountRaw);
      if (parsed > 0 || item.bidsCountParsed === undefined) {
        item.bidsCountParsed = parsed;
      }
    }

    // Client Name & Profile Parsing
    const clientNameMatch = detailHtml.match(/class="[^"]*profile-card__name[^"]*"[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/) ||
      detailHtml.match(/<h3 class="[^"]*profile-card__name[^"]*"[^>]*>([\s\S]*?)<\/h3>/) ||
      detailHtml.match(/صاحب المشروع[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/);

    if (clientNameMatch) {
      item.clientNameRaw = this.cleanText(clientNameMatch[1]);
    }

    const clientUrlMatch = detailHtml.match(/href="(https:\/\/mostaql\.com\/freelancers\/[^"]+)"/) ||
      detailHtml.match(/href="(https:\/\/mostaql\.com\/u\/[^"]+)"/);
    if (clientUrlMatch) {
      item.clientProfileUrl = clientUrlMatch[1];
    }

    return item;
  }

  /**
   * Utility to parse date strings into valid JavaScript Date objects.
   * Returns undefined if date cannot be parsed (NEVER falls back to current time).
   */
  public static parseDateTime(rawDateStr?: string): Date | undefined {
    if (!rawDateStr) return undefined;

    // Standard format YYYY-MM-DD HH:mm:ss or ISO
    const normalized = rawDateStr.trim().replace(' ', 'T');
    const dateObj = new Date(normalized);

    if (!isNaN(dateObj.getTime())) {
      return dateObj;
    }

    // Relative date handling
    const now = new Date();
    if (rawDateStr.includes('دقيقة') || rawDateStr.includes('دقائق')) {
      const match = rawDateStr.match(/(\d+)/);
      const mins = match ? parseInt(match[1], 10) : 5;
      return new Date(now.getTime() - mins * 60 * 1000);
    }
    if (rawDateStr.includes('ساعة') || rawDateStr.includes('ساعات')) {
      const match = rawDateStr.match(/(\d+)/);
      const hours = match ? parseInt(match[1], 10) : 1;
      return new Date(now.getTime() - hours * 3600 * 1000);
    }
    if (rawDateStr.includes('يوم') || rawDateStr.includes('أيام')) {
      const match = rawDateStr.match(/(\d+)/);
      const days = match ? parseInt(match[1], 10) : 1;
      return new Date(now.getTime() - days * 86400 * 1000);
    }

    return undefined;
  }

  /**
   * Utility to parse Arabic bid text into integers.
   */
  public static parseBidsCount(rawBidsStr?: string): number {
    if (!rawBidsStr) return 0;

    const cleaned = this.cleanText(rawBidsStr);
    if (cleaned.includes('أضف أول عرض') || cleaned.includes('لا يوجد عروض')) return 0;
    if (cleaned.includes('عرض واحد')) return 1;
    if (cleaned.includes('عرضان') || cleaned.includes('عرضين')) return 2;

    const numMatch = cleaned.match(/(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    return 0;
  }

  /**
   * Utility to parse budget string (e.g., "$100.00 - $250.00") into min, max, avg numbers.
   */
  public static parseBudgetRange(rawBudgetStr?: string): { min?: number; max?: number; avg?: number } {
    if (!rawBudgetStr) return {};

    const numbers = [...rawBudgetStr.matchAll(/\$?([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g, '')));
    if (numbers.length === 0) return {};

    if (numbers.length === 1) {
      return { min: numbers[0], max: numbers[0], avg: numbers[0] };
    }

    const min = Math.min(numbers[0], numbers[1]);
    const max = Math.max(numbers[0], numbers[1]);
    const avg = (min + max) / 2;

    return { min, max, avg };
  }

  /**
   * Helper to strip HTML tags and normalize whitespace.
   */
  private static cleanText(htmlOrText: string): string {
    return htmlOrText
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
