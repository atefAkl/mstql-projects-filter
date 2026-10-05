"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessCollectionItemUseCase = void 0;
const Project_1 = require("../../core/entities/Project");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
const RawPayload_1 = require("../../core/entities/RawPayload");
class ProcessCollectionItemUseCase {
    projectRepository;
    constructor(projectRepository) {
        this.projectRepository = projectRepository;
    }
    async execute(item, collectionRunId) {
        const now = new Date();
        const existingProject = await this.projectRepository.findBySourceProjectId(item.sourceProjectId);
        if (!existingProject) {
            // 1. Create New Project Record
            const projectId = `proj_${item.sourceProjectId}`;
            const publishedAt = item.publishedAtParsed;
            const newProject = new Project_1.Project({
                id: projectId,
                sourceProjectId: item.sourceProjectId,
                title: item.title,
                sourceUrl: item.sourceUrl,
                descriptionRaw: item.descriptionRaw,
                publishedAt,
                firstSeenAt: now,
                lastSeenAt: now,
                status: item.statusRaw || 'مفتوح',
            });
            await this.projectRepository.saveProject(newProject);
            // 2. Save Raw Payload if present
            if (item.rawHtml) {
                const rawPayload = new RawPayload_1.RawPayload({
                    id: `raw_${item.sourceProjectId}_${now.getTime()}`,
                    projectId: projectId,
                    rawHtml: item.rawHtml,
                    rawMetadata: {
                        sourceUrl: item.sourceUrl,
                        clientNameRaw: item.clientNameRaw,
                        skillsTagsRaw: item.skillsTagsRaw,
                    },
                    createdAt: now,
                });
                await this.projectRepository.saveRawPayload(rawPayload);
            }
            // 3. Save Initial Observation
            const observationId = `obs_${item.sourceProjectId}_${now.getTime()}`;
            const observation = new ProjectObservation_1.ProjectObservation({
                id: observationId,
                projectId: projectId,
                observedAt: now,
                bidsCount: item.bidsCountParsed ?? 0,
                budgetMinUsd: item.budgetMinUsd,
                budgetMaxUsd: item.budgetMaxUsd,
                budgetAvgUsd: item.budgetAvgUsd,
                status: item.statusRaw || 'مفتوح',
                collectionRunId: collectionRunId,
            });
            await this.projectRepository.saveObservation(observation);
            return {
                isNew: true,
                projectId,
                observationId,
            };
        }
        else {
            // Existing Project -> Update lastSeenAt & record new observation
            existingProject.updateLastSeen(now);
            if (item.statusRaw) {
                existingProject.updateStatus(item.statusRaw);
            }
            await this.projectRepository.saveProject(existingProject);
            const observationId = `obs_${item.sourceProjectId}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`;
            const observation = new ProjectObservation_1.ProjectObservation({
                id: observationId,
                projectId: existingProject.id,
                observedAt: now,
                bidsCount: item.bidsCountParsed ?? 0,
                budgetMinUsd: item.budgetMinUsd,
                budgetMaxUsd: item.budgetMaxUsd,
                budgetAvgUsd: item.budgetAvgUsd,
                status: item.statusRaw || existingProject.status,
                collectionRunId: collectionRunId,
            });
            await this.projectRepository.saveObservation(observation);
            return {
                isNew: false,
                projectId: existingProject.id,
                observationId,
            };
        }
    }
}
exports.ProcessCollectionItemUseCase = ProcessCollectionItemUseCase;
//# sourceMappingURL=ProcessCollectionItemUseCase.js.map