import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../src/infrastructure/repositories/SqliteCollectionRunRepository';
import { MostaqlHtmlCollectorAdapter } from '../src/infrastructure/collectors/MostaqlHtmlCollectorAdapter';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { HistoricalCollectionUseCase } from '../src/application/use-cases/HistoricalCollectionUseCase';

async function runLiveHistoricalBackfill() {
  console.log('==================================================');
  console.log('=== Starting Phase 2 Historical Backfill Job ===');
  console.log('==================================================\n');

  const startTime = Date.now();
  const dbPath = path.join(process.cwd(), 'data', 'market_intelligence.db');
  const appDb = new AppDatabase(dbPath);
  const db = appDb.getRawConnection();

  const projectRepo = new SqliteProjectRepository(db);
  const runRepo = new SqliteCollectionRunRepository(db);
  const collector = new MostaqlHtmlCollectorAdapter({ minDelayMs: 1000, maxDelayMs: 1500 });
  const processItemUseCase = new ProcessCollectionItemUseCase(projectRepo);
  const historicalUseCase = new HistoricalCollectionUseCase(collector, runRepo, processItemUseCase);

  try {
    console.log('Running 30-day Historical Collection Backfill...');
    const result = await historicalUseCase.execute({
      daysToBackfill: 30,
      enrichDetails: false, // Fast listing collection first
    });

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

    // Calculate database & raw data size
    const dbStats = fs.statSync(dbPath);
    const dbSizeMb = (dbStats.size / (1024 * 1024)).toFixed(2);

    const totalProjects = await projectRepo.countProjects();
    const latestRun = result.run;

    console.log('\n==================================================');
    console.log('=== Phase 2 Historical Collection Summary ===');
    console.log('==================================================');
    console.log(`Run ID: ${latestRun.id}`);
    console.log(`Status: ${latestRun.status}`);
    console.log(`Cutoff Boundary Date: ${latestRun.cutoffDate?.toISOString()}`);
    console.log(`Pages Processed: ${latestRun.pagesProcessed}`);
    console.log(`Total Projects Discovered: ${latestRun.projectsFound}`);
    console.log(`New Projects Created: ${latestRun.newProjectsCount}`);
    console.log(`Duplicate Projects Encountered: ${latestRun.duplicateProjectsCount}`);
    console.log(`Total Observations Recorded: ${latestRun.observationsCreated}`);
    console.log(`Errors Encountered: ${latestRun.errorCount}`);
    console.log(`Total Projects in Database: ${totalProjects}`);
    console.log(`Execution Duration: ${durationSeconds} seconds`);
    console.log(`Database Size: ${dbSizeMb} MB`);
    if (latestRun.errorLog) {
      console.log(`Error Log Snippet:\n${latestRun.errorLog.slice(0, 500)}`);
    }

  } catch (err) {
    console.error('\n[Historical Backfill Execution Error]:', err);
  } finally {
    appDb.close();
  }
}

runLiveHistoricalBackfill();
