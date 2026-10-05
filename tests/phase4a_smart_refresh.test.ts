import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { MostaqlHtmlCollectorAdapter } from '../src/infrastructure/collectors/MostaqlHtmlCollectorAdapter';
import { GetAndRefreshProjectUseCase } from '../src/application/use-cases/GetAndRefreshProjectUseCase';
import { Project } from '../src/core/entities/Project';
import { ProjectObservation } from '../src/core/entities/ProjectObservation';
import { RawPayload } from '../src/core/entities/RawPayload';
import { computeHash, computeNormalizedHash } from '../src/shared/hash';
import { MostaqlAuthError, MostaqlNetworkError, MostaqlParsingError } from '../src/shared/errors';

describe('Phase 4A - Project Detail & Smart Source Refresh Suite', () => {
  const testDbPath = path.join(__dirname, 'test_phase4a_refresh.db');
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

    mockCollector = new MostaqlHtmlCollectorAdapter();
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('1. New Project: fetches unknown project from source, creates Project, first Observation, and Raw Payload', async () => {
    mockCollector.fetchProjectDetailBySourceId = async (sourceId: string) => ({
      sourceProjectId: sourceId,
      title: 'تطوير تطبيق جديد',
      sourceUrl: `https://mostaql.com/project/${sourceId}`,
      descriptionRaw: 'وصف تفصيلي للمشروع',
      publishedAtParsed: new Date('2026-10-05T08:00:00.000Z'),
      bidsCountParsed: 5,
      budgetMinUsd: 100,
      budgetMaxUsd: 250,
      budgetAvgUsd: 175,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>Detail Page HTML</body></html>',
    });

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881100', forceRefresh: true });

    expect(result.isNew).toBe(true);
    expect(result.refreshStatus).toBe('created_from_source');
    expect(result.project.sourceProjectId).toBe('881100');
    expect(result.project.publishedAt?.toISOString()).toBe('2026-10-05T08:00:00.000Z');
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].bidsCount).toBe(5);

    const dbProject = await projectRepo.findBySourceProjectId('881100');
    expect(dbProject).not.toBeNull();
  });

  it('2. Existing Unchanged Project: normalized hash unchanged -> NO new Observation, NO duplicate Project', async () => {
    const now = new Date();
    const mockItem = {
      sourceProjectId: '881101',
      title: 'نظام مخازن ثابت',
      sourceUrl: 'https://mostaql.com/project/881101',
      descriptionRaw: 'وصف ثابت',
      publishedAtParsed: now,
      bidsCountParsed: 10,
      budgetMinUsd: 200,
      budgetMaxUsd: 400,
      budgetAvgUsd: 300,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>HTML 1</body></html>',
    };

    const normHash = computeNormalizedHash(mockItem);
    const rawHash = computeHash(mockItem.rawHtml);

    const initialProject = new Project({
      id: 'proj_881101',
      sourceProjectId: '881101',
      title: mockItem.title,
      sourceUrl: mockItem.sourceUrl,
      descriptionRaw: mockItem.descriptionRaw,
      publishedAt: now,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      rawContentHash: rawHash,
      normalizedContentHash: normHash,
    });
    await projectRepo.saveProject(initialProject);

    const initialObs = new ProjectObservation({
      id: 'obs_1',
      projectId: 'proj_881101',
      observedAt: now,
      bidsCount: 10,
      budgetMinUsd: 200,
      budgetMaxUsd: 400,
      budgetAvgUsd: 300,
      status: 'مفتوح',
    });
    await projectRepo.saveObservation(initialObs);

    mockCollector.fetchProjectDetail = async () => mockItem;

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881101', forceRefresh: true });

    expect(result.isNew).toBe(false);
    expect(result.refreshStatus).toBe('success_unchanged');

    const totalProjects = await projectRepo.countProjects();
    expect(totalProjects).toBe(1);

    const observations = await projectRepo.getObservationsByProjectId('proj_881101');
    expect(observations).toHaveLength(1); // NO new observation created!
  });

  it('3. Existing Changed Project: normalized hash changed -> updates Project, creates new Observation & Raw Payload', async () => {
    const now = new Date();
    const initialItem = {
      sourceProjectId: '881102',
      title: 'نظام ERP',
      sourceUrl: 'https://mostaql.com/project/881102',
      bidsCountParsed: 2,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>Initial HTML</body></html>',
    };

    const normHashInitial = computeNormalizedHash(initialItem);
    const project = new Project({
      id: 'proj_881102',
      sourceProjectId: '881102',
      title: initialItem.title,
      sourceUrl: initialItem.sourceUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      normalizedContentHash: normHashInitial,
    });
    await projectRepo.saveProject(project);

    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_init',
      projectId: 'proj_881102',
      observedAt: now,
      bidsCount: 2,
      status: 'مفتوح',
    }));

    // Source now returns updated bids count (14) and status ('قيد التنفيذ')
    const updatedItem = {
      ...initialItem,
      bidsCountParsed: 14,
      statusRaw: 'قيد التنفيذ',
      rawHtml: '<html><body>Updated HTML</body></html>',
    };
    mockCollector.fetchProjectDetail = async () => updatedItem;

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881102', forceRefresh: true });

    expect(result.refreshStatus).toBe('success_updated');
    expect(result.project.status).toBe('قيد التنفيذ');

    const observations = await projectRepo.getObservationsByProjectId('proj_881102');
    expect(observations).toHaveLength(2); // New observation created!
    expect(observations[1].bidsCount).toBe(14);
    expect(observations[1].status).toBe('قيد التنفيذ');
  });

  it('4. Raw HTML Changed / Data Unchanged: raw hash changed, normalized hash unchanged -> NO new Observation created', async () => {
    const now = new Date();
    const baseItem = {
      sourceProjectId: '881103',
      title: 'مشروع اختبار الهواش',
      sourceUrl: 'https://mostaql.com/project/881103',
      bidsCountParsed: 7,
      statusRaw: 'مفتوح',
      rawHtml: '<html><body>HTML Version 1 <input name="_token" value="abc" /></body></html>',
    };

    const normHash = computeNormalizedHash(baseItem);
    const rawHash1 = computeHash(baseItem.rawHtml);

    const project = new Project({
      id: 'proj_881103',
      sourceProjectId: '881103',
      title: baseItem.title,
      sourceUrl: baseItem.sourceUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
      rawContentHash: rawHash1,
      normalizedContentHash: normHash,
    });
    await projectRepo.saveProject(project);

    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_881103',
      projectId: 'proj_881103',
      observedAt: now,
      bidsCount: 7,
      status: 'مفتوح',
    }));

    // HTML changed CSRF token, but normalized project data is identical
    const changedHtmlItem = {
      ...baseItem,
      rawHtml: '<html><body>HTML Version 2 <input name="_token" value="xyz999" /></body></html>',
    };
    mockCollector.fetchProjectDetail = async () => changedHtmlItem;

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881103', forceRefresh: true });

    expect(result.refreshStatus).toBe('success_unchanged');

    const observations = await projectRepo.getObservationsByProjectId('proj_881103');
    expect(observations).toHaveLength(1); // NO new observation because normalized hash is unchanged!
  });

  it('5. Authentication Failure: safe recovery without losing local data', async () => {
    const now = new Date();
    const project = new Project({
      id: 'proj_881104',
      sourceProjectId: '881104',
      title: 'مشروع آمن محلية',
      sourceUrl: 'https://mostaql.com/project/881104',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
    });
    await projectRepo.saveProject(project);

    mockCollector.fetchProjectDetail = async () => {
      throw new MostaqlAuthError('Session expired during refresh');
    };

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881104', forceRefresh: true });

    expect(result.refreshStatus).toBe('auth_failed');
    expect(result.project).toBeDefined();
    expect(result.project.title).toBe('مشروع آمن محلية'); // Data preserved safely

    const dbProject = await projectRepo.findBySourceProjectId('881104');
    expect(dbProject?.lastSyncStatus).toBe('auth_failed');
  });

  it('6. Network Failure: safe recovery without losing local data', async () => {
    const now = new Date();
    const project = new Project({
      id: 'proj_881105',
      sourceProjectId: '881105',
      title: 'مشروع محلي محفوظ',
      sourceUrl: 'https://mostaql.com/project/881105',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'مفتوح',
    });
    await projectRepo.saveProject(project);

    mockCollector.fetchProjectDetail = async () => {
      throw new MostaqlNetworkError('Network ECONNREFUSED', 500);
    };

    const useCase = new GetAndRefreshProjectUseCase(projectRepo, mockCollector);
    const result = await useCase.execute({ sourceProjectId: '881105', forceRefresh: true });

    expect(result.refreshStatus).toBe('network_failed');
    expect(result.project.title).toBe('مشروع محلي محفوظ');
  });

  it('7. Single Source of Truth: /api/projects query returns EXACTLY 1 row per source_project_id even when project has multiple observations', async () => {
    const now = new Date();
    const project = new Project({
      id: 'proj_unique_99',
      sourceProjectId: '1282946',
      title: 'مونتاج وإخراج فيديو تسويقي',
      sourceUrl: 'https://mostaql.com/project/1282946',
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'قيد التنفيذ',
    });
    await projectRepo.saveProject(project);

    // Insert 3 observations for the SAME project
    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_1',
      projectId: 'proj_unique_99',
      observedAt: new Date(now.getTime() - 10000),
      bidsCount: 0,
      budgetAvgUsd: 0,
      status: 'قيد التنفيذ',
    }));
    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_2',
      projectId: 'proj_unique_99',
      observedAt: new Date(now.getTime() - 5000),
      bidsCount: 5,
      budgetAvgUsd: 50,
      status: 'قيد التنفيذ',
    }));
    await projectRepo.saveObservation(new ProjectObservation({
      id: 'obs_3',
      projectId: 'proj_unique_99',
      observedAt: now,
      bidsCount: 12,
      budgetAvgUsd: 75,
      status: 'قيد التنفيذ',
    }));

    const rawDb = appDb.getRawConnection();
    const sql = `
      SELECT p.id, p.source_project_id, p.title, p.source_url, p.published_at, p.first_seen_at, p.last_seen_at, p.status,
             o.bids_count, o.budget_min_usd, o.budget_max_usd, o.budget_avg_usd
      FROM projects p
      LEFT JOIN project_observations o ON o.id = (
        SELECT o2.id FROM project_observations o2
        WHERE o2.project_id = p.id
        ORDER BY o2.observed_at DESC, o2.id DESC
        LIMIT 1
      )
      WHERE p.source_project_id = ?
    `;

    const rows = rawDb.prepare(sql).all('1282946') as any[];
    expect(rows).toHaveLength(1); // GUARANTEED EXACTLY 1 ROW!
    expect(rows[0].source_project_id).toBe('1282946');
    expect(rows[0].bids_count).toBe(12); // Selected latest observation!
    expect(rows[0].budget_avg_usd).toBe(75);
  });
});

