import { IProjectRepository } from '../../core/interfaces/IProjectRepository';
import { ICollectorAdapter } from '../../core/interfaces/ICollectorAdapter';
import { computeHash, computeNormalizedHash } from '../../shared/hash';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';

export interface BackfillResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
}

export class BackfillIncompleteProjectsUseCase {
  constructor(
    private readonly projectRepo: IProjectRepository,
    private readonly collector: ICollectorAdapter
  ) {}

  public async execute(): Promise<BackfillResult> {
    const incompleteProjects = await this.projectRepo.findProjects({});
    const pending = incompleteProjects.filter(
      p => p.completenessStatus !== 'complete' || !p.descriptionRaw
    );

    let successCount = 0;
    let failedCount = 0;

    for (const project of pending) {
      try {
        let fetchedItem;
        if (typeof (this.collector as any).fetchProjectDetailBySourceId === 'function') {
          fetchedItem = await (this.collector as any).fetchProjectDetailBySourceId(project.sourceProjectId);
        } else if (typeof (this.collector as any).fetchProjectDetail === 'function') {
          fetchedItem = await (this.collector as any).fetchProjectDetail(project);
        }

        if (!fetchedItem || !fetchedItem.title) {
          project.markCompleteness('fetch_failed');
          await this.projectRepo.saveProject(project);
          failedCount++;
          continue;
        }

        const now = new Date();
        const rawHash = computeHash(fetchedItem.rawHtml || '');
        const normHash = computeNormalizedHash(fetchedItem);

        project.title = fetchedItem.title || project.title;
        if (fetchedItem.descriptionRaw) project.descriptionRaw = fetchedItem.descriptionRaw;
        if (fetchedItem.publishedAtParsed) project.publishedAt = fetchedItem.publishedAtParsed;
        if (fetchedItem.statusRaw) project.updateStatus(fetchedItem.statusRaw);

        project.markCompleteness('complete');
        project.updateSyncDetails(rawHash, normHash, 'success', now);

        await this.projectRepo.saveProject(project);

        // Save raw payload if present
        if (fetchedItem.rawHtml) {
          const rawPayload = new RawPayload({
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
          const observation = new ProjectObservation({
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
      } catch (err) {
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
