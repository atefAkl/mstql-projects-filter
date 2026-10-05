"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteProjectRepository = void 0;
const Project_1 = require("../../core/entities/Project");
const ProjectObservation_1 = require("../../core/entities/ProjectObservation");
const RawPayload_1 = require("../../core/entities/RawPayload");
class SqliteProjectRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findBySourceProjectId(sourceProjectId) {
        const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
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
            rawContentHash: row.raw_content_hash || undefined,
            normalizedContentHash: row.normalized_content_hash || undefined,
            lastSourceSyncAt: row.last_source_sync_at ? new Date(row.last_source_sync_at) : undefined,
            lastSyncStatus: row.last_sync_status || undefined,
            completenessStatus: row.completeness_status || undefined,
        });
    }
    async findById(id) {
        const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
      FROM projects 
      WHERE id = ? OR source_project_id = ?
    `);
        const row = stmt.get(id, id);
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
            rawContentHash: row.raw_content_hash || undefined,
            normalizedContentHash: row.normalized_content_hash || undefined,
            lastSourceSyncAt: row.last_source_sync_at ? new Date(row.last_source_sync_at) : undefined,
            lastSyncStatus: row.last_sync_status || undefined,
            completenessStatus: row.completeness_status || undefined,
        });
    }
    async saveProject(project) {
        const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, source_project_id, title, source_url, description_raw,
        published_at, first_seen_at, last_seen_at, status, client_id,
        raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_project_id) DO UPDATE SET
        title = excluded.title,
        description_raw = COALESCE(excluded.description_raw, projects.description_raw),
        published_at = COALESCE(excluded.published_at, projects.published_at),
        last_seen_at = excluded.last_seen_at,
        status = excluded.status,
        client_id = COALESCE(excluded.client_id, projects.client_id),
        raw_content_hash = COALESCE(excluded.raw_content_hash, projects.raw_content_hash),
        normalized_content_hash = COALESCE(excluded.normalized_content_hash, projects.normalized_content_hash),
        last_source_sync_at = COALESCE(excluded.last_source_sync_at, projects.last_source_sync_at),
        last_sync_status = COALESCE(excluded.last_sync_status, projects.last_sync_status),
        completeness_status = excluded.completeness_status
    `);
        stmt.run(project.id, project.sourceProjectId, project.title, project.sourceUrl, project.descriptionRaw || null, project.publishedAt ? project.publishedAt.toISOString() : null, project.firstSeenAt.toISOString(), project.lastSeenAt.toISOString(), project.status, project.clientId || null, project.rawContentHash || null, project.normalizedContentHash || null, project.lastSourceSyncAt ? project.lastSourceSyncAt.toISOString() : null, project.lastSyncStatus || null, project.completenessStatus || 'complete');
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
    async getLatestRawPayloadByProjectId(projectId) {
        const stmt = this.db.prepare(`
      SELECT id, project_id, raw_html, raw_metadata, created_at
      FROM raw_payloads
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
        const row = stmt.get(projectId);
        if (!row)
            return null;
        let metadata;
        if (row.raw_metadata) {
            try {
                metadata = JSON.parse(row.raw_metadata);
            }
            catch (e) {
                metadata = undefined;
            }
        }
        return new RawPayload_1.RawPayload({
            id: row.id,
            projectId: row.project_id,
            rawHtml: row.raw_html || undefined,
            rawMetadata: metadata,
            createdAt: new Date(row.created_at),
        });
    }
    async findProjects(filter = {}) {
        let sql = `
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status
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
            rawContentHash: row.raw_content_hash || undefined,
            normalizedContentHash: row.normalized_content_hash || undefined,
            lastSourceSyncAt: row.last_source_sync_at ? new Date(row.last_source_sync_at) : undefined,
            lastSyncStatus: row.last_sync_status || undefined,
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
      SELECT MAX(published_at) as latest
      FROM projects
      WHERE published_at IS NOT NULL
    `);
        const row = stmt.get();
        return row.latest ? new Date(row.latest) : null;
    }
}
exports.SqliteProjectRepository = SqliteProjectRepository;
//# sourceMappingURL=SqliteProjectRepository.js.map