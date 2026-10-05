import { CollectionRun } from '../../core/entities/CollectionRun';
import { ICollectionRunRepository } from '../../core/interfaces/ICollectionRunRepository';
import { ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
import { defaultConfig } from '../../shared/config';
import { MostaqlAuthError } from '../../shared/errors';
import { ProcessCollectionItemUseCase } from './ProcessCollectionItemUseCase';

export interface HistoricalCollectionOptions {
  daysToBackfill?: number;
  resumeRunId?: string;
  enrichDetails?: boolean;
}

export interface HistoricalCollectionResult {
  run: CollectionRun;
  reachedCutoff: boolean;
}

export class HistoricalCollectionUseCase {
  constructor(
    private readonly collector: ICollectorAdapter,
    private readonly collectionRunRepo: ICollectionRunRepository,
    private readonly processItemUseCase: ProcessCollectionItemUseCase
  ) {}

  public async execute(options: HistoricalCollectionOptions = {}): Promise<HistoricalCollectionResult> {
    const days = options.daysToBackfill ?? defaultConfig.historicalBackfillDays;
    const startTime = new Date();
    const cutoffDate = new Date(startTime.getTime() - days * 86400 * 1000);

    let run: CollectionRun;
    let startPage = 1;

    if (options.resumeRunId) {
      const existingRun = await this.collectionRunRepo.findById(options.resumeRunId);
      if (!existingRun) {
        throw new Error(`CollectionRun with ID ${options.resumeRunId} not found for resume.`);
      }
      run = existingRun;
      run.status = 'running';
      startPage = run.lastProcessedPage || 1;
    } else {
      const runId = `run_hist_${startTime.getTime()}_${Math.floor(Math.random() * 1000)}`;
      run = new CollectionRun({
        id: runId,
        type: 'historical',
        status: 'running',
        startedAt: startTime,
        pagesProcessed: 0,
        projectsFound: 0,
        newProjectsCount: 0,
        duplicateProjectsCount: 0,
        observationsCreated: 0,
        cutoffDate,
        errorCount: 0,
      });
    }

    await this.collectionRunRepo.save(run);

    let reachedCutoff = false;
    let currentPage = startPage;

    try {
      while (!reachedCutoff) {
        let fetchResult;
        try {
          fetchResult = await this.collector.fetchPage(currentPage);
          run.incrementPages();
        } catch (fetchError) {
          if (fetchError instanceof MostaqlAuthError) {
            run.markFailed(`Authentication Failure on page ${currentPage}: ${(fetchError as Error).message}`);
            await this.collectionRunRepo.save(run);
            throw fetchError;
          }
          // Network or page fetch error -> record and retry or break if fatal
          run.recordError(`Failed to fetch page ${currentPage}: ${(fetchError as Error).message}`);
          await this.collectionRunRepo.save(run);
          break;
        }

        if (fetchResult.items.length === 0) {
          console.log(`[HistoricalCollection] Page ${currentPage} returned 0 items. Stopping pagination.`);
          break;
        }

        for (const item of fetchResult.items) {
          // Boundary Check: published_at < cutoffDate
          if (item.publishedAtParsed && item.publishedAtParsed.getTime() < cutoffDate.getTime()) {
            console.log(`[HistoricalCollection] Reached project published at ${item.publishedAtParsed.toISOString()} older than cutoff ${cutoffDate.toISOString()}. Stopping.`);
            reachedCutoff = true;
            break;
          }

          let itemToProcess = item;
          if (options.enrichDetails && typeof (this.collector as any).fetchProjectDetail === 'function') {
            try {
              itemToProcess = await (this.collector as any).fetchProjectDetail(item);
            } catch (err) {
              run.recordError(`Failed to enrich project ${item.sourceProjectId}: ${(err as Error).message}`);
            }
          }

          try {
            const processRes = await this.processItemUseCase.execute(itemToProcess, run.id);
            if (processRes.isNew) {
              run.recordNewProject();
            } else {
              run.recordDuplicateProject();
            }
            run.setProgress(currentPage, item.sourceProjectId);
          } catch (procErr) {
            run.recordError(`Failed to process item ${item.sourceProjectId}: ${(procErr as Error).message}`);
          }
        }

        await this.collectionRunRepo.save(run);

        if (reachedCutoff || !fetchResult.hasNextPage) {
          break;
        }

        currentPage++;
      }

      run.markCompleted();
      await this.collectionRunRepo.save(run);

      return { run, reachedCutoff };
    } catch (err) {
      if (run.status === 'running') {
        run.markInterrupted((err as Error).message);
        await this.collectionRunRepo.save(run);
      }
      throw err;
    }
  }
}
