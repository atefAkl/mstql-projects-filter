"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalCollectionUseCase = void 0;
const CollectionRun_1 = require("../../core/entities/CollectionRun");
const config_1 = require("../../shared/config");
const errors_1 = require("../../shared/errors");
class HistoricalCollectionUseCase {
    collector;
    collectionRunRepo;
    processItemUseCase;
    constructor(collector, collectionRunRepo, processItemUseCase) {
        this.collector = collector;
        this.collectionRunRepo = collectionRunRepo;
        this.processItemUseCase = processItemUseCase;
    }
    async execute(options = {}) {
        const days = options.daysToBackfill ?? config_1.defaultConfig.historicalBackfillDays;
        const startTime = new Date();
        const cutoffDate = new Date(startTime.getTime() - days * 86400 * 1000);
        let run;
        let startPage = 1;
        if (options.resumeRunId) {
            const existingRun = await this.collectionRunRepo.findById(options.resumeRunId);
            if (!existingRun) {
                throw new Error(`CollectionRun with ID ${options.resumeRunId} not found for resume.`);
            }
            run = existingRun;
            run.status = 'running';
            startPage = run.lastProcessedPage || 1;
        }
        else {
            const runId = `run_hist_${startTime.getTime()}`;
            run = new CollectionRun_1.CollectionRun({
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
                }
                catch (fetchError) {
                    if (fetchError instanceof errors_1.MostaqlAuthError) {
                        run.markFailed(`Authentication Failure on page ${currentPage}: ${fetchError.message}`);
                        await this.collectionRunRepo.save(run);
                        throw fetchError;
                    }
                    // Network or page fetch error -> record and retry or break if fatal
                    run.recordError(`Failed to fetch page ${currentPage}: ${fetchError.message}`);
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
                    if (options.enrichDetails && typeof this.collector.fetchProjectDetail === 'function') {
                        try {
                            itemToProcess = await this.collector.fetchProjectDetail(item);
                        }
                        catch (err) {
                            run.recordError(`Failed to enrich project ${item.sourceProjectId}: ${err.message}`);
                        }
                    }
                    try {
                        const processRes = await this.processItemUseCase.execute(itemToProcess, run.id);
                        if (processRes.isNew) {
                            run.recordNewProject();
                        }
                        else {
                            run.recordDuplicateProject();
                        }
                        run.setProgress(currentPage, item.sourceProjectId);
                    }
                    catch (procErr) {
                        run.recordError(`Failed to process item ${item.sourceProjectId}: ${procErr.message}`);
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
        }
        catch (err) {
            if (run.status === 'running') {
                run.markInterrupted(err.message);
                await this.collectionRunRepo.save(run);
            }
            throw err;
        }
    }
}
exports.HistoricalCollectionUseCase = HistoricalCollectionUseCase;
//# sourceMappingURL=HistoricalCollectionUseCase.js.map