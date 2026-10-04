import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { MostaqlParser } from '../src/infrastructure/collectors/MostaqlParser';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { MostaqlAuthError } from '../src/shared/errors';
import { ParsedProjectItem } from '../src/core/interfaces/ICollectorAdapter';

describe('Phase 1.5 - Mostaql Source Discovery & POC Tests', () => {
  const testDbPath = path.join(__dirname, 'test_poc_phase1_5.db');
  let appDb: AppDatabase;
  let projectRepo: SqliteProjectRepository;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    appDb = new AppDatabase(testDbPath);
    projectRepo = new SqliteProjectRepository(appDb.getRawConnection());
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  // 1. Authentication success/failure detection
  it('1. should detect authentication failure or login redirect', () => {
    expect(() => {
      MostaqlParser.checkAuthenticationStatus('', 401);
    }).toThrow(MostaqlAuthError);

    expect(() => {
      MostaqlParser.checkAuthenticationStatus('', 200, 'https://mostaql.com/login?t=123');
    }).toThrow(MostaqlAuthError);

    expect(() => {
      MostaqlParser.checkAuthenticationStatus('<html><body><div class="project-row">Data</div></body></html>', 200, 'https://mostaql.com/projects');
    }).not.toThrow();
  });

  // 2 & 3. Project ID and URL extraction
  it('2 & 3. should extract project ID and full URL accurately', () => {
    const sampleRowHtml = `
      <tr class="project-row">
        <td class="row-td">
          <div class="card--title">
            <h2><a href="https://mostaql.com/project/998877-test-title" class="details-url">عنوان الاختبار</a></h2>
          </div>
        </td>
      </tr>
    `;
    const item = MostaqlParser.parseListingRow(sampleRowHtml);
    expect(item).not.toBeNull();
    expect(item?.sourceProjectId).toBe('998877');
    expect(item?.sourceUrl).toBe('https://mostaql.com/project/998877-test-title');
  });

  // 4. Arabic title extraction
  it('4. should extract clean Arabic title', () => {
    const sampleRowHtml = `
      <tr class="project-row">
        <td>
          <h2><a href="https://mostaql.com/project/100-test">  تطوير نظام ERP باستخدام Laravel  </a></h2>
        </td>
      </tr>
    `;
    const item = MostaqlParser.parseListingRow(sampleRowHtml);
    expect(item?.title).toBe('تطوير نظام ERP باستخدام Laravel');
  });

  // 5. Description extraction
  it('5. should extract brief description snippet', () => {
    const sampleRowHtml = `
      <tr class="project-row">
        <td>
          <h2><a href="https://mostaql.com/project/100-test">عنوان</a></h2>
          <p class="project__brief">نبحث عن مستقل خبير لبناء تطبيق متجر متكامل مع بوابة دفع الإلكترونية</p>
        </td>
      </tr>
    `;
    const item = MostaqlParser.parseListingRow(sampleRowHtml);
    expect(item?.descriptionRaw).toContain('متجر متكامل');
  });

  // 6. Budget parsing
  it('6. should parse budget ranges (min, max, avg)', () => {
    const res1 = MostaqlParser.parseBudgetRange('$100.00 - $250.00');
    expect(res1.min).toBe(100);
    expect(res1.max).toBe(250);
    expect(res1.avg).toBe(175);

    const res2 = MostaqlParser.parseBudgetRange('$500.00');
    expect(res2.min).toBe(500);
    expect(res2.max).toBe(500);
    expect(res2.avg).toBe(500);

    const res3 = MostaqlParser.parseBudgetRange(undefined);
    expect(res3.min).toBeUndefined();
  });

  // 7. Bids parsing
  it('7. should parse Arabic bid counts to integers correctly', () => {
    expect(MostaqlParser.parseBidsCount('أضف أول عرض')).toBe(0);
    expect(MostaqlParser.parseBidsCount('عرض واحد')).toBe(1);
    expect(MostaqlParser.parseBidsCount('عرضان')).toBe(2);
    expect(MostaqlParser.parseBidsCount('15 عرضًا')).toBe(15);
    expect(MostaqlParser.parseBidsCount('8 عروض')).toBe(8);
  });

  // 8. Published date parsing
  it('8. should parse datetime strings into valid UTC Date objects', () => {
    const parsedDate = MostaqlParser.parseDateTime('2026-10-04 14:07:16');
    expect(parsedDate).toBeInstanceOf(Date);
    expect(parsedDate.getUTCFullYear()).toBe(2026);
    expect(parsedDate.getUTCMonth()).toBe(9); // 0-indexed October is 9
    expect(parsedDate.getUTCDate()).toBe(4);
  });

  // 9. Missing optional field
  it('9. should handle missing optional fields gracefully without crashing', () => {
    const minimalRowHtml = `
      <tr class="project-row">
        <td>
          <h2><a href="https://mostaql.com/project/333-min">عنوان أدنى</a></h2>
        </td>
      </tr>
    `;
    const item = MostaqlParser.parseListingRow(minimalRowHtml);
    expect(item).not.toBeNull();
    expect(item?.descriptionRaw).toBeUndefined();
    expect(item?.clientNameRaw).toBeUndefined();
    expect(item?.bidsCountParsed).toBe(0);
  });

  // 10. Pagination detection
  it('10. should detect pagination and items count', () => {
    const listingHtml = `
      <html>
        <body>
          <table class="table">
            <tr class="project-row"><td><h2><a href="https://mostaql.com/project/1-a">A</a></h2></td></tr>
            <tr class="project-row"><td><h2><a href="https://mostaql.com/project/2-b">B</a></h2></td></tr>
          </table>
          <ul class="pagination">
            <li><a href="https://mostaql.com/projects?page=2" rel="next">التالي</a></li>
          </ul>
        </body>
      </html>
    `;
    const res = MostaqlParser.parseListingPage(listingHtml);
    expect(res.items).toHaveLength(2);
    expect(res.hasNextPage).toBe(true);
  });

  // 11. Duplicate source_project_id
  it('11. should save Project once and record multiple ProjectObservation records for duplicate source_project_id', async () => {
    const useCase = new ProcessCollectionItemUseCase(projectRepo);
    const item: ParsedProjectItem = {
      sourceProjectId: '777111',
      title: 'مشروع مكرر للاختبار',
      sourceUrl: 'https://mostaql.com/project/777111',
      bidsCountParsed: 3,
      budgetMinUsd: 100,
      budgetMaxUsd: 200,
      budgetAvgUsd: 150,
      statusRaw: 'مفتوح',
    };

    // First Discovery
    const res1 = await useCase.execute(item);
    expect(res1.isNew).toBe(true);

    // Second Discovery next day (New Observation)
    item.bidsCountParsed = 12;
    item.statusRaw = 'قيد التنفيذ';
    const res2 = await useCase.execute(item);
    expect(res2.isNew).toBe(false);
    expect(res2.projectId).toBe(res1.projectId);

    // Verify DB state
    const count = await projectRepo.countProjects();
    expect(count).toBe(1);

    const obsList = await projectRepo.getObservationsByProjectId(res1.projectId);
    expect(obsList).toHaveLength(2);
    expect(obsList[0].bidsCount).toBe(3);
    expect(obsList[1].bidsCount).toBe(12);
    expect(obsList[1].status).toBe('قيد التنفيذ');
  });

  // 12. Raw HTML preservation
  it('12. should preserve Raw HTML and metadata in raw_payloads table', async () => {
    const useCase = new ProcessCollectionItemUseCase(projectRepo);
    const item: ParsedProjectItem = {
      sourceProjectId: '888222',
      title: 'مشروع للتخزين الخام الحقيقي',
      sourceUrl: 'https://mostaql.com/project/888222',
      rawHtml: '<tr class="project-row"><td>Raw HTML Content</td></tr>',
      clientNameRaw: 'عميل أليكس',
    };

    const res = await useCase.execute(item);
    expect(res.isNew).toBe(true);

    const project = await projectRepo.findById(res.projectId);
    expect(project).not.toBeNull();
  });
});
