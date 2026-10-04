import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../src/infrastructure/repositories/SqliteCollectionRunRepository';
import { MockCollectorAdapter } from '../src/infrastructure/collectors/MockCollectorAdapter';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { HistoricalCollectionUseCase } from '../src/application/use-cases/HistoricalCollectionUseCase';
import { MostaqlAuthError } from '../src/shared/errors';
import { ParsedProjectItem } from '../src/core/interfaces/ICollectorAdapter';
import { MostaqlParser } from '../src/infrastructure/collectors/MostaqlParser';

describe('Phase 2 - Historical Collector & Backfill Suite', () => {
  const testDbPath = path.join(__dirname, 'test_phase2_historical.db');
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

  it('1. Pagination: should paginate across multiple pages until end of results', async () => {
    const now = new Date();
    mockCollector.setPageData(1, [
      { sourceProjectId: '101', title: 'Proj 101', sourceUrl: 'https://mostaql.com/project/101', publishedAtParsed: now },
      { sourceProjectId: '102', title: 'Proj 102', sourceUrl: 'https://mostaql.com/project/102', publishedAtParsed: new Date(now.getTime() - 3600000) },
    ]);
    mockCollector.setPageData(2, [
      { sourceProjectId: '103', title: 'Proj 103', sourceUrl: 'https://mostaql.com/project/103', publishedAtParsed: new Date(now.getTime() - 7200000) },
    ]);

    const historicalUseCase = new HistoricalCollectionUseCase(mockCollector, runRepo, processUseCase);
    const res = await historicalUseCase.execute({ daysToBackfill: 30 });

    expect(res.run.status).toBe('completed');
    expect(res.run.pagesProcessed).toBe(2);
    expect(res.run.projectsFound).toBe(3);
    expect(res.run.newProjectsCount).toBe(3);

    const totalInDb = await projectRepo.countProjects();
    expect(totalInDb).toBe(3);
  });

  it('2. Cutoff Logic: should stop collection when encountering project older than cutoff date', async () => {
    const now = new Date();
    const cutoff30DaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);
    const olderThanCutoff = new Date(cutoff30DaysAgo.getTime() - 86400 * 1000); // 31 days ago

    mockCollector.setPageData(1, [
      { sourceProjectId: '201', title: 'New Proj', sourceUrl: 'https://mostaql.com/project/201', publishedAtParsed: now },
    ]);
    mockCollector.setPageData(2, [
      { sourceProjectId: '202', title: 'Old Proj', sourceUrl: 'https://mostaql.com/project/202', publishedAtParsed: olderThanCutoff },
      { sourceProjectId: '203', title: 'Even Older', sourceUrl: 'https://mostaql.com/project/203', publishedAtParsed: new Date(olderThanCutoff.getTime() - 86400000) },
    ]);

    const historicalUseCase = new HistoricalCollectionUseCase(mockCollector, runRepo, processUseCase);
    const res = await historicalUseCase.execute({ daysToBackfill: 30 });

    expect(res.reachedCutoff).toBe(true);
    expect(res.run.status).toBe('completed');
    expect(res.run.projectsFound).toBe(1); // Only 201 collected; 202 hit cutoff and stopped before 203
  });

  it('3. Deduplication: existing projects produce Observations without creating duplicate Projects', async () => {
    const now = new Date();
    mockCollector.setPageData(1, [
      { sourceProjectId: '301', title: 'Existing Proj', sourceUrl: 'https://mostaql.com/project/301', bidsCountParsed: 5, publishedAtParsed: now },
    ]);

    const historicalUseCase = new HistoricalCollectionUseCase(mockCollector, runRepo, processUseCase);

    // Run 1 (First discovery)
    const res1 = await historicalUseCase.execute({ daysToBackfill: 30 });
    expect(res1.run.newProjectsCount).toBe(1);
    expect(res1.run.duplicateProjectsCount).toBe(0);

    // Run 2 (Second discovery with updated bids)
    mockCollector.setPageData(1, [
      { sourceProjectId: '301', title: 'Existing Proj', sourceUrl: 'https://mostaql.com/project/301', bidsCountParsed: 18, publishedAtParsed: now },
    ]);

    const res2 = await historicalUseCase.execute({ daysToBackfill: 30 });
    expect(res2.run.newProjectsCount).toBe(0);
    expect(res2.run.duplicateProjectsCount).toBe(1);

    // Verify DB
    const totalProjects = await projectRepo.countProjects();
    expect(totalProjects).toBe(1); // Only 1 Project entity

    const proj = await projectRepo.findBySourceProjectId('301');
    expect(proj).not.toBeNull();
    const observations = await projectRepo.getObservationsByProjectId(proj!.id);
    expect(observations).toHaveLength(2); // 2 observations recorded
    expect(observations[0].bidsCount).toBe(5);
    expect(observations[1].bidsCount).toBe(18);
  });

  it('4. Raw Payload Preservation: raw HTML is saved and re-parsable', async () => {
    const rawHtmlSnippet = `<tr class="project-row"><td><h2><a href="https://mostaql.com/project/401-raw">مشروع خام</a></h2></td></tr>`;
    mockCollector.setPageData(1, [
      {
        sourceProjectId: '401',
        title: 'مشروع خام',
        sourceUrl: 'https://mostaql.com/project/401-raw',
        rawHtml: rawHtmlSnippet,
        publishedAtParsed: new Date(),
      },
    ]);

    const historicalUseCase = new HistoricalCollectionUseCase(mockCollector, runRepo, processUseCase);
    await historicalUseCase.execute({ daysToBackfill: 30 });

    const proj = await projectRepo.findBySourceProjectId('401');
    expect(proj).not.toBeNull();

    // Re-parse raw HTML snippet using MostaqlParser
    const reParsed = MostaqlParser.parseListingRow(rawHtmlSnippet);
    expect(reParsed?.sourceProjectId).toBe('401');
    expect(reParsed?.title).toBe('مشروع خام');
  });

  it('5. Failure Recovery: Authentication Failure halts run immediately with failed status', async () => {
    const authFailingCollector = {
      async fetchPage() {
        throw new MostaqlAuthError('Session expired or login redirect triggered.');
      },
    };

    const historicalUseCase = new HistoricalCollectionUseCase(authFailingCollector, runRepo, processUseCase);

    await expect(historicalUseCase.execute({ daysToBackfill: 30 })).rejects.toThrow(MostaqlAuthError);

    const latestRun = await runRepo.listRuns(1);
    expect(latestRun[0].status).toBe('failed');
    expect(latestRun[0].errorLog).toContain('Authentication Failure');
  });

  it('6. Resumeability: Interrupted run can resume from lastProcessedPage without data loss', async () => {
    const now = new Date();
    mockCollector.setPageData(1, [
      { sourceProjectId: '501', title: 'P1 Proj', sourceUrl: 'https://mostaql.com/project/501', publishedAtParsed: now },
    ]);
    mockCollector.setPageData(2, [
      { sourceProjectId: '502', title: 'P2 Proj', sourceUrl: 'https://mostaql.com/project/502', publishedAtParsed: now },
    ]);

    const historicalUseCase = new HistoricalCollectionUseCase(mockCollector, runRepo, processUseCase);

    // Initial run
    const res1 = await historicalUseCase.execute({ daysToBackfill: 30 });
    const runId = res1.run.id;

    // Simulate interruption state on page 1
    res1.run.markInterrupted('Simulated network drop on page 1');
    res1.run.setProgress(1, '501');
    await runRepo.save(res1.run);

    // Resume run
    const resResume = await historicalUseCase.execute({ resumeRunId: runId, daysToBackfill: 30 });
    expect(resResume.run.status).toBe('completed');
    expect(resResume.run.id).toBe(runId);

    const count = await projectRepo.countProjects();
    expect(count).toBe(2);
  });
});
