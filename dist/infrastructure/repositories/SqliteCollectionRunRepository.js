"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteCollectionRunRepository = void 0;
const CollectionRun_1 = require("../../core/entities/CollectionRun");
class SqliteCollectionRunRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
        return new CollectionRun_1.CollectionRun({
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
    async save(run) {
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
        stmt.run(run.id, run.type, run.status, run.startedAt.toISOString(), run.finishedAt ? run.finishedAt.toISOString() : null, run.pagesProcessed, run.projectsFound, run.newProjectsCount, run.duplicateProjectsCount, run.observationsCreated, run.lastProcessedPage ?? null, run.lastProcessedProjectId || null, run.cutoffDate ? run.cutoffDate.toISOString() : null, run.errorCount, run.errorLog || null);
    }
    async update(run) {
        await this.save(run);
    }
    async getLatestCompletedRun() {
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
        const row = stmt.get();
        if (!row)
            return null;
        return new CollectionRun_1.CollectionRun({
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
    async getLatestInterruptedRun() {
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
        const row = stmt.get();
        if (!row)
            return null;
        return new CollectionRun_1.CollectionRun({
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
    async listRuns(limit = 20, offset = 0) {
        const stmt = this.db.prepare(`
      SELECT id, type, status, started_at, finished_at, pages_processed,
             projects_found, new_projects_count, duplicate_projects_count,
             observations_created, last_processed_page, last_processed_project_id,
             cutoff_date, error_count, error_log
      FROM collection_runs
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);
        const rows = stmt.all(limit, offset);
        return rows.map(row => new CollectionRun_1.CollectionRun({
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
exports.SqliteCollectionRunRepository = SqliteCollectionRunRepository;
//# sourceMappingURL=SqliteCollectionRunRepository.js.map