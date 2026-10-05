"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyCollectionUseCase = void 0;
const CollectionRun_1 = require("../../core/entities/CollectionRun");
const errors_1 = require("../../shared/errors");
class DailyCollectionUseCase {
    collector;
    projectRepo;
    runRepo;
    processItemUseCase;
    static isRunningLock = false;
    constructor(collector, projectRepo, runRepo, processItemUseCase) {
        this.collector = collector;
        this.projectRepo = projectRepo;
        this.runRepo = runRepo;
        this.processItemUseCase = processItemUseCase;
    }
    async execute(manualTrigger = false) {
        if (DailyCollectionUseCase.isRunningLock) {
            throw new Error('Another collection run is currently in progress. Please wait.');
        }
        DailyCollectionUseCase.isRunningLock = true;
        const startTime = new Date();
        // Determine time boundary from latest project published_at / last_seen_at in DB
        const latestTimestamp = await this.projectRepo.getLatestSuccessfulCollectionTimestamp();
        // Default boundary to 24 hours ago if DB is empty
        const boundaryDate = latestTimestamp || new Date(startTime.getTime() - 24 * 3600 * 1000);
        const runId = `run_daily_${startTime.getTime()}_${Math.floor(Math.random() * 1000)}`;
        const run = new CollectionRun_1.CollectionRun({
            id: runId,
            type: manualTrigger ? 'manual' : 'daily',
            status: 'running',
            startedAt: startTime,
            pagesProcessed: 0,
            projectsFound: 0,
            newProjectsCount: 0,
            duplicateProjectsCount: 0,
            observationsCreated: 0,
            cutoffDate: boundaryDate,
            errorCount: 0,
        });
        await this.runRepo.save(run);
        let reachedBoundary = false;
        let currentPage = 1;
        const maxSafetyPages = 15; // Daily runs rarely exceed 5-10 pages
        try {
            while (!reachedBoundary && currentPage <= maxSafetyPages) {
                let fetchResult;
                try {
                    fetchResult = await this.collector.fetchPage(currentPage);
                    run.incrementPages();
                }
                catch (fetchError) {
                    if (fetchError instanceof errors_1.MostaqlAuthError) {
                        run.markFailed(`Authentication Failure on page ${currentPage}: ${fetchError.message}`);
                        await this.runRepo.save(run);
                        throw fetchError;
                    }
                    run.recordError(`Failed to fetch daily page ${currentPage}: ${fetchError.message}`);
                    await this.runRepo.save(run);
                    break;
                }
                if (fetchResult.items.length === 0) {
                    break;
                }
                for (const item of fetchResult.items) {
                    const existing = await this.projectRepo.findBySourceProjectId(item.sourceProjectId);
                    // Boundary condition: Stop when encountering an existing project published at or before boundaryDate
                    if (existing && item.publishedAtParsed && item.publishedAtParsed.getTime() <= boundaryDate.getTime()) {
                        console.log(`[DailyCollection] Reached boundary date ${boundaryDate.toISOString()} at existing project ${item.sourceProjectId}. Stopping incremental collection.`);
                        reachedBoundary = true;
                        break;
                    }
                    try {
                        // Full Ingestion for newly discovered projects
                        let fullItem = item;
                        if (!existing && typeof this.collector.fetchProjectDetail === 'function') {
                            try {
                                fullItem = await this.collector.fetchProjectDetail(item);
                            }
                            catch (err) {
                                fullItem = item;
                            }
                        }
                        const processRes = await this.processItemUseCase.execute(fullItem, run.id);
                        if (processRes.isNew) {
                            run.recordNewProject();
                        }
                        else {
                            run.recordDuplicateProject();
                        }
                        run.setProgress(currentPage, item.sourceProjectId);
                    }
                    catch (procErr) {
                        run.recordError(`Failed to process daily item ${item.sourceProjectId}: ${procErr.message}`);
                    }
                }
                await this.runRepo.save(run);
                if (reachedBoundary || !fetchResult.hasNextPage) {
                    break;
                }
                currentPage++;
            }
            run.markCompleted();
            await this.runRepo.save(run);
            return {
                run,
                newProjectsCount: run.newProjectsCount,
                duplicateProjectsCount: run.duplicateProjectsCount,
                reachedBoundary,
            };
        }
        catch (err) {
            if (run.status === 'running') {
                run.markInterrupted(err.message);
                await this.runRepo.save(run);
            }
            throw err;
        }
        finally {
            DailyCollectionUseCase.isRunningLock = false;
        }
    }
    static isRunning() {
        return DailyCollectionUseCase.isRunningLock;
    }
}
exports.DailyCollectionUseCase = DailyCollectionUseCase;
//# sourceMappingURL=DailyCollectionUseCase.js.map