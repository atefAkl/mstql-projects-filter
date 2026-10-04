import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../src/infrastructure/repositories/SqliteCollectionRunRepository';
import { Project } from '../src/core/entities/Project';
import { ProjectObservation } from '../src/core/entities/ProjectObservation';
import { CollectionRun } from '../src/core/entities/CollectionRun';
import { RawPayload } from '../src/core/entities/RawPayload';
import { MockCollectorAdapter } from '../src/infrastructure/collectors/MockCollectorAdapter';

describe('Phase 1 Foundation - Core Domain & Repositories', () => {
  const testDbPath = path.join(__dirname, 'test_market_intelligence.db');
  let appDb: AppDatabase;
  let projectRepo: SqliteProjectRepository;
  let collectionRunRepo: SqliteCollectionRunRepository;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    appDb = new AppDatabase(testDbPath);
    const db = appDb.getRawConnection();
    projectRepo = new SqliteProjectRepository(db);
    collectionRunRepo = new SqliteCollectionRunRepository(db);
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should initialize database tables cleanly', () => {
    const rawDb = appDb.getRawConnection();
    const tables = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('project_observations');
    expect(tableNames).toContain('raw_payloads');
    expect(tableNames).toContain('collection_runs');
    expect(tableNames).toContain('taxonomy_terms');
    expect(tableNames).toContain('project_classifications');
  });

  it('should create and retrieve a project with deduplication on source_project_id', async () => {
    const now = new Date();
    const project = new Project({
      id: 'proj_001',
      sourceProjectId: '112233',
      title: 'تطوير نظام ERP باستخدام Laravel',
      sourceUrl: 'https://mostaql.com/project/112233',
      descriptionRaw: 'نبحث عن مهندس لبناء نظام ERP شامل',
      publishedAt: now,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
    });

    await projectRepo.saveProject(project);

    const retrieved = await projectRepo.findBySourceProjectId('112233');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('تطوير نظام ERP باستخدام Laravel');
    expect(retrieved?.status).toBe('مفتوح');

    // Test upsert / duplicate update
    project.updateStatus('مغلق');
    project.updateLastSeen(new Date(now.getTime() + 3600000));
    await projectRepo.saveProject(project);

    const updated = await projectRepo.findBySourceProjectId('112233');
    expect(updated?.status).toBe('مغلق');
    expect(updated?.lastSeenAt.getTime()).toBeGreaterThan(now.getTime());

    const totalCount = await projectRepo.countProjects();
    expect(totalCount).toBe(1);
  });

  it('should record multiple project observations for historical tracking', async () => {
    const now = new Date();
    const project = new Project({
      id: 'proj_002',
      sourceProjectId: '998877',
      title: 'بناء تطبيق متجر متكامل',
      sourceUrl: 'https://mostaql.com/project/998877',
      publishedAt: now,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
    });
    await projectRepo.saveProject(project);

    const obs1 = new ProjectObservation({
      id: 'obs_01',
      projectId: 'proj_002',
      observedAt: now,
      bidsCount: 5,
      budgetMinUsd: 500,
      budgetMaxUsd: 1000,
      budgetAvgUsd: 750,
      status: 'مفتوح',
    });

    const obs2 = new ProjectObservation({
      id: 'obs_02',
      projectId: 'proj_002',
      observedAt: new Date(now.getTime() + 86400000), // Next day
      bidsCount: 19,
      budgetMinUsd: 500,
      budgetMaxUsd: 1000,
      budgetAvgUsd: 750,
      status: 'قيد التنفيذ',
    });

    await projectRepo.saveObservation(obs1);
    await projectRepo.saveObservation(obs2);

    const observations = await projectRepo.getObservationsByProjectId('proj_002');
    expect(observations).toHaveLength(2);
    expect(observations[0].bidsCount).toBe(5);
    expect(observations[1].bidsCount).toBe(19);
    expect(observations[1].status).toBe('قيد التنفيذ');

    const latestObs = await projectRepo.getLatestObservation('proj_002');
    expect(latestObs?.id).toBe('obs_02');
  });

  it('should preserve raw payload HTML and metadata', async () => {
    const project = new Project({
      id: 'proj_raw_001',
      sourceProjectId: '554433',
      title: 'مشروع للتخزين الخام',
      sourceUrl: 'https://mostaql.com/project/554433',
      publishedAt: new Date(),
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: 'مفتوح',
    });
    await projectRepo.saveProject(project);

    const rawPayload = new RawPayload({
      id: 'raw_01',
      projectId: 'proj_raw_001',
      rawHtml: '<html><body><div class="project-title">Test</div></body></html>',
      rawMetadata: { page: 1, parsedBy: 'MockCollector' },
      createdAt: new Date(),
    });

    await projectRepo.saveRawPayload(rawPayload);
    expect(rawPayload.rawHtml).toContain('project-title');
  });

  it('should track collection runs lifecycle and metrics', async () => {
    const run = new CollectionRun({
      id: 'run_01',
      type: 'historical',
      status: 'running',
      startedAt: new Date(),
      pagesProcessed: 0,
      projectsFound: 0,
      newProjectsCount: 0,
      duplicateProjectsCount: 0,
      errorCount: 0,
    });

    await collectionRunRepo.save(run);

    run.incrementPages();
    run.recordNewProject();
    run.recordDuplicateProject();
    run.recordError('Page 2 element timeout');

    await collectionRunRepo.update(run);

    const fetched = await collectionRunRepo.findById('run_01');
    expect(fetched?.pagesProcessed).toBe(1);
    expect(fetched?.projectsFound).toBe(2);
    expect(fetched?.newProjectsCount).toBe(1);
    expect(fetched?.duplicateProjectsCount).toBe(1);
    expect(fetched?.errorCount).toBe(1);
    expect(fetched?.errorLog).toContain('element timeout');

    run.markCompleted();
    await collectionRunRepo.update(run);

    const completed = await collectionRunRepo.getLatestCompletedRun();
    expect(completed?.status).toBe('completed');
    expect(completed?.finishedAt).toBeDefined();
  });

  it('should verify MockCollectorAdapter functionality', async () => {
    const mockCollector = new MockCollectorAdapter();
    mockCollector.setPageData(1, [
      {
        sourceProjectId: '100',
        title: 'Project 100',
        sourceUrl: 'https://mostaql.com/project/100',
      },
    ]);

    const res = await mockCollector.fetchPage(1);
    expect(res.pageNumber).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].sourceProjectId).toBe('100');
  });
});
