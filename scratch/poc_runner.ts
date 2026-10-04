import path from 'path';
import fs from 'fs';
import { AppDatabase } from '../src/infrastructure/database/Database';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { SqliteCollectionRunRepository } from '../src/infrastructure/repositories/SqliteCollectionRunRepository';
import { MostaqlHtmlCollectorAdapter } from '../src/infrastructure/collectors/MostaqlHtmlCollectorAdapter';
import { ProcessCollectionItemUseCase } from '../src/application/use-cases/ProcessCollectionItemUseCase';
import { CollectionRun } from '../src/core/entities/CollectionRun';

async function runProofOfConcept() {
  console.log('=== Starting Phase 1.5 Proof of Concept (POC) ===\n');

  const pocDbPath = path.join(__dirname, 'poc_market_intelligence.db');
  if (fs.existsSync(pocDbPath)) {
    fs.unlinkSync(pocDbPath);
  }

  const appDb = new AppDatabase(pocDbPath);
  const db = appDb.getRawConnection();
  const projectRepo = new SqliteProjectRepository(db);
  const runRepo = new SqliteCollectionRunRepository(db);
  const collector = new MostaqlHtmlCollectorAdapter({ delayMs: 800 });
  const processUseCase = new ProcessCollectionItemUseCase(projectRepo);

  // Create CollectionRun
  const runId = `run_poc_${Date.now()}`;
  const run = new CollectionRun({
    id: runId,
    type: 'manual',
    status: 'running',
    startedAt: new Date(),
    pagesProcessed: 0,
    projectsFound: 0,
    newProjectsCount: 0,
    duplicateProjectsCount: 0,
    errorCount: 0,
  });
  await runRepo.save(run);

  try {
    const maxPagesToFetch = 2; // Fetch 2 pages for POC
    let projectLimitCount = 8; // Process 8 projects for POC

    for (let page = 1; page <= maxPagesToFetch; page++) {
      console.log(`[POC] Fetching listing page ${page}...`);
      const fetchResult = await collector.fetchPage(page);
      run.incrementPages();

      console.log(`[POC] Page ${page} returned ${fetchResult.items.length} raw items.`);

      for (const rawItem of fetchResult.items) {
        if (projectLimitCount <= 0) break;

        console.log(`\n[POC] Processing Project #${rawItem.sourceProjectId}: "${rawItem.title.slice(0, 40)}..."`);
        
        // Enrich first 3 projects with detail page
        let enrichedItem = rawItem;
        if (run.projectsFound < 3) {
          console.log(`  -> Fetching detail page for extra budget/skills info...`);
          enrichedItem = await collector.fetchProjectDetail(rawItem);
        }

        const res = await processUseCase.execute(enrichedItem, runId);

        if (res.isNew) {
          run.recordNewProject();
          console.log(`  ✓ Saved NEW Project ID=${res.projectId}`);
          console.log(`    PublishedAt: ${enrichedItem.publishedAtParsed?.toISOString() || 'N/A'}`);
          console.log(`    BidsCount: ${enrichedItem.bidsCountParsed}, BudgetAvg: ${enrichedItem.budgetAvgUsd || 'N/A'}`);
        } else {
          run.recordDuplicateProject();
          console.log(`  ✓ Updated EXISTING Project ID=${res.projectId} with new Observation ID=${res.observationId}`);
        }

        projectLimitCount--;
      }

      await runRepo.update(run);
      if (projectLimitCount <= 0) break;
    }

    run.markCompleted();
    await runRepo.update(run);

    console.log('\n==================================================');
    console.log('=== POC Summary Report ===');
    console.log('==================================================');
    console.log(`Status: ${run.status}`);
    console.log(`Pages Processed: ${run.pagesProcessed}`);
    console.log(`Total Projects Discovered: ${run.projectsFound}`);
    console.log(`New Projects Saved: ${run.newProjectsCount}`);
    console.log(`Duplicate Observations Recorded: ${run.duplicateProjectsCount}`);

    const dbProjectCount = await projectRepo.countProjects();
    console.log(`Total Projects in Database: ${dbProjectCount}`);

    // Verify raw payload saved
    const sampleProjects = await projectRepo.findProjects({ limit: 2 });
    if (sampleProjects.length > 0) {
      const sampleProj = sampleProjects[0];
      const observations = await projectRepo.getObservationsByProjectId(sampleProj.id);
      console.log(`\nSample Stored Project (${sampleProj.sourceProjectId}):`);
      console.log(`- Title: ${sampleProj.title}`);
      console.log(`- PublishedAt: ${sampleProj.publishedAt?.toISOString()}`);
      console.log(`- Observations Count: ${observations.length}`);
    }

  } catch (err) {
    run.markFailed((err as Error).message);
    await runRepo.update(run);
    console.error('[POC Failed]:', err);
  } finally {
    appDb.close();
    if (fs.existsSync(pocDbPath)) {
      fs.unlinkSync(pocDbPath);
    }
  }
}

runProofOfConcept();
