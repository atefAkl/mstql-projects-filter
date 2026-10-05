"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessCollectionItemUseCase = void 0;
const Project_1 = require("../../core/entities/Project");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
const RawPayload_1 = require("../../core/entities/RawPayload");
const RuleBasedClassifierService_1 = require("../services/RuleBasedClassifierService");
class ProcessCollectionItemUseCase {
    projectRepository;
    taxonomyRepository;
    db;
    constructor(projectRepository, taxonomyRepository, db) {
        this.projectRepository = projectRepository;
        this.taxonomyRepository = taxonomyRepository;
        this.db = db;
    }
    async execute(item, collectionRunId) {
        const now = new Date();
        const existingProject = await this.projectRepository.findBySourceProjectId(item.sourceProjectId);
        let projectEntity;
        let isNew = false;
        if (!existingProject) {
            isNew = true;
            const projectId = `proj_${item.sourceProjectId}`;
            const publishedAt = item.publishedAtParsed;
            projectEntity = new Project_1.Project({
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
            await this.projectRepository.saveProject(projectEntity);
            // Save Raw Payload if present
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
        }
        else {
            existingProject.updateLastSeen(now);
            if (item.statusRaw) {
                existingProject.updateStatus(item.statusRaw);
            }
            if (item.descriptionRaw) {
                existingProject.descriptionRaw = item.descriptionRaw;
            }
            await this.projectRepository.saveProject(existingProject);
            projectEntity = existingProject;
        }
        // Save Observation
        const observationId = `obs_${item.sourceProjectId}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`;
        const observation = new ProjectObservation_1.ProjectObservation({
            id: observationId,
            projectId: projectEntity.id,
            observedAt: now,
            bidsCount: item.bidsCountParsed ?? 0,
            budgetMinUsd: item.budgetMinUsd,
            budgetMaxUsd: item.budgetMaxUsd,
            budgetAvgUsd: item.budgetAvgUsd,
            status: item.statusRaw || projectEntity.status,
            collectionRunId: collectionRunId,
        });
        await this.projectRepository.saveObservation(observation);
        // Trigger Rule-Based Taxonomy Classification if repositories & DB are present
        if (this.taxonomyRepository && this.db) {
            try {
                const classifier = new RuleBasedClassifierService_1.RuleBasedClassifierService(this.taxonomyRepository, this.db);
                await classifier.classifyProject(projectEntity, item.skillsTagsRaw || [], item.clientNameRaw);
            }
            catch (err) {
                // Classification non-fatal
                console.warn(`[ProcessCollectionItem] Classification warning for project ${projectEntity.sourceProjectId}:`, err);
            }
        }
        return {
            isNew,
            projectId: projectEntity.id,
            observationId,
        };
    }
}
exports.ProcessCollectionItemUseCase = ProcessCollectionItemUseCase;
//# sourceMappingURL=ProcessCollectionItemUseCase.js.map