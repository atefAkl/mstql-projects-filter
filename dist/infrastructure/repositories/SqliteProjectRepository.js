"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteProjectRepository = void 0;
const Project_1 = require("../../core/entities/Project");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
class SqliteProjectRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findBySourceProjectId(sourceProjectId) {
        const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id
      FROM projects 
      WHERE source_project_id = ?
    `);
        const row = stmt.get(sourceProjectId);
        if (!row)
            return null;
        return new Project_1.Project({
            id: row.id,
            sourceProjectId: row.source_project_id,
            title: row.title,
            sourceUrl: row.source_url,
            descriptionRaw: row.description_raw || undefined,
            publishedAt: row.published_at ? new Date(row.published_at) : undefined,
            firstSeenAt: new Date(row.first_seen_at),
            lastSeenAt: new Date(row.last_seen_at),
            status: row.status,
            clientId: row.client_id || undefined,
        });
    }
    async findById(id) {
        const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id
      FROM projects 
      WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
        return new Project_1.Project({
            id: row.id,
            sourceProjectId: row.source_project_id,
            title: row.title,
            sourceUrl: row.source_url,
            descriptionRaw: row.description_raw || undefined,
            publishedAt: row.published_at ? new Date(row.published_at) : undefined,
            firstSeenAt: new Date(row.first_seen_at),
            lastSeenAt: new Date(row.last_seen_at),
            status: row.status,
            clientId: row.client_id || undefined,
        });
    }
    async saveProject(project) {
        const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, source_project_id, title, source_url, description_raw,
        published_at, first_seen_at, last_seen_at, status, client_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_project_id) DO UPDATE SET
        title = excluded.title,
        description_raw = COALESCE(excluded.description_raw, projects.description_raw),
        published_at = COALESCE(excluded.published_at, projects.published_at),
        last_seen_at = excluded.last_seen_at,
        status = excluded.status,
        client_id = COALESCE(excluded.client_id, projects.client_id)
    `);
        stmt.run(project.id, project.sourceProjectId, project.title, project.sourceUrl, project.descriptionRaw || null, project.publishedAt ? project.publishedAt.toISOString() : null, project.firstSeenAt.toISOString(), project.lastSeenAt.toISOString(), project.status, project.clientId || null);
    }
    async saveObservation(observation) {
        const stmt = this.db.prepare(`
      INSERT INTO project_observations (
        id, project_id, observed_at, bids_count, budget_min_usd,
        budget_max_usd, budget_avg_usd, status, collection_run_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(observation.id, observation.projectId, observation.observedAt.toISOString(), observation.bidsCount, observation.budgetMinUsd ?? null, observation.budgetMaxUsd ?? null, observation.budgetAvgUsd ?? null, observation.status, observation.collectionRunId || null);
    }
    async saveRawPayload(rawPayload) {
        const stmt = this.db.prepare(`
      INSERT INTO raw_payloads (
        id, project_id, raw_html, raw_metadata, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(rawPayload.id, rawPayload.projectId, rawPayload.rawHtml || null, rawPayload.rawMetadata ? JSON.stringify(rawPayload.rawMetadata) : null, rawPayload.createdAt.toISOString());
    }
    async getObservationsByProjectId(projectId) {
        const stmt = this.db.prepare(`
      SELECT id, project_id, observed_at, bids_count, budget_min_usd,
             budget_max_usd, budget_avg_usd, status, collection_run_id
      FROM project_observations
      WHERE project_id = ?
      ORDER BY observed_at ASC
    `);
        const rows = stmt.all(projectId);
        return rows.map(row => new ProjectObservation_1.ProjectObservation({
            id: row.id,
            projectId: row.project_id,
            observedAt: new Date(row.observed_at),
            bidsCount: row.bids_count,
            budgetMinUsd: row.budget_min_usd ?? undefined,
            budgetMaxUsd: row.budget_max_usd ?? undefined,
            budgetAvgUsd: row.budget_avg_usd ?? undefined,
            status: row.status,
            collectionRunId: row.collection_run_id || undefined,
        }));
    }
    async getLatestObservation(projectId) {
        const stmt = this.db.prepare(`
      SELECT id, project_id, observed_at, bids_count, budget_min_usd,
             budget_max_usd, budget_avg_usd, status, collection_run_id
      FROM project_observations
      WHERE project_id = ?
      ORDER BY observed_at DESC
      LIMIT 1
    `);
        const row = stmt.get(projectId);
        if (!row)
            return null;
        return new ProjectObservation_1.ProjectObservation({
            id: row.id,
            projectId: row.project_id,
            observedAt: new Date(row.observed_at),
            bidsCount: row.bids_count,
            budgetMinUsd: row.budget_min_usd ?? undefined,
            budgetMaxUsd: row.budget_max_usd ?? undefined,
            budgetAvgUsd: row.budget_avg_usd ?? undefined,
            status: row.status,
            collectionRunId: row.collection_run_id || undefined,
        });
    }
    async findProjects(filter = {}) {
        let sql = `
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id
      FROM projects
      WHERE 1=1
    `;
        const params = [];
        if (filter.status) {
            sql += ` AND status = ?`;
            params.push(filter.status);
        }
        if (filter.publishedAfter) {
            sql += ` AND published_at >= ?`;
            params.push(filter.publishedAfter.toISOString());
        }
        if (filter.publishedBefore) {
            sql += ` AND published_at <= ?`;
            params.push(filter.publishedBefore.toISOString());
        }
        sql += ` ORDER BY published_at DESC`;
        if (filter.limit) {
            sql += ` LIMIT ?`;
            params.push(filter.limit);
        }
        if (filter.offset) {
            sql += ` OFFSET ?`;
            params.push(filter.offset);
        }
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map(row => new Project_1.Project({
            id: row.id,
            sourceProjectId: row.source_project_id,
            title: row.title,
            sourceUrl: row.source_url,
            descriptionRaw: row.description_raw || undefined,
            publishedAt: row.published_at ? new Date(row.published_at) : undefined,
            firstSeenAt: new Date(row.first_seen_at),
            lastSeenAt: new Date(row.last_seen_at),
            status: row.status,
            clientId: row.client_id || undefined,
        }));
    }
    async countProjects(filter = {}) {
        let sql = `SELECT COUNT(*) as cnt FROM projects WHERE 1=1`;
        const params = [];
        if (filter.status) {
            sql += ` AND status = ?`;
            params.push(filter.status);
        }
        if (filter.publishedAfter) {
            sql += ` AND published_at >= ?`;
            params.push(filter.publishedAfter.toISOString());
        }
        if (filter.publishedBefore) {
            sql += ` AND published_at <= ?`;
            params.push(filter.publishedBefore.toISOString());
        }
        const stmt = this.db.prepare(sql);
        const row = stmt.get(...params);
        return row.cnt;
    }
    async getLatestSuccessfulCollectionTimestamp() {
        const stmt = this.db.prepare(`
      SELECT MAX(last_seen_at) as latest
      FROM projects
    `);
        const row = stmt.get();
        return row.latest ? new Date(row.latest) : null;
    }
}
exports.SqliteProjectRepository = SqliteProjectRepository;
//# sourceMappingURL=SqliteProjectRepository.js.map