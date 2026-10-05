import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { ITaxonomyRepository } from '../../core/interfaces/ITaxonomyRepository';
import { RuleBasedClassifierService } from '../services/RuleBasedClassifierService';
import Database from 'better-sqlite3';

export interface ProcessItemResult {
  isNew: boolean;
  projectId: string;
  observationId: string;
}

export class ProcessCollectionItemUseCase {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly taxonomyRepository?: ITaxonomyRepository,
    private readonly db?: Database.Database
  ) {}

  public async execute(item: ParsedProjectItem, collectionRunId?: string): Promise<ProcessItemResult> {
    const now = new Date();
    const existingProject = await this.projectRepository.findBySourceProjectId(item.sourceProjectId);

    let projectEntity: Project;
    let isNew = false;

    if (!existingProject) {
      isNew = true;
      const projectId = `proj_${item.sourceProjectId}`;
      const publishedAt = item.publishedAtParsed;

      projectEntity = new Project({
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
        const rawPayload = new RawPayload({
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
    } else {
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
    const observation = new ProjectObservation({
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
        const classifier = new RuleBasedClassifierService(this.taxonomyRepository, this.db);
        await classifier.classifyProject(projectEntity, item.skillsTagsRaw || [], item.clientNameRaw);
      } catch (err) {
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
