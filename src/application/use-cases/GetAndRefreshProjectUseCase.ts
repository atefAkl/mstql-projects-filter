import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { MostaqlHtmlCollectorAdapter } from '../../infrastructure/collectors/MostaqlHtmlCollectorAdapter';
import { computeHash, computeNormalizedHash } from '../../shared/hash';
import { MostaqlAuthError, MostaqlNetworkError, MostaqlParsingError } from '../../shared/errors';

export interface RefreshProjectOptions {
  sourceProjectId: string;
  forceRefresh?: boolean;
}

export interface RefreshProjectResult {
  project: Project;
  observations: ProjectObservation[];
  rawPayload?: RawPayload;
  refreshStatus: 'created_from_source' | 'local_cached' | 'success_unchanged' | 'success_updated' | 'auth_failed' | 'network_failed' | 'parsing_failed';
  errorMessage?: string;
  isNew: boolean;
}

export class GetAndRefreshProjectUseCase {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly collector: MostaqlHtmlCollectorAdapter
  ) {}

  public async execute(options: RefreshProjectOptions): Promise<RefreshProjectResult> {
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
      } catch (err) {
        throw err;
      }

      if (!fetchedItem || !fetchedItem.title) {
        throw new MostaqlNetworkError(`Project ${sourceProjectId} could not be retrieved from source.`, 404);
      }

      const rawHash = computeHash(fetchedItem.rawHtml || '');
      const normHash = computeNormalizedHash(fetchedItem);
      const projectId = `proj_${fetchedItem.sourceProjectId}`;

      const newProject = new Project({
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
      let rawPayload: RawPayload | undefined;
      if (fetchedItem.rawHtml) {
        rawPayload = new RawPayload({
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
      const observation = new ProjectObservation({
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
    } catch (err) {
      let syncStatus: 'auth_failed' | 'network_failed' | 'parsing_failed' = 'network_failed';
      if (err instanceof MostaqlAuthError) {
        syncStatus = 'auth_failed';
      } else if (err instanceof MostaqlParsingError) {
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
        errorMessage: (err as Error).message,
        isNew: false,
      };
    }

    // Compute hashes for change detection
    const newRawHash = computeHash(fetchedItem.rawHtml || '');
    const newNormHash = computeNormalizedHash(fetchedItem);

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
    if (fetchedItem.descriptionRaw) existingProject.descriptionRaw = fetchedItem.descriptionRaw;
    if (fetchedItem.statusRaw) existingProject.updateStatus(fetchedItem.statusRaw);
    if (fetchedItem.publishedAtParsed) existingProject.publishedAt = fetchedItem.publishedAtParsed;

    existingProject.updateSyncDetails(newRawHash, newNormHash, 'success_updated', now);
    await this.projectRepo.saveProject(existingProject);

    // Save new Raw Payload snapshot
    let newRawPayload: RawPayload | undefined;
    if (fetchedItem.rawHtml) {
      newRawPayload = new RawPayload({
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
    const newObservation = new ProjectObservation({
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
