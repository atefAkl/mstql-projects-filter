import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { GetAndRefreshProjectUseCase } from '../src/application/use-cases/GetAndRefreshProjectUseCase';
import { BackfillIncompleteProjectsUseCase } from '../src/application/use-cases/BackfillIncompleteProjectsUseCase';
import { Project } from '../src/core/entities/Project';
import { ProjectObservation } from '../src/core/entities/ProjectObservation';
import { MockCollectorAdapter } from '../src/infrastructure/collectors/MockCollectorAdapter';
import { MostaqlParser } from '../src/infrastructure/collectors/MostaqlParser';

describe('Phase 4B - Local Data Consolidation & Complete Project Ingestion Suite', () => {
  const testDbPath = path.join(__dirname, 'test_phase4b_consolidation.db');
  let appDb: AppDatabase;
  let projectRepo: SqliteProjectRepository;
  let mockCollector: any;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    appDb = new AppDatabase(testDbPath);
    const db = appDb.getRawConnection();
    projectRepo = new SqliteProjectRepository(db);

    mockCollector = new MockCollectorAdapter();
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('1. Local DB is Single Source of Truth: GET /api/projects/:id with refresh=false reads strictly from DB without calling collector', async () => {
    const now = new Date();
    const localProj = new Project({
      id: 'proj_4b_100',
      sourceProjectId: '4b_100',
      title: 'مشروع محلي بحت',
      sourceUrl: 'https://mostaql.com/project/4b_100',
      descriptionRaw: 'وصف المشروع المحلي',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      completenessStatus: 'complete',
    });
    await projectRepo.saveProject(localProj);

    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_4b_100',
      projectId: 'proj_4b_100',
      observedAt: now,
      bidsCount: 4,
      status: 'مفتوح',
    }));

    // Throw error if collector is called to ensure ZERO external network calls
    mockCollector.fetchProjectDetailBySourceId = async () => {
      throw new Error('EXTERNAL CALL SHOULD NOT HAPPEN FOR READS!');
    };
    mockCollector.fetchProjectDetail = async () => {
      throw new Error('EXTERNAL CALL SHOULD NOT HAPPEN FOR READS!');
    };

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '4b_100', forceRefresh: false });

    expect(result.refreshStatus).toBe('local_cached');
    expect(result.project.title).toBe('مشروع محلي بحت');
    expect(result.observations[0].bidsCount).toBe(4);
  });

  it('2. Backfill Queue Ingests Incomplete Projects: fetches full detail for incomplete projects without duplicating Project entities', async () => {
    const now = new Date();
    // Insert an index-only discovered project (missing descriptionRaw, completenessStatus = 'discovered')
    const incompleteProj = new Project({
      id: 'proj_4b_200',
      sourceProjectId: '4b_200',
      title: 'مشروع من الفهرس فقط',
      sourceUrl: 'https://mostaql.com/project/4b_200',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      completenessStatus: 'discovered',
    });
    await projectRepo.saveProject(incompleteProj);

    mockCollector.fetchProjectDetailBySourceId = async (sourceId: string) => ({
      sourceProjectId: sourceId,
      title: 'مشروع من الفهرس فقط بعد الإكمال',
      sourceUrl: `https://mostaql.com/project/${sourceId}`,
      descriptionRaw: 'تم جلب الوصف الكامل للمشروع من صفحة التفاصيل عبر Backfill Queue',
      publishedAtParsed: now,
      bidsCountParsed: 15,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>Full Details Body</body></html>',
    });

    const backfillUseCase = new BackfillIncompleteProjectsUseCase(projectRepo, mockCollector);
    const result = await backfillUseCase.execute();

    expect(result.processedCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(0);

    const updatedProj = await projectRepo.findBySourceProjectId('4b_200');
    expect(updatedProj?.completenessStatus).toBe('complete');
    expect(updatedProj?.descriptionRaw).toContain('تم جلب الوصف الكامل');

    // Verify Project entity was updated in place (NO duplicate entity created)
    const totalProjects = await projectRepo.countProjects();
    expect(totalProjects).toBe(1);
  });

  it('3. Explorer Deduplication Guard: ensures single Project record per source_project_id after Backfill and Refresh', async () => {
    const now = new Date();
    const proj = new Project({
      id: 'proj_4b_300',
      sourceProjectId: '4b_300',
      title: 'مشروع موحد الهوية',
      sourceUrl: 'https://mostaql.com/project/4b_300',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      completenessStatus: 'complete',
    });
    await projectRepo.saveProject(proj);

    // Save 2 observations
    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_1',
      projectId: 'proj_4b_300',
      observedAt: new Date(now.getTime() - 1000),
      bidsCount: 2,
      status: 'مفتوح',
    }));
    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_2',
      projectId: 'proj_4b_300',
      observedAt: now,
      bidsCount: 9,
      status: 'مفتوح',
    }));

    const rawDb = appDb.getRawConnection();
    const sql = `
      SELECT p.id, p.source_project_id, p.title, p.status, o.bids_count
      FROM projects p
      LEFT JOIN project_observations o ON o.id = (
        SELECT o2.id FROM project_observations o2
        WHERE o2.project_id = p.id
        ORDER BY o2.observed_at DESC, o2.id DESC
        LIMIT 1
      )
      WHERE p.source_project_id = ?
    `;

    const rows = rawDb.prepare(sql).all('4b_300') as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].bids_count).toBe(9);
  });

  it('4. Test A — Project Exists Locally: immediate local read + background source check (no change = no new observation)', async () => {
    const now = new Date();
    const mockItem = {
      sourceProjectId: '4b_400',
      title: 'تطبيق موحد محلية',
      sourceUrl: 'https://mostaql.com/project/4b_400',
      descriptionRaw: 'وصف ثابت',
      publishedAtParsed: now,
      bidsCountParsed: 5,
      budgetMinUsd: 100,
      budgetMaxUsd: 200,
      budgetAvgUsd: 150,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>Detail Body 400</body></html>',
    };

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);

    // Initial creation from source
    mockCollector.fetchProjectDetailBySourceId = async () => mockItem;
    const initialRes = await useCase.execute({ sourceProjectId: '4b_400', forceRefresh: true });
    expect(initialRes.refreshStatus).toBe('created_from_source');

    // Stage 1: Immediate local DB read (refresh=false)
    const localReadRes = await useCase.execute({ sourceProjectId: '4b_400', forceRefresh: false });
    expect(localReadRes.refreshStatus).toBe('local_cached');
    expect(localReadRes.project.title).toBe('تطبيق موحد محلية');

    // Stage 2: Automatic Background source check (forceRefresh=true with unchanged data)
    mockCollector.fetchProjectDetail = async () => mockItem;
    const backgroundCheckRes = await useCase.execute({ sourceProjectId: '4b_400', forceRefresh: true });

    expect(backgroundCheckRes.refreshStatus).toBe('success_unchanged');
    expect(backgroundCheckRes.observations).toHaveLength(1); // NO duplicate observation!
  });

  it('5. Test B — New Project (Not in DB): fetches detail from Mostaql, saves initial observation & raw payload, renders from local DB', async () => {
    const now = new Date();
    mockCollector.fetchProjectDetailBySourceId = async (sourceId: string) => ({
      sourceProjectId: sourceId,
      title: 'مشروع غير موجود محلياً',
      sourceUrl: `https://mostaql.com/project/${sourceId}`,
      descriptionRaw: 'الوصف الكامل المأخوذ من المصدر',
      publishedAtParsed: now,
      bidsCountParsed: 17,
      budgetMinUsd: 50,
      budgetMaxUsd: 100,
      budgetAvgUsd: 75,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>New Project Body</body></html>',
    });

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '4b_500', forceRefresh: true });

    expect(result.isNew).toBe(true);
    expect(result.refreshStatus).toBe('created_from_source');
    expect(result.project.completenessStatus).toBe('complete');
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].bidsCount).toBe(17);

    // Verify it is now in local DB and rendered strictly from local DB on read
    const localRead = await useCase.execute({ sourceProjectId: '4b_500', forceRefresh: false });
    expect(localRead.refreshStatus).toBe('local_cached');
    expect(localRead.project.title).toBe('مشروع غير موجود محلياً');
  });

  it('6. Test C — Mostaql Unavailable: network error returns local DB data safely without losing data or throwing', async () => {
    const now = new Date();
    const proj = new Project({
      id: 'proj_4b_600',
      sourceProjectId: '4b_600',
      title: 'مشروع محلي قوي التحمل',
      sourceUrl: 'https://mostaql.com/project/4b_600',
      descriptionRaw: 'بيانات محلية محفوظة',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      completenessStatus: 'complete',
    });
    await projectRepo.saveProject(proj);

    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_4b_600',
      projectId: 'proj_4b_600',
      observedAt: now,
      bidsCount: 8,
      status: 'مفتوح',
    }));

    // Simulate Network Failure on source fetch
    mockCollector.fetchProjectDetail = async () => {
      throw new Error('Mostaql Server Network Timeout 504');
    };

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '4b_600', forceRefresh: true });

    expect(result.refreshStatus).toBe('network_failed');
    expect(result.project.title).toBe('مشروع محلي قوي التحمل'); // Preserved local data
    expect(result.observations[0].bidsCount).toBe(8);
  });

  it('7. Test D — Detail Richness: ensures full description, bids count, budget range, and metadata are extracted from detail page', async () => {
    const detailHtml = `
      <html>
        <body>
          <h1>تطوير متجر إلكتروني متكامل</h1>
          <div id="projectDetailsTab">
            <div class="text-wrapper-div carda__content ">
              وصف تفصيلي كامل يتضمن الشروط والمواصفات الكاملة للمتجر.
            </div>
          </div>
          <div data-type="project-budget_range"><span>$100.00 - $250.00</span></div>
          <div data-type="project-bids_count"><span>17</span></div>
          <div class="profile-card__name"><bdi>أحمد محمود</bdi></div>
          <a href="https://mostaql.com/projects/skill/laravel"><bdi>Laravel</bdi></a>
          <a href="https://mostaql.com/projects/skill/vuejs"><bdi>Vue.js</bdi></a>
        </body>
      </html>
    `;

    const parsed = {
      sourceProjectId: '4b_700',
      sourceUrl: 'https://mostaql.com/project/4b_700',
    };

    const enriched = MostaqlParser.enrichWithDetailPage(parsed as any, detailHtml);

    expect(enriched.descriptionRaw).toContain('وصف تفصيلي كامل');
    expect(enriched.budgetMinUsd).toBe(100);
    expect(enriched.budgetMaxUsd).toBe(250);
    expect(enriched.budgetAvgUsd).toBe(175);
    expect(enriched.bidsCountParsed).toBe(17);
    expect(enriched.clientNameRaw).toBe('أحمد محمود');
    expect(enriched.skillsTagsRaw).toEqual(['Laravel', 'Vue.js']);
  });
});
