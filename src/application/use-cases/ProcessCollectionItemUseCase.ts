import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import { ParsedProjectItem } from '../../core/interfaces/ICollectorAdapter';
import { IProjectRepository } from '../../core/interfaces/IProjectRepository';

export interface ProcessItemResult {
  isNew: boolean;
  projectId: string;
  observationId: string;
}

export class ProcessCollectionItemUseCase {
  constructor(private readonly projectRepository: IProjectRepository) {}

  public async execute(item: ParsedProjectItem, collectionRunId?: string): Promise<ProcessItemResult> {
    const now = new Date();
    const existingProject = await this.projectRepository.findBySourceProjectId(item.sourceProjectId);

    if (!existingProject) {
      // 1. Create New Project Record
      const projectId = `proj_${item.sourceProjectId}`;
      const publishedAt = item.publishedAtParsed;

      const newProject = new Project({
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

      // 3. Save Initial Observation
      const observationId = `obs_${item.sourceProjectId}_${now.getTime()}`;
      const observation = new ProjectObservation({
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
    } else {
      // Existing Project -> Update lastSeenAt & record new observation
      existingProject.updateLastSeen(now);
      if (item.statusRaw) {
        existingProject.updateStatus(item.statusRaw);
      }

      await this.projectRepository.saveProject(existingProject);

      const observationId = `obs_${item.sourceProjectId}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`;
      const observation = new ProjectObservation({
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
