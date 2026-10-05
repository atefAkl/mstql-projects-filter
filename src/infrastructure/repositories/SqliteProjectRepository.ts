import Database from 'better-sqlite3';
import { Project } from '../../core/entities/Project';
import { ProjectObservation } from '../../core/entities/ProjectObservation';
import { RawPayload } from '../../core/entities/RawPayload';
import {
  FindProjectsFilter,
  IProjectRepository,
  ProjectSearchCriteria,
  PaginatedSearchResult
} from '../../core/interfaces/IProjectRepository';

export class SqliteProjectRepository implements IProjectRepository {
  constructor(private readonly db: Database.Database) {}

  public async findBySourceProjectId(sourceProjectId: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
      FROM projects 
      WHERE source_project_id = ?
    `);
    
    const row = stmt.get(sourceProjectId) as Record<string, any> | undefined;
    if (!row) return null;

    return new Project({
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

  public async findById(id: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
      FROM projects 
      WHERE id = ? OR source_project_id = ?
    `);
    
    const row = stmt.get(id, id) as Record<string, any> | undefined;
    if (!row) return null;

    return new Project({
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

  public async saveProject(project: Project): Promise<void> {
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

    stmt.run(
      project.id,
      project.sourceProjectId,
      project.title,
      project.sourceUrl,
      project.descriptionRaw || null,
      project.publishedAt ? project.publishedAt.toISOString() : null,
      project.firstSeenAt.toISOString(),
      project.lastSeenAt.toISOString(),
      project.status,
      project.clientId || null,
      project.rawContentHash || null,
      project.normalizedContentHash || null,
      project.lastSourceSyncAt ? project.lastSourceSyncAt.toISOString() : null,
      project.lastSyncStatus || null,
      project.completenessStatus || 'complete'
    );
  }

  public async saveObservation(observation: ProjectObservation): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO project_observations (
        id, project_id, observed_at, bids_count, budget_min_usd,
        budget_max_usd, budget_avg_usd, status, collection_run_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      observation.id,
      observation.projectId,
      observation.observedAt.toISOString(),
      observation.bidsCount,
      observation.budgetMinUsd ?? null,
      observation.budgetMaxUsd ?? null,
      observation.budgetAvgUsd ?? null,
      observation.status,
      observation.collectionRunId || null
    );
  }

  public async saveRawPayload(rawPayload: RawPayload): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO raw_payloads (
        id, project_id, raw_html, raw_metadata, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      rawPayload.id,
      rawPayload.projectId,
      rawPayload.rawHtml || null,
      rawPayload.rawMetadata ? JSON.stringify(rawPayload.rawMetadata) : null,
      rawPayload.createdAt.toISOString()
    );
  }

