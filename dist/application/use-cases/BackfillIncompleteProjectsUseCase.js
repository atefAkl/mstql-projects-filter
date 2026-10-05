"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackfillIncompleteProjectsUseCase = void 0;
const hash_1 = require("../../shared/hash");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
const RawPayload_1 = require("../../core/entities/RawPayload");
class BackfillIncompleteProjectsUseCase {
    projectRepo;
    collector;
    constructor(projectRepo, collector) {
        this.projectRepo = projectRepo;
        this.collector = collector;
    }
    async execute() {
        const incompleteProjects = await this.projectRepo.findProjects({});
        const pending = incompleteProjects.filter(p => p.completenessStatus !== 'complete' || !p.descriptionRaw);
        let successCount = 0;
        let failedCount = 0;
        for (const project of pending) {
            try {
                let fetchedItem;
                if (typeof this.collector.fetchProjectDetailBySourceId === 'function') {
                    fetchedItem = await this.collector.fetchProjectDetailBySourceId(project.sourceProjectId);
                }
                else if (typeof this.collector.fetchProjectDetail === 'function') {
                    fetchedItem = await this.collector.fetchProjectDetail(project);
                }
                if (!fetchedItem || !fetchedItem.title) {
                    project.markCompleteness('fetch_failed');
                    await this.projectRepo.saveProject(project);
                    failedCount++;
                    continue;
                }
                const now = new Date();
                const rawHash = (0, hash_1.computeHash)(fetchedItem.rawHtml || '');
                const normHash = (0, hash_1.computeNormalizedHash)(fetchedItem);
                project.title = fetchedItem.title || project.title;
                if (fetchedItem.descriptionRaw)
                    project.descriptionRaw = fetchedItem.descriptionRaw;
                if (fetchedItem.publishedAtParsed)
                    project.publishedAt = fetchedItem.publishedAtParsed;
                if (fetchedItem.statusRaw)
                    project.updateStatus(fetchedItem.statusRaw);
                project.markCompleteness('complete');
                project.updateSyncDetails(rawHash, normHash, 'success', now);
                await this.projectRepo.saveProject(project);
                // Save raw payload if present
                if (fetchedItem.rawHtml) {
                    const rawPayload = new RawPayload_1.RawPayload({
                        id: `raw_${project.sourceProjectId}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`,
                        projectId: project.id,
                        rawHtml: fetchedItem.rawHtml,
                        rawMetadata: {
                            sourceUrl: fetchedItem.sourceUrl,
                            clientNameRaw: fetchedItem.clientNameRaw,
                            skillsTagsRaw: fetchedItem.skillsTagsRaw,
                        },
                        createdAt: now,
                    });
                    await this.projectRepo.saveRawPayload(rawPayload);
                }
                // Save observation if none exists
                const existingObs = await this.projectRepo.getObservationsByProjectId(project.id);
                if (existingObs.length === 0) {
                    const observation = new ProjectObservation_1.ProjectObservation({
                        id: `obs_${project.sourceProjectId}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`,
                        projectId: project.id,
                        observedAt: now,
                        bidsCount: fetchedItem.bidsCountParsed ?? 0,
                        budgetMinUsd: fetchedItem.budgetMinUsd,
                        budgetMaxUsd: fetchedItem.budgetMaxUsd,
                        budgetAvgUsd: fetchedItem.budgetAvgUsd,
                        status: fetchedItem.statusRaw || project.status,
                    });
                    await this.projectRepo.saveObservation(observation);
                }
                successCount++;
            }
            catch (err) {
                project.markCompleteness('fetch_failed');
                await this.projectRepo.saveProject(project);
                failedCount++;
            }
        }
        return {
            processedCount: pending.length,
            successCount,
            failedCount,
        };
    }
}
exports.BackfillIncompleteProjectsUseCase = BackfillIncompleteProjectsUseCase;
//# sourceMappingURL=BackfillIncompleteProjectsUseCase.js.map