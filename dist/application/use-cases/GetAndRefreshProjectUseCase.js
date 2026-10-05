"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAndRefreshProjectUseCase = void 0;
const Project_1 = require("../../core/entities/Project");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
const RawPayload_1 = require("../../core/entities/RawPayload");
const hash_1 = require("../../shared/hash");
const errors_1 = require("../../shared/errors");
class GetAndRefreshProjectUseCase {
    projectRepo;
    collector;
    constructor(projectRepo, collector) {
        this.projectRepo = projectRepo;
        this.collector = collector;
    }
    async execute(options) {
        const { sourceProjectId, forceRefresh = true } = options;
        const now = new Date();
        // 1. Check if project exists in local database
        let existingProject = await this.projectRepo.findBySourceProjectId(sourceProjectId);
        if (!existingProject) {
            existingProject = await this.projectRepo.findById(sourceProjectId);
        }
        // 2. Case: Project does NOT exist locally -> Fetch from source
        if (!existingProject) {
            let fetchedItem;
            try {
                fetchedItem = await this.collector.fetchProjectDetailBySourceId(sourceProjectId);
            }
            catch (err) {
                throw err;
            }
            if (!fetchedItem || !fetchedItem.title) {
                throw new errors_1.MostaqlNetworkError(`Project ${sourceProjectId} could not be retrieved from source.`, 404);
            }
            const rawHash = (0, hash_1.computeHash)(fetchedItem.rawHtml || '');
            const normHash = (0, hash_1.computeNormalizedHash)(fetchedItem);
            const projectId = `proj_${fetchedItem.sourceProjectId}`;
            const newProject = new Project_1.Project({
                id: projectId,
                sourceProjectId: fetchedItem.sourceProjectId,
                title: fetchedItem.title,
                sourceUrl: fetchedItem.sourceUrl || `https://mostaql.com/project/${fetchedItem.sourceProjectId}`,
                descriptionRaw: fetchedItem.descriptionRaw,
                publishedAt: fetchedItem.publishedAtParsed, // STRICT NULL if unparseable
                firstSeenAt: now,
                lastSeenAt: now,
                status: fetchedItem.statusRaw || 'مفتوح',
                rawContentHash: rawHash,
                normalizedContentHash: normHash,
                lastSourceSyncAt: now,
                lastSyncStatus: 'success',
                completenessStatus: 'complete',
            });
            await this.projectRepo.saveProject(newProject);
            // Save initial raw payload
            let rawPayload;
            if (fetchedItem.rawHtml) {
                rawPayload = new RawPayload_1.RawPayload({
                    id: `raw_${fetchedItem.sourceProjectId}_${now.getTime()}`,
                    projectId: projectId,
                    rawHtml: fetchedItem.rawHtml,
                    rawMetadata: {
                        clientNameRaw: fetchedItem.clientNameRaw,
                        skillsTagsRaw: fetchedItem.skillsTagsRaw,
                        sourceUrl: fetchedItem.sourceUrl,
                    },
                    createdAt: now,
                });
                await this.projectRepo.saveRawPayload(rawPayload);
            }
            // Save initial observation
            const observation = new ProjectObservation_1.ProjectObservation({
                id: `obs_${fetchedItem.sourceProjectId}_${now.getTime()}`,
                projectId: projectId,
                observedAt: now,
                bidsCount: fetchedItem.bidsCountParsed ?? 0,
                budgetMinUsd: fetchedItem.budgetMinUsd,
                budgetMaxUsd: fetchedItem.budgetMaxUsd,
                budgetAvgUsd: fetchedItem.budgetAvgUsd,
                status: fetchedItem.statusRaw || 'مفتوح',
            });
            await this.projectRepo.saveObservation(observation);
            return {
                project: newProject,
                observations: [observation],
                rawPayload,
                refreshStatus: 'created_from_source',
                isNew: true,
            };
        }
        // 3. Case: Project DOES exist locally
        const observations = await this.projectRepo.getObservationsByProjectId(existingProject.id);
        if (!forceRefresh) {
            const rawPayload = await this.projectRepo.getLatestRawPayloadByProjectId(existingProject.id) || undefined;
            return {
                project: existingProject,
                observations,
                rawPayload,
                refreshStatus: 'local_cached',
                isNew: false,
            };
        }
        // Perform Smart Refresh
        let fetchedItem;
        try {
            fetchedItem = await this.collector.fetchProjectDetail(existingProject);
        }
        catch (err) {
            let syncStatus = 'network_failed';
            if (err instanceof errors_1.MostaqlAuthError) {
                syncStatus = 'auth_failed';
            }
            else if (err instanceof errors_1.MostaqlParsingError) {
                syncStatus = 'parsing_failed';
            }
            existingProject.updateSyncDetails(undefined, undefined, syncStatus, now);
            await this.projectRepo.saveProject(existingProject);
            const rawPayload = await this.projectRepo.getLatestRawPayloadByProjectId(existingProject.id) || undefined;
            return {
                project: existingProject,
                observations,
                rawPayload,
                refreshStatus: syncStatus,
                errorMessage: err.message,
                isNew: false,
            };
        }
        // Compute hashes for change detection
        const newRawHash = (0, hash_1.computeHash)(fetchedItem.rawHtml || '');
        const newNormHash = (0, hash_1.computeNormalizedHash)(fetchedItem);
        // Compare normalized content hash with existing
        const hasNormalizedChanged = !existingProject.normalizedContentHash || newNormHash !== existingProject.normalizedContentHash;
        if (!hasNormalizedChanged) {
            // Unchanged -> Update sync timestamp ONLY, NO new Observation, NO duplicate Project!
            existingProject.updateSyncDetails(newRawHash, newNormHash, 'success_unchanged', now);
            await this.projectRepo.saveProject(existingProject);
            const rawPayload = await this.projectRepo.getLatestRawPayloadByProjectId(existingProject.id) || undefined;
            return {
                project: existingProject,
                observations,
                rawPayload,
                refreshStatus: 'success_unchanged',
                isNew: false,
            };
        }
        // Normalized Data HAS Changed -> Update Project & Record new Observation & RawPayload
        existingProject.title = fetchedItem.title || existingProject.title;
        if (fetchedItem.descriptionRaw)
            existingProject.descriptionRaw = fetchedItem.descriptionRaw;
        if (fetchedItem.statusRaw)
            existingProject.updateStatus(fetchedItem.statusRaw);
        if (fetchedItem.publishedAtParsed)
            existingProject.publishedAt = fetchedItem.publishedAtParsed;
        existingProject.updateSyncDetails(newRawHash, newNormHash, 'success_updated', now);
        await this.projectRepo.saveProject(existingProject);
        // Save new Raw Payload snapshot
        let newRawPayload;
        if (fetchedItem.rawHtml) {
            newRawPayload = new RawPayload_1.RawPayload({
                id: `raw_${existingProject.sourceProjectId}_${now.getTime()}`,
                projectId: existingProject.id,
                rawHtml: fetchedItem.rawHtml,
                rawMetadata: {
                    clientNameRaw: fetchedItem.clientNameRaw,
                    skillsTagsRaw: fetchedItem.skillsTagsRaw,
                    sourceUrl: fetchedItem.sourceUrl,
                },
                createdAt: now,
            });
            await this.projectRepo.saveRawPayload(newRawPayload);
        }
        // Save new Observation snapshot
        const newObservation = new ProjectObservation_1.ProjectObservation({
            id: `obs_${existingProject.sourceProjectId}_${now.getTime()}`,
            projectId: existingProject.id,
            observedAt: now,
            bidsCount: fetchedItem.bidsCountParsed ?? 0,
            budgetMinUsd: fetchedItem.budgetMinUsd,
            budgetMaxUsd: fetchedItem.budgetMaxUsd,
            budgetAvgUsd: fetchedItem.budgetAvgUsd,
            status: fetchedItem.statusRaw || existingProject.status,
        });
        await this.projectRepo.saveObservation(newObservation);
        return {
            project: existingProject,
            observations: [...observations, newObservation],
            rawPayload: newRawPayload,
            refreshStatus: 'success_updated',
            isNew: false,
        };
    }
}
exports.GetAndRefreshProjectUseCase = GetAndRefreshProjectUseCase;
//# sourceMappingURL=GetAndRefreshProjectUseCase.js.map