  public async getObservationsByProjectId(projectId: string): Promise<ProjectObservation[]> {
    const stmt = this.db.prepare(`
      SELECT id, project_id, observed_at, bids_count, budget_min_usd,
             budget_max_usd, budget_avg_usd, status, collection_run_id
      FROM project_observations
      WHERE project_id = ?
      ORDER BY observed_at ASC
    `);

    const rows = stmt.all(projectId) as Record<string, any>[];
    return rows.map(row => new ProjectObservation({
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

  public async getLatestObservation(projectId: string): Promise<ProjectObservation | null> {
    const stmt = this.db.prepare(`
      SELECT id, project_id, observed_at, bids_count, budget_min_usd,
             budget_max_usd, budget_avg_usd, status, collection_run_id
      FROM project_observations
      WHERE project_id = ?
      ORDER BY observed_at DESC
      LIMIT 1
    `);

    const row = stmt.get(projectId) as Record<string, any> | undefined;
    if (!row) return null;

    return new ProjectObservation({
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

  public async getLatestRawPayloadByProjectId(projectId: string): Promise<RawPayload | null> {
    const stmt = this.db.prepare(`
      SELECT id, project_id, raw_html, raw_metadata, created_at
      FROM raw_payloads
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(projectId) as Record<string, any> | undefined;
    if (!row) return null;

    let metadata: Record<string, unknown> | undefined;
    if (row.raw_metadata) {
      try {
        metadata = JSON.parse(row.raw_metadata);
      } catch (e) {
        metadata = undefined;
      }
    }

    return new RawPayload({
      id: row.id,
      projectId: row.project_id,
      rawHtml: row.raw_html || undefined,
      rawMetadata: metadata,
      createdAt: new Date(row.created_at),
    });
  }

  public async findProjects(filter: FindProjectsFilter = {}): Promise<Project[]> {
    let sql = `
      SELECT id, source_project_id, title, source_url, description_raw, 
             published_at, first_seen_at, last_seen_at, status, client_id,
             raw_content_hash, normalized_content_hash, last_source_sync_at, last_sync_status, completeness_status
      FROM projects
      WHERE 1=1
    `;
    const params: any[] = [];

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
    const rows = stmt.all(...params) as Record<string, any>[];

    return rows.map(row => new Project({
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
    }));
  }

  public async countProjects(filter: FindProjectsFilter = {}): Promise<number> {
    let sql = `SELECT COUNT(*) as cnt FROM projects WHERE 1=1`;
    const params: any[] = [];

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
    const row = stmt.get(...params) as { cnt: number };
    return row.cnt;
  }

  public async getLatestSuccessfulCollectionTimestamp(): Promise<Date | null> {
    const stmt = this.db.prepare(`
      SELECT MAX(published_at) as latest
      FROM projects
      WHERE published_at IS NOT NULL
    `);
    const row = stmt.get() as { latest: string | null };
    return row.latest ? new Date(row.latest) : null;
  }

  // Phase 4C Advanced Search Engine Implementation
  public async searchProjects(criteria: ProjectSearchCriteria): Promise<PaginatedSearchResult> {
    const params: any[] = [];
    const joins: string[] = [];
    const whereClauses: string[] = ['1=1'];

    // 1. Latest Observation Join for Bids & Budget Filtering
    joins.push(`
      LEFT JOIN project_observations obs ON obs.id = (
        SELECT id FROM project_observations 
        WHERE project_id = p.id 
        ORDER BY observed_at DESC LIMIT 1
      )
    `);

    // 2. Client Join
    joins.push(`LEFT JOIN clients c ON c.id = p.client_id`);

    // 3. FTS Text Search
    if (criteria.query && criteria.query.trim().length > 0) {
      const q = criteria.query.trim();
      const ftsFormatted = q.replace(/['"*]/g, '').split(/\s+/).filter(w => w.length > 0).map(w => `${w}*`).join(' AND ');
      
      if (ftsFormatted) {
        try {
          this.db.prepare(`SELECT project_id FROM projects_fts WHERE projects_fts MATCH ? LIMIT 1`).get(ftsFormatted);
          whereClauses.push(`p.id IN (SELECT project_id FROM projects_fts WHERE projects_fts MATCH ?)`);
          params.push(ftsFormatted);
        } catch (err) {
          whereClauses.push(`(p.title LIKE ? OR p.description_raw LIKE ? OR c.name LIKE ?)`);
          params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
      }
    }

    // 4. Date Presets & Range Filtering
    const now = new Date();
    let startDate: Date | undefined = criteria.publishedFrom;
    let endDate: Date | undefined = criteria.publishedTo;

    if (criteria.datePreset) {
      switch (criteria.datePreset) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'last_3_days':
          startDate = new Date(now.getTime() - 3 * 86400 * 1000);
          break;
        case 'last_7_days':
          startDate = new Date(now.getTime() - 7 * 86400 * 1000);
          break;
        case 'last_30_days':
          startDate = new Date(now.getTime() - 30 * 86400 * 1000);
          break;
        case 'last_90_days':
          startDate = new Date(now.getTime() - 90 * 86400 * 1000);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
    }

    if (startDate) {
      whereClauses.push(`p.published_at >= ?`);
      params.push(startDate.toISOString());
    }
    if (endDate) {
      whereClauses.push(`p.published_at <= ?`);
      params.push(endDate.toISOString());
    }

    // 5. Budget Filters
    if (criteria.budgetType === 'unassigned') {
      whereClauses.push(`(obs.budget_min_usd IS NULL AND obs.budget_max_usd IS NULL)`);
    } else if (criteria.budgetType === 'assigned') {
      whereClauses.push(`(obs.budget_min_usd IS NOT NULL OR obs.budget_max_usd IS NOT NULL)`);
    }

    if (criteria.budgetMin !== undefined) {
      whereClauses.push(`COALESCE(obs.budget_avg_usd, obs.budget_min_usd, 0) >= ?`);
      params.push(criteria.budgetMin);
    }
    if (criteria.budgetMax !== undefined) {
      whereClauses.push(`COALESCE(obs.budget_avg_usd, obs.budget_max_usd, 0) <= ?`);
      params.push(criteria.budgetMax);
    }

    // 6. Bids Presets & Range Filters
    let bidsMin = criteria.bidsFrom;
    let bidsMax = criteria.bidsTo;

    if (criteria.bidsPreset) {
      switch (criteria.bidsPreset) {
        case '0': bidsMin = 0; bidsMax = 0; break;
        case '1-5': bidsMin = 1; bidsMax = 5; break;
        case '6-10': bidsMin = 6; bidsMax = 10; break;
        case '11-20': bidsMin = 11; bidsMax = 20; break;
        case '21-50': bidsMin = 21; bidsMax = 50; break;
        case '50+': bidsMin = 50; bidsMax = 99999; break;
      }
    }

    if (bidsMin !== undefined) {
      whereClauses.push(`COALESCE(obs.bids_count, 0) >= ?`);
      params.push(bidsMin);
    }
    if (bidsMax !== undefined) {
      whereClauses.push(`COALESCE(obs.bids_count, 0) <= ?`);
      params.push(bidsMax);
    }

    // 7. Status & Completeness Filter
    if (criteria.status) {
      whereClauses.push(`p.status = ?`);
      params.push(criteria.status);
    }
    if (criteria.completenessStatus) {
      whereClauses.push(`p.completeness_status = ?`);
      params.push(criteria.completenessStatus);
    }

    // 8. Client Name / ID Filter
    if (criteria.clientId) {
      whereClauses.push(`p.client_id = ?`);
      params.push(criteria.clientId);
    }
    if (criteria.clientName) {
      whereClauses.push(`c.name LIKE ?`);
      params.push(`%${criteria.clientName}%`);
    }

    // 9. Competition Level Filter
    if (criteria.competitionLevel) {
      switch (criteria.competitionLevel) {
        case 'very_low': whereClauses.push(`COALESCE(obs.bids_count, 0) <= 2`); break;
        case 'low': whereClauses.push(`COALESCE(obs.bids_count, 0) BETWEEN 3 AND 10`); break;
        case 'medium': whereClauses.push(`COALESCE(obs.bids_count, 0) BETWEEN 11 AND 25`); break;
        case 'high': whereClauses.push(`COALESCE(obs.bids_count, 0) BETWEEN 26 AND 50`); break;
        case 'very_high': whereClauses.push(`COALESCE(obs.bids_count, 0) > 50`); break;
      }
    }

    // 10. Multi-Select Technology / Skills Filter (Match Any / Match All)
    if (criteria.skills && criteria.skills.length > 0) {
      const matchMode = criteria.skillsMatchMode || 'any';
      const placeholders = criteria.skills.map(() => '?').join(',');

      if (matchMode === 'all') {
        whereClauses.push(`
          p.id IN (
            SELECT ps.project_id
            FROM project_skills ps
            LEFT JOIN taxonomy_terms tt ON tt.id = ps.canonical_term_id
            WHERE LOWER(ps.skill_name) IN (${placeholders}) 
               OR LOWER(tt.code) IN (${placeholders})
               OR LOWER(tt.name_en) IN (${placeholders})
               OR LOWER(tt.name_ar) IN (${placeholders})
            GROUP BY ps.project_id
            HAVING COUNT(DISTINCT LOWER(ps.skill_name)) >= ?
          )
        `);
        const lowerSkills = criteria.skills.map(s => s.toLowerCase());
        params.push(...lowerSkills, ...lowerSkills, ...lowerSkills, ...lowerSkills, criteria.skills.length);
      } else {
        whereClauses.push(`
          p.id IN (
            SELECT ps.project_id
            FROM project_skills ps
            LEFT JOIN taxonomy_terms tt ON tt.id = ps.canonical_term_id
            WHERE LOWER(ps.skill_name) IN (${placeholders})
               OR LOWER(tt.code) IN (${placeholders})
               OR LOWER(tt.name_en) IN (${placeholders})
               OR LOWER(tt.name_ar) IN (${placeholders})
          )
        `);
        const lowerSkills = criteria.skills.map(s => s.toLowerCase());
        params.push(...lowerSkills, ...lowerSkills, ...lowerSkills, ...lowerSkills);
      }
    }

    // 11. Taxonomy Dimensions Filter (Domain, Service Type, Project Type, Industry, Work Type)
    const taxonomyFilters: Array<{ dim: string; val?: string }> = [
      { dim: 'domain', val: criteria.domain },
      { dim: 'service_type', val: criteria.serviceType },
      { dim: 'project_type', val: criteria.projectType },
      { dim: 'industry', val: criteria.industry },
      { dim: 'work_type', val: criteria.workType },
    ];

    for (const tf of taxonomyFilters) {
      if (tf.val) {
        whereClauses.push(`
          p.id IN (
            SELECT pc.project_id
            FROM project_classifications pc
            INNER JOIN taxonomy_terms tt ON tt.id = pc.taxonomy_term_id
            WHERE tt.dimension_code = ? AND (LOWER(tt.code) = LOWER(?) OR LOWER(tt.id) = LOWER(?))
          )
        `);
        params.push(tf.dim, tf.val, tf.val);
      }
    }

    // Build Final SQL Query
    const baseSql = `
      FROM projects p
      ${joins.join('\n')}
      WHERE ${whereClauses.join(' AND ')}
    `;

    // 12. Count Query
    const countSql = `SELECT COUNT(DISTINCT p.id) as total ${baseSql}`;
    const countStmt = this.db.prepare(countSql);
    const { total } = countStmt.get(...params) as { total: number };

    // 13. Sorting
    let orderBySql = 'ORDER BY p.published_at DESC';
    const sortOrder = (criteria.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (criteria.sortBy) {
      switch (criteria.sortBy) {
        case 'budget':
          orderBySql = `ORDER BY COALESCE(obs.budget_avg_usd, obs.budget_max_usd, obs.budget_min_usd, 0) ${sortOrder}`;
          break;
        case 'bids_count':
          orderBySql = `ORDER BY COALESCE(obs.bids_count, 0) ${sortOrder}`;
          break;
        case 'updated_at':
          orderBySql = `ORDER BY p.last_seen_at ${sortOrder}`;
          break;
        case 'relevance':
          if (criteria.query) {
            orderBySql = `ORDER BY p.published_at DESC`;
          }
          break;
        case 'published_at':
        default:
          orderBySql = `ORDER BY p.published_at ${sortOrder}`;
          break;
      }
    }

    // 14. Pagination
    const page = Math.max(1, criteria.page || 1);
    const limit = Math.max(1, Math.min(100, criteria.limit || 20));
    const offset = (page - 1) * limit;

    const selectSql = `
      SELECT DISTINCT 
        p.id, p.source_project_id, p.title, p.source_url, p.description_raw,
        p.published_at, p.first_seen_at, p.last_seen_at, p.status, p.client_id,
        p.raw_content_hash, p.normalized_content_hash, p.last_source_sync_at, p.last_sync_status, p.completeness_status,
        c.name as client_name,
        obs.id as obs_id, obs.observed_at as obs_at, obs.bids_count as obs_bids,
        obs.budget_min_usd as obs_bmin, obs.budget_max_usd as obs_bmax, obs.budget_avg_usd as obs_bavg, obs.status as obs_status
      ${baseSql}
      ${orderBySql}
      LIMIT ? OFFSET ?
    `;

    const selectParams = [...params, limit, offset];
    const rows = this.db.prepare(selectSql).all(...selectParams) as any[];

    // Map DB Rows to Result Objects
    const items = rows.map(r => {
      const project = new Project({
        id: r.id,
        sourceProjectId: r.source_project_id,
        title: r.title,
        sourceUrl: r.source_url,
        descriptionRaw: r.description_raw || undefined,
        publishedAt: r.published_at ? new Date(r.published_at) : undefined,
        firstSeenAt: new Date(r.first_seen_at),
        lastSeenAt: new Date(r.last_seen_at),
        status: r.status,
        clientId: r.client_id || undefined,
        rawContentHash: r.raw_content_hash || undefined,
        normalizedContentHash: r.normalized_content_hash || undefined,
        lastSourceSyncAt: r.last_source_sync_at ? new Date(r.last_source_sync_at) : undefined,
        lastSyncStatus: r.last_sync_status || undefined,
        completenessStatus: r.completeness_status || undefined,
      });

      const obs = r.obs_id ? new ProjectObservation({
        id: r.obs_id,
        projectId: r.id,
        observedAt: new Date(r.obs_at),
        bidsCount: r.obs_bids,
        budgetMinUsd: r.obs_bmin ?? undefined,
        budgetMaxUsd: r.obs_bmax ?? undefined,
        budgetAvgUsd: r.obs_bavg ?? undefined,
        status: r.obs_status
      }) : undefined;

      // Fetch Skills for project
      const skillRows = this.db.prepare(`SELECT skill_name FROM project_skills WHERE project_id = ?`).all(r.id) as { skill_name: string }[];
      const skills = skillRows.map(s => s.skill_name);

      // Determine derived competition level
      const bids = obs ? obs.bidsCount : 0;
      let competitionLevel = 'very_low';
      if (bids >= 50) competitionLevel = 'very_high';
      else if (bids >= 26) competitionLevel = 'high';
      else if (bids >= 11) competitionLevel = 'medium';
      else if (bids >= 3) competitionLevel = 'low';

      return Object.assign(project, {
        latestObservation: obs,
        skills,
        clientName: r.client_name || undefined,
        competitionLevel
      });
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages
    };
  }
}
