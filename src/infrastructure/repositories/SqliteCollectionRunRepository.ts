import Database from 'better-sqlite3';
import { CollectionRun } from '../../core/entities/CollectionRun';
import { ICollectionRunRepository } from '../../core/interfaces/ICollectionRunRepository';

export class SqliteCollectionRunRepository implements ICollectionRunRepository {
  constructor(private readonly db: Database.Database) {}

  public async findById(id: string): Promise<CollectionRun | null> {
    const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      WHERE id = ?
    `);

    const row = stmt.get(id) as Record<string, any> | undefined;
    if (!row) return null;

    return new CollectionRun({
      id: row.id,
      type: row.type,
      status: row.status,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      pagesProcessed: row.pages_processed,
      projectsFound: row.projects_found,
      newProjectsCount: row.new_projects_count,
      duplicateProjectsCount: row.duplicate_projects_count,
      observationsCreated: row.observations_created || 0,
      lastProcessedPage: row.last_processed_page || undefined,
      lastProcessedProjectId: row.last_processed_project_id || undefined,
      cutoffDate: row.cutoff_date ? new Date(row.cutoff_date) : undefined,
      errorCount: row.error_count,
      errorLog: row.error_log || undefined,
    });
  }

  public async save(run: CollectionRun): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO collection_runs (
        id, type, status, started_at, finished_at, pages_processed,
        projects_found, new_projects_count, duplicate_projects_count,
        observations_created, last_processed_page, last_processed_project_id,
        cutoff_date, error_count, error_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        finished_at = excluded.finished_at,
        pages_processed = excluded.pages_processed,
        projects_found = excluded.projects_found,
        new_projects_count = excluded.new_projects_count,
        duplicate_projects_count = excluded.duplicate_projects_count,
        observations_created = excluded.observations_created,
        last_processed_page = excluded.last_processed_page,
        last_processed_project_id = excluded.last_processed_project_id,
        cutoff_date = excluded.cutoff_date,
        error_count = excluded.error_count,
        error_log = excluded.error_log
    `);

    stmt.run(
      run.id,
      run.type,
      run.status,
      run.startedAt.toISOString(),
      run.finishedAt ? run.finishedAt.toISOString() : null,
      run.pagesProcessed,
      run.projectsFound,
      run.newProjectsCount,
      run.duplicateProjectsCount,
      run.observationsCreated,
      run.lastProcessedPage ?? null,
      run.lastProcessedProjectId || null,
      run.cutoffDate ? run.cutoffDate.toISOString() : null,
      run.errorCount,
      run.errorLog || null
    );
  }

  public async update(run: CollectionRun): Promise<void> {
    await this.save(run);
  }

  public async getLatestCompletedRun(): Promise<CollectionRun | null> {
    const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      WHERE status = 'completed'
      ORDER BY finished_at DESC
      LIMIT 1
    `);

    const row = stmt.get() as Record<string, any> | undefined;
    if (!row) return null;

    return new CollectionRun({
      id: row.id,
      type: row.type,
      status: row.status,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      pagesProcessed: row.pages_processed,
      projectsFound: row.projects_found,
      newProjectsCount: row.new_projects_count,
      duplicateProjectsCount: row.duplicate_projects_count,
      observationsCreated: row.observations_created || 0,
      lastProcessedPage: row.last_processed_page || undefined,
      lastProcessedProjectId: row.last_processed_project_id || undefined,
      cutoffDate: row.cutoff_date ? new Date(row.cutoff_date) : undefined,
      errorCount: row.error_count,
      errorLog: row.error_log || undefined,
    });
  }

  public async getLatestInterruptedRun(): Promise<CollectionRun | null> {
    const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      WHERE status IN ('interrupted', 'running', 'failed')
      ORDER BY started_at DESC
      LIMIT 1
    `);

    const row = stmt.get() as Record<string, any> | undefined;
    if (!row) return null;

    return new CollectionRun({
      id: row.id,
      type: row.type,
      status: row.status,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      pagesProcessed: row.pages_processed,
      projectsFound: row.projects_found,
      newProjectsCount: row.new_projects_count,
      duplicateProjectsCount: row.duplicate_projects_count,
      observationsCreated: row.observations_created || 0,
      lastProcessedPage: row.last_processed_page || undefined,
      lastProcessedProjectId: row.last_processed_project_id || undefined,
      cutoffDate: row.cutoff_date ? new Date(row.cutoff_date) : undefined,
      errorCount: row.error_count,
      errorLog: row.error_log || undefined,
    });
  }

  public async listRuns(limit: number = 20, offset: number = 0): Promise<CollectionRun[]> {
    const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as Record<string, any>[];

    return rows.map(row => new CollectionRun({
      id: row.id,
      type: row.type,
      status: row.status,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
      pagesProcessed: row.pages_processed,
      projectsFound: row.projects_found,
      newProjectsCount: row.new_projects_count,
      duplicateProjectsCount: row.duplicate_projects_count,
      observationsCreated: row.observations_created || 0,
      lastProcessedPage: row.last_processed_page || undefined,
      lastProcessedProjectId: row.last_processed_project_id || undefined,
      cutoffDate: row.cutoff_date ? new Date(row.cutoff_date) : undefined,
      errorCount: row.error_count,
      errorLog: row.error_log || undefined,
    }));
  }
}
