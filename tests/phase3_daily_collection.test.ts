import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../src/infrastructure/repositories/SqliteCollectionRunRepository';
import { MockCollectorAdapter } from '../src/infrastructure/collectors/MockCollectorAdapter';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { DailyCollectionUseCase } from '../src/application/use-cases/DailyCollectionUseCase';
import { Project } from '../src/core/entities/Project';

describe('Phase 3 - Daily Collection & Incremental Updates Suite', () => {
  const testDbPath = path.join(__dirname, 'test_phase3_daily.db');
  let appDb: AppDatabase;
  let projectRepo: SqliteProjectRepository;
  let runRepo: SqliteCollectionRunRepository;
  let processUseCase: ProcessCollectionItemUseCase;
  let mockCollector: MockCollectorAdapter;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    appDb = new AppDatabase(testDbPath);
    const db = appDb.getRawConnection();
    projectRepo = new SqliteProjectRepository(db);
    runRepo = new SqliteCollectionRunRepository(db);
    processUseCase = new ProcessCollectionItemUseCase(projectRepo);
    mockCollector = new MockCollectorAdapter();
  });

  afterEach(() => {
    appDb.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('1. Daily Collection: should collect only projects newer than last_collection_boundary', async () => {
    const yesterday = new Date('2026-10-04T12:00:00.000Z');
    const todayNew1 = new Date('2026-10-05T08:00:00.000Z');
    const todayNew2 = new Date('2026-10-05T09:00:00.000Z');

    // Pre-populate DB with an existing project from yesterday
    const existingProject = new Project({
      id: 'proj_900',
      sourceProjectId: '900',
      title: 'مشروع من الأمس',
      sourceUrl: 'https://mostaql.com/project/900',
      publishedAt: yesterday,
      firstSeenAt: yesterday,
      lastSeenAt: yesterday,
      status: 'مفتوح',
    });
    await projectRepo.saveProject(existingProject);

    // Mock collector returning 2 new projects from today (Oct 5th) and the old project from yesterday (Oct 4th)
    mockCollector.setPageData(1, [
      { sourceProjectId: '902', title: 'مشروع جديد 2 من اليوم', sourceUrl: 'https://mostaql.com/project/902', publishedAtParsed: todayNew2 },
      { sourceProjectId: '901', title: 'مشروع جديد 1 من اليوم', sourceUrl: 'https://mostaql.com/project/901', publishedAtParsed: todayNew1 },
      { sourceProjectId: '900', title: 'مشروع من الأمس', sourceUrl: 'https://mostaql.com/project/900', publishedAtParsed: yesterday },
    ]);

    const dailyUseCase = new DailyCollectionUseCase(mockCollector, projectRepo, runRepo, processUseCase);
    const res = await dailyUseCase.execute(true);

    expect(res.run.status).toBe('completed');
    expect(res.newProjectsCount).toBe(2); // Only 902 and 901 collected as new
    expect(res.reachedBoundary).toBe(true);

    const totalCount = await projectRepo.countProjects();
    expect(totalCount).toBe(3); // 900 + 901 + 902
  });

  it('2. Locking Mechanism: should prevent concurrent daily collection runs', async () => {
    const dailyUseCase = new DailyCollectionUseCase(mockCollector, projectRepo, runRepo, processUseCase);

    mockCollector.setPageData(1, []);

    // Start run 1
    const p1 = dailyUseCase.execute(true);

    // Try starting run 2 immediately
    await expect(dailyUseCase.execute(true)).rejects.toThrow('Another collection run is currently in progress');

    await p1;
  });
});